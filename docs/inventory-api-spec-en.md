# Inventory API Spec — sniff-n-frolic-api

**Status:** DRAFT — pending Perry's approval per CLAUDE.md "API Change Boundary" rule.

**Companion doc:** the POS UI spec (Stock Overview, Movements Log, Adjust Stock) consumes these endpoints. Field names in this document are the wire format. UI clients may map to their own naming.

**Out of scope:**
- Automatic stock deduction on order checkout — belongs to the orders integration, tracked separately. This spec exposes only the primitives (`POST /inventory/movements`) that a future orders integration will call server-side.
- Multi-branch stock separation. Schema is branch-aware but v1 runs single-store; see §7.

---

## 1. Current State

**What exists** (as of migration 016):

- `products` table (migration 008) with columns including `id`, `name`, `sku`, `product_type` (text, default `'simple'`), `stock_status` (text: `instock` | `outofstock` | `onbackorder`), `stock_quantity` (int, default 0), `manage_stock` (bool, default false).
- `inventory_movements` table (migration 016):
  ```sql
  CREATE TABLE inventory_movements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
    quantity_change integer NOT NULL,
    reason text NOT NULL,  -- 'sale', 'restock', 'adjustment', 'return'
    reference_id uuid,
    note text,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ```
  Indexes on `product_id`, `branch_id`, `created_at`.
- No inventory module in `src/modules/`. No endpoints. No service updates `stock_quantity` in response to a movement.
- The existing POS `StockAdjustDialog` uses `PUT /products/:id` to set `stock_quantity` directly — no audit trail, no reason, no atomicity with a movement row.

**What's missing** (blockers for the UI spec):

| Gap | Consequence for UI |
|---|---|
| No `parent_id` on `products` | Variations can't be grouped under parents in Stock Overview |
| No low-stock threshold | `is_low_stock` flag cannot be computed |
| `stock_status` never auto-updates | Overview and product-facing screens can drift out of sync after a movement |
| Reason text uncontrolled | `'damage'` (used by UI) is undocumented and not enforced |
| No non-negative `stock_quantity` guard at DB level | API-level check is the only safety net |
| No `inventory` module | Endpoints don't exist |

---

## 2. Schema Decisions — REQUIRES PERRY APPROVAL

Each decision below is presented as **Options → Recommendation**. Nothing here is settled until Perry confirms. All schema changes land in **migration 017** (next number).

### 2.1 Variation-parent link

The UI groups variations under their parent product. The schema currently has no link.

- **Option A (recommended):** Add a nullable self-referencing column.
  ```sql
  ALTER TABLE products
    ADD COLUMN parent_id UUID REFERENCES products(id) ON DELETE CASCADE;
  CREATE INDEX idx_products_parent ON products(parent_id) WHERE parent_id IS NOT NULL;
  ```
  Simple products: `parent_id IS NULL`, `product_type = 'simple'`.
  Variable parents: `parent_id IS NULL`, `product_type = 'variable'`.
  Variations: `parent_id = <parent uuid>`, `product_type = 'variation'`.
- **Option B:** Separate `product_variations` table. Bigger change, more joins, and the existing `products` rows for variations (if any) would need migration.
- **Option C:** Defer — treat all products as flat in v1, ship grouping later. UI spec explicitly requires grouping, so this pushes the UI ship.

Recommendation is A: minimal migration, matches how variations already appear in `products` today (via `product_type = 'variation'`), no data migration required beyond backfilling `parent_id` for any pre-existing variation rows (verify with `SELECT count(*) FROM products WHERE product_type = 'variation' AND parent_id IS NULL` after the migration).

### 2.2 Low-stock threshold

The UI's Stock Overview has a "low stock only" filter and expects each stock row to carry `is_low_stock: boolean`.

- **Option A (recommended):** Query-parameter driven, no schema change.
  Client passes `?low_stock_threshold=5` (default 5 if omitted). The API computes `is_low_stock = (stock_quantity > 0 AND stock_quantity <= threshold)`.
- **Option B:** Per-product column `low_stock_threshold INT` on `products`, with a global fallback.
  ```sql
  ALTER TABLE products ADD COLUMN low_stock_threshold INT;
  ```
  More flexible (per-SKU tuning) but requires UI to expose the setting; nothing in the current UI spec asks for that.
- **Option C:** Environment-only global threshold. Less discoverable, forces a redeploy to change.

Recommendation is A. If per-product tuning becomes a real request later, upgrade to B — the wire contract for `is_low_stock` doesn't change.

### 2.3 `stock_status` maintenance

`stock_status` is currently a manually-set text column. After a movement is inserted, it should reflect the new `stock_quantity` (roughly: `stock_quantity > 0 → 'instock'`, `= 0 → 'outofstock'`).

- **Option A (recommended):** Update `stock_status` in the same API transaction as the movement + quantity update. Rule: only touch `stock_status` when `manage_stock = true`. Never overwrite `'onbackorder'` (that's an operator-set state — API should skip when current value is `'onbackorder'`).
- **Option B:** Postgres trigger on `inventory_movements` INSERT. Keeps the rule out of app code, but harder to spot in reviews and doesn't cover direct `PUT /products/:id` edits.
- **Option C:** Derive on read (never store). Every query recomputes. Simpler write path, but the field on `products.stock_status` becomes a footgun (stale on direct SELECT).

Recommendation is A: keeps behavior visible in one service method that reviewers can read. Direct `PUT /products/:id` edits that change `stock_quantity` should also apply the same rule — worth a small tidy of the products service as part of this work.

### 2.4 Reason enum enforcement

Migration 016 lists reasons in a comment. UI adds `'damage'`. Options:

- **Option A (recommended):** Add a DB-level CHECK constraint.
  ```sql
  ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movements_reason
    CHECK (reason IN ('sale', 'restock', 'adjustment', 'return', 'damage'));
  ```
  Plus API-level DTO validation (double layer). Adding a new reason later requires a migration — acceptable friction for an audit table.
- **Option B:** Convert to a Postgres ENUM type. More rigid; ENUMs are annoying to extend.
- **Option C:** API-level validation only, no DB constraint. Cheaper today, but drift is easy.

Recommendation is A.

### 2.5 Non-negative `stock_quantity` guard

Belt-and-suspenders question. API-level check will exist regardless.

- **Option A (recommended):** Add a DB CHECK.
  ```sql
  ALTER TABLE products
    ADD CONSTRAINT chk_products_stock_quantity_non_negative
    CHECK (stock_quantity >= 0);
  ```
  Any bug that tries to go negative fails loudly (transaction rollback) instead of corrupting inventory.
- **Option B:** API-only.

Recommendation is A. Verify no existing row has negative stock before applying (`SELECT count(*) FROM products WHERE stock_quantity < 0`).

### 2.6 Concurrency: locking on adjust

Two concurrent adjust calls on the same product could both read `stock_quantity = 10`, both write `10 - 8 = 2`, losing one deduction.

- **Option A (recommended):** `SELECT ... FOR UPDATE` on the product row inside the transaction before computing the new quantity.
- **Option B:** Optimistic locking via a `version` column.
- **Option C:** Ignore — accept the race for v1.

Recommendation is A. Pessimistic lock is trivial to add and the operation is short.

### 2.7 Wire naming convention

Existing API uses `snake_case` in payloads (e.g. `stock_quantity`, `regular_price`). UI author wrote TS types in `camelCase`.

- **Option A (recommended):** Wire stays snake_case. UI client maps to camelCase in its own types. Consistency with the rest of the API.
- **Option B:** Inventory module uses camelCase. Breaks convention but matches the UI spec verbatim.

Recommendation is A. **The rest of this spec uses snake_case.** If Perry picks B, s/snake/camel across §5.

---

## 3. Proposed Migration 017

**File:** `db/migrations/017_inventory_prep.sql` (name TBD by Perry).

```sql
-- 017_inventory_prep.sql
-- Prep for inventory module: variation parent link, reason enum,
-- non-negative stock guard.

BEGIN;

-- 2.1 Variation parent link
ALTER TABLE products
  ADD COLUMN parent_id UUID REFERENCES products(id) ON DELETE CASCADE;

CREATE INDEX idx_products_parent
  ON products(parent_id)
  WHERE parent_id IS NOT NULL;

-- 2.4 Reason enum (matches app-layer enum)
ALTER TABLE inventory_movements
  ADD CONSTRAINT chk_inventory_movements_reason
  CHECK (reason IN ('sale', 'restock', 'adjustment', 'return', 'damage'));

-- 2.5 Non-negative stock guard
-- Perry: verify SELECT count(*) FROM products WHERE stock_quantity < 0 = 0 first.
ALTER TABLE products
  ADD CONSTRAINT chk_products_stock_quantity_non_negative
  CHECK (stock_quantity >= 0);

COMMIT;
```

Not included: 2.2 (query-param, no schema change), 2.3 (service-layer logic), 2.6 (query-time lock), 2.7 (naming).

---

## 4. Module Layout

```
src/modules/inventory/
├── inventory.module.ts
├── inventory.controller.ts
├── inventory.service.ts
└── dto/
    ├── list-stock.query.ts
    ├── list-movements.query.ts
    ├── create-movement.dto.ts
    └── movement-reason.enum.ts
```

Follows the existing `brands` / `products` module shape: controller thin, service holds the SQL and transactions, DTOs as interfaces validated by the global `ValidationPipe`.

`InventoryModule` imports `DatabaseModule` and `AuthModule` (for the guard + `@CurrentUser` decorator).

---

## 5. Endpoints

All endpoints require `@UseGuards(AuthGuard)`. Bearer token per existing convention.

### 5.1 `GET /inventory/stock`

List stock rows (simple products + variations only). Variable parents are excluded from the flat list — the UI groups variations under their parent client-side using the `parent_id` field.

**Query parameters** (all optional):

| Param | Type | Default | Notes |
|---|---|---|---|
| `search` | string | — | Case-insensitive match against `name` or `sku` |
| `low_stock_only` | boolean | `false` | Filters to rows where `is_low_stock = true` |
| `low_stock_threshold` | int | `5` | Inclusive upper bound for `is_low_stock` |
| `branch_id` | uuid | — | Reserved for multi-branch. v1: ignored server-side; document but no-op. See §7. |
| `limit` | int | `50` | Max `200` |
| `offset` | int | `0` | |

**Response** `200 OK`:

```json
{
  "items": [
    {
      "id": "…uuid…",
      "name": "Dog Food A - 1kg",
      "sku": "DOG-A-1KG",
      "product_type": "variation",
      "stock_quantity": 12,
      "manage_stock": true,
      "stock_status": "instock",
      "is_low_stock": false,
      "parent_id": "…uuid…",
      "parent_name": "Dog Food A"
    },
    {
      "id": "…uuid…",
      "name": "Cat Litter B",
      "sku": "CAT-B",
      "product_type": "simple",
      "stock_quantity": 3,
      "manage_stock": true,
      "stock_status": "instock",
      "is_low_stock": true,
      "parent_id": null,
      "parent_name": null
    }
  ],
  "total": 244,
  "limit": 50,
  "offset": 0
}
```

**Query sketch:**

```sql
SELECT
  p.id, p.name, p.sku, p.product_type,
  p.stock_quantity, p.manage_stock, p.stock_status,
  (p.manage_stock AND p.stock_quantity > 0 AND p.stock_quantity <= $threshold)
    AS is_low_stock,
  p.parent_id,
  parent.name AS parent_name
FROM products p
LEFT JOIN products parent ON parent.id = p.parent_id
WHERE p.product_type IN ('simple', 'variation')
  AND ($search IS NULL OR p.name ILIKE '%'||$search||'%' OR p.sku ILIKE '%'||$search||'%')
  AND (NOT $low_stock_only
       OR (p.manage_stock AND p.stock_quantity > 0 AND p.stock_quantity <= $threshold))
ORDER BY p.name
LIMIT $limit OFFSET $offset;
```

`total` comes from a second `COUNT(*)` query with the same WHERE (or window function; whichever the codebase already prefers).

### 5.2 `GET /inventory/stock/:product_id`

Single stock row. Same shape as an `items[]` entry above. `404` if the product doesn't exist or `product_type = 'variable'` (variables aren't stock-adjustable; UI should fetch children instead).

### 5.3 `GET /inventory/movements`

Audit log. Newest first.

**Query parameters** (all optional):

| Param | Type | Default | Notes |
|---|---|---|---|
| `product_id` | uuid | — | Exact match |
| `branch_id` | uuid | — | Exact match; `null` matches rows with `branch_id IS NULL` |
| `reason` | enum | — | One of `sale|restock|adjustment|return|damage` |
| `date_from` | ISO date (`YYYY-MM-DD`) or ISO datetime | — | Inclusive, treated as start-of-day in UTC if date-only |
| `date_to` | ISO date or datetime | — | Inclusive, treated as end-of-day in UTC if date-only |
| `limit` | int | `50` | Max `200` |
| `offset` | int | `0` | |

**Response** `200 OK`:

```json
{
  "items": [
    {
      "id": "…uuid…",
      "product_id": "…uuid…",
      "product_name": "Dog Food A - 1kg",
      "product_sku": "DOG-A-1KG",
      "branch_id": null,
      "branch_name": null,
      "quantity_change": -2,
      "reason": "sale",
      "reference_id": "…order uuid or null…",
      "note": null,
      "created_by": "…user uuid or null…",
      "created_by_name": "Perry",
      "created_at": "2026-08-08T14:32:11.000Z"
    }
  ],
  "total": 1523,
  "limit": 50,
  "offset": 0
}
```

`product_name`, `branch_name`, `created_by_name` are joined server-side to save the UI a round trip. `created_by_name` is `null` when `created_by IS NULL` (system-generated movements); the UI renders that as "System".

`date_to` earlier than `date_from` → `400 Bad Request`.

### 5.4 `GET /inventory/movements/:id`

Single movement row. Same shape as an `items[]` entry. `404` if not found.

### 5.5 `POST /inventory/movements`

Create a movement and atomically adjust the product's `stock_quantity`.

**Request body:**

```json
{
  "product_id": "…uuid…",
  "branch_id": null,
  "quantity_change": 20,
  "reason": "restock",
  "reference_id": null,
  "note": "Received restock from supplier"
}
```

**Validation** (DTO layer):

- `product_id`: required, uuid.
- `branch_id`: optional, uuid or null.
- `quantity_change`: required, integer, non-zero.
- `reason`: required, one of `restock | adjustment | return | damage`. **`sale` is rejected on this endpoint** (see §6.1).
- `reference_id`: optional, uuid or null.
- `note`: optional, string, max 500 chars.

**Validation** (service layer, before the DB transaction):

- Product exists and `product_type IN ('simple', 'variation')` → else `404 Not Found` (`"Product … not found or not stock-adjustable"`).
- Product has `manage_stock = true` → else `400` (`"Stock management is not enabled for this product"`).
- Reason–direction rule (§6.2) — else `400` with the specific mismatch message.

**Validation** (inside the DB transaction, after `SELECT ... FOR UPDATE`):

- New `stock_quantity = current + quantity_change` must be `>= 0` → else `400` with `"Insufficient stock: you can deduct at most {current}"`.

**Response** `201 Created`:

Same shape as a `GET /inventory/movements/:id` response, plus a top-level `stock_quantity` reflecting the product's new stock:

```json
{
  "movement": { "id": "…", "product_id": "…", "quantity_change": 20, "reason": "restock", "…": "…" },
  "stock_quantity": 32,
  "stock_status": "instock"
}
```

The UI uses `stock_quantity` (not local optimistic math) to update its view, per the UI spec's "Be careful with optimistic updates" principle.

**Errors:**

| Case | Status | `message` |
|---|---|---|
| Body validation fails | `400` | Nest default (array of validator messages) |
| Product not found or is `variable` | `404` | `Product "{id}" not found or not stock-adjustable` |
| `manage_stock = false` | `400` | `Stock management is not enabled for this product` |
| Reason–direction mismatch | `400` | `Reason "{reason}" requires a {positive|negative} quantity_change` |
| Would go negative | `400` | `Insufficient stock: you can deduct at most {current}` |
| `reason = 'sale'` posted via UI | `400` | `Reason "sale" is not accepted on this endpoint; sales are recorded by the checkout flow` |
| Missing/invalid bearer | `401` | Nest default |

All messages are surfaced verbatim to the UI (see UI spec §"Surface backend error messages verbatim").

---

## 6. Business Rules

### 6.1 `sale` is server-side only

The UI's Adjust Stock form deliberately excludes `sale` — sales come from the order checkout flow. The API enforces the same rule: `POST /inventory/movements` with `reason = 'sale'` from an authenticated user is rejected `400` with the message in §5.5.

The future orders integration will insert `inventory_movements` rows with `reason = 'sale'` inside the order-creation transaction, bypassing this endpoint. That path is out of scope for this spec.

### 6.2 Reason–direction rules

| `reason` | Required sign of `quantity_change` |
|---|---|
| `restock` | positive (`> 0`) |
| `return` | positive (`> 0`) |
| `damage` | negative (`< 0`) |
| `adjustment` | either (`≠ 0`) |
| `sale` | negative (`< 0`) — enforced only for server-side inserts (§6.1) |

Enforced in the service before the transaction. Zero is always rejected by the DTO validator.

### 6.3 Atomic adjust

Inside `DatabaseService.transaction`:

1. `SELECT id, stock_quantity, manage_stock, stock_status FROM products WHERE id = $1 FOR UPDATE`
2. Compute `new_qty = current + quantity_change`. If `new_qty < 0`, throw `400`.
3. `INSERT INTO inventory_movements (…) VALUES (…)`
4. `UPDATE products SET stock_quantity = $new_qty, stock_status = $derived_status, updated_at = now() WHERE id = $1`
5. Return both the movement row and the fresh product snapshot.

`$derived_status` rule (per §2.3):
- If `manage_stock = false`, don't touch `stock_status`.
- Else if current `stock_status = 'onbackorder'`, don't touch it.
- Else `stock_status = new_qty = 0 ? 'outofstock' : 'instock'`.

### 6.4 Idempotency

Not addressed in v1. The POS-completion-plan Task 2 introduces client-generated UUIDs for orders — a future revision of this spec should mirror that for movements (client-generated `id`, unique constraint, second POST returns the original row). Punt for now.

---

## 7. Branches

`branch_id` is nullable on `inventory_movements` and accepted on `POST` bodies. v1 clients omit it — every movement is store-wide.

The `GET` endpoints accept `branch_id` query param and match exactly (including `null` when the caller passes `branch_id=` empty). This means the API is ready for multi-branch without a schema change; the UI selector work is deferred.

Documented explicitly so future work doesn't have to guess whether the field is present.

---

## 8. Auth & Attribution

All endpoints: `@UseGuards(AuthGuard)`. `POST /inventory/movements` attributes `created_by` to `@CurrentUser().id` — client cannot override.

`created_by` on server-side movements (future orders integration) may be `null`. UI renders `null` as "System".

---

## 9. Testing

Unit tests (service level) must cover, at minimum:

1. Positive restock updates quantity + status + writes a movement row.
2. Negative adjustment exceeding stock returns `400` with the correct message and no writes (transaction rollback).
3. `manage_stock = false` product is rejected on POST but *is* returned by GET stock (with `is_low_stock = false`).
4. `reason = 'sale'` on POST is rejected `400`.
5. Reason–direction mismatch is rejected with the field-specific message.
6. `SELECT … FOR UPDATE` prevents lost updates under two concurrent adjusts (integration test with two transactions).
7. Variable product on `GET /inventory/stock/:id` returns `404`.
8. `date_to < date_from` on movements returns `400`.

E2E test (jest-e2e): full restock → GET stock reflects new quantity → GET movements includes the row.

Follow the existing test patterns in `services/` (per CLAUDE.md dev commands).

---

## 10. Open Questions for Perry

Numbered so replies can be short.

1. **Schema options (§2.1–2.7)** — approve the recommendations, or pick alternatives per item?
2. **Migration filename** — `017_inventory_prep.sql` OK, or a different name?
3. **`stock_status` on direct `PUT /products/:id`** — worth tidying the existing products service to apply the same derivation rule as §6.3, or leave for a separate task?
4. **Idempotency (§6.4)** — punt to a later revision, or bake in now (would require adding a client-supplied `id` and unique constraint)?
5. **Backfill** — after migration 017, do any pre-existing rows need cleanup (variations without a `parent_id`, products with negative stock)? Perry runs the check queries or delegates?
6. **Naming (§2.7)** — snake_case (default in this doc) or camelCase?

Once these are answered, implementation is: migration 017 → inventory module → tests → PR on a fresh branch (`feature/inventory-api`). No `src/` or `db/migrations/` writes happen before answers land.
