# Sniff N Frolic API

A unified NestJS backend powering both a retail point-of-sale system and an e-commerce store for Sniff N Frolic — a Canadian pet lifestyle brand.

## Overview

This API serves as the single source of truth for two client applications:

- **sniff-n-frolic-store** — Next.js e-commerce storefront (Vercel)
- **sniff-n-frolic-pos** — React.js in-store point-of-sale system

Both clients share the same product catalogue, category structure, order management, and membership system through this API, replacing a previous dependency on WooCommerce.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL 16 |
| Testing | Playwright (API tests) |
| Deploy | Railway |
| Clients | Next.js (Vercel) + React.js POS |

## Architecture

```
sniff-n-frolic-store (Next.js / Vercel)  ─┐
                                           ├──→ sniff-n-frolic-api (NestJS / Railway) ──→ PostgreSQL
sniff-n-frolic-pos (React.js)            ─┘
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL=postgresql://snf:postgres@localhost:5432/sniff_n_frolic
WOO_API_BASE_URL=https://your-site.com/wp-json/wc/v3
WOO_CONSUMER_KEY=ck_xxx
WOO_CONSUMER_SECRET=cs_xxx
PORT=4000
```

### Start the database

```bash
npm run db:up
```

### Run migrations

```bash
for f in db/migrations/*.sql; do
  psql $DATABASE_URL -f "$f"
done
```

### Start the API

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

API runs on `http://localhost:4000` by default.

## API Endpoints

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/products` | List products (`?page`, `?limit`, `?category`, `?search`) |
| `GET` | `/products/:slug` | Get product by slug |
| `POST` | `/products/import/woocommerce` | Sync products from WooCommerce |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/categories` | List all categories |
| `GET` | `/categories/:slug` | Get category by slug |
| `POST` | `/categories/import/woocommerce` | Sync categories from WooCommerce |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/request-code` | Request email login code |
| `POST` | `/auth/verify-code` | Verify login code and issue JWT |
| `GET` | `/auth/me` | Get current authenticated user |
| `POST` | `/auth/logout` | Logout |

## Database Schema

```
users                 → Staff accounts (POS)
roles                 → Staff roles and permissions
members               → Customer accounts (store)
product_categories    → Categories with subcategory support
products              → Shared product catalogue
product_images        → Product image gallery
product_category_map  → Product ↔ category (many-to-many)
orders                → Orders from POS and online store
order_items           → Line items per order
```

Migrations live in `db/migrations/` and run in numbered order (`001_`, `002_`, ...).

## WooCommerce Sync

Products and categories are periodically synced from WooCommerce into PostgreSQL. The platform is progressively reducing its WooCommerce dependency — all WooCommerce-specific columns are isolated and can be removed in a single migration when no longer needed.

```bash
# Sync categories first
curl -X POST http://localhost:4000/categories/import/woocommerce

# Then sync products
curl -X POST http://localhost:4000/products/import/woocommerce
```

## Testing

API tests are written with Playwright and cover all major endpoints including products, categories, filtering, pagination, and error handling.

```bash
# Run API tests
npx playwright test tests/api.spec.ts

# Interactive UI
npx playwright test --ui
```

Tests run automatically on push to `main` via GitHub Actions.

## Deployment

Deployed on Railway with a managed PostgreSQL instance. Migrations run automatically before each deployment via `migrate.sh`.

### Docker

```bash
# Build
docker build -t sniff-n-frolic-api .

# Run
docker run -p 4000:3000 --env-file .env sniff-n-frolic-api
```

## Related Repos

- [`sniff-n-frolic-store`](https://github.com/ahstop1112/sniff-n-frolic-nextjs-store) — Next.js e-commerce storefront
- [`sniff-n-frolic-pos`](https://github.com/ahstop1112/sniff-n-frolic-pos) — React.js point-of-sale