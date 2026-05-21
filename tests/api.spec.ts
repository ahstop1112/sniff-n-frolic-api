import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

// ─── Products ─────────────────────────────────────────────────────────────────

test.describe('GET /products', () => {
  test('returns array of products', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('returns correct product shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products`);
    const data = await res.json();
    const product = data[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('slug');
    expect(product).toHaveProperty('regular_price');
    expect(product).toHaveProperty('effective_price');
    expect(product).toHaveProperty('status');
    expect(product).toHaveProperty('stock_status');
  });

  test('supports pagination', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?page=1&limit=5`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBeLessThanOrEqual(5);
  });

  test('filters by category slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?category=pet-treats`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('filters by search', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?search=chicken`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    for (const p of data) {
      expect(p.name.toLowerCase()).toContain('chicken');
    }
  });

  test('returns empty array for unknown category', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products?category=this-does-not-exist`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  test('prices are in cents (integers)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products`);
    const data = await res.json();
    for (const p of data) {
      expect(Number.isInteger(p.regular_price)).toBe(true);
      expect(Number.isInteger(p.effective_price)).toBe(true);
    }
  });
});

test.describe('GET /products/:slug', () => {
  test('returns product by slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/chicken-breast-dehydrated-pet-treats`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('chicken-breast-dehydrated-pet-treats');
    expect(data).toHaveProperty('description');
    expect(data).toHaveProperty('images');
  });

  test('returns 404 for unknown slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/this-product-does-not-exist`);
    expect(res.status()).toBe(404);
  });

  test('includes images array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/chicken-breast-dehydrated-pet-treats`);
    const data = await res.json();
    expect(Array.isArray(data.images)).toBe(true);
    if (data.images.length > 0) {
      expect(data.images[0]).toHaveProperty('url');
      expect(data.images[0]).toHaveProperty('is_featured');
    }
  });

  test('includes categories array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/chicken-breast-dehydrated-pet-treats`);
    const data = await res.json();
    expect(Array.isArray(data.categories)).toBe(true);
    if (data.categories.length > 0) {
      expect(data.categories[0]).toHaveProperty('id');
      expect(data.categories[0]).toHaveProperty('name');
      expect(data.categories[0]).toHaveProperty('slug');
    }
  });

  test('includes brands array', async ({ request }) => {
    const res = await request.get(`${API_BASE}/products/chicken-breast-dehydrated-pet-treats`);
    const data = await res.json();
    expect(Array.isArray(data.brands)).toBe(true);
    if (data.brands.length > 0) {
      expect(data.brands[0]).toHaveProperty('id');
      expect(data.brands[0]).toHaveProperty('name');
      expect(data.brands[0]).toHaveProperty('slug');
    }
  });
});

// ─── Categories ───────────────────────────────────────────────────────────────

test.describe('GET /categories', () => {
  test('returns array of categories', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('returns correct category shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories`);
    const data = await res.json();
    const category = data[0];
    expect(category).toHaveProperty('id');
    expect(category).toHaveProperty('name');
    expect(category).toHaveProperty('slug');
    expect(category).toHaveProperty('count');
    expect(category).toHaveProperty('parent_slug');
  });

  test('includes image_url', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories`);
    const data = await res.json();
    const withImage = data.filter((c: any) => c.image_url !== null);
    expect(withImage.length).toBeGreaterThan(0);
  });

  test('has top-level and subcategories', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories`);
    const data = await res.json();
    const topLevel = data.filter((c: any) => c.parent_slug === null);
    const children = data.filter((c: any) => c.parent_slug !== null);
    expect(topLevel.length).toBeGreaterThan(0);
    expect(children.length).toBeGreaterThan(0);
  });
});

test.describe('GET /categories/:slug', () => {
  test('returns category by slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories/pet-treats`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('pet-treats');
    expect(data.name).toBeTruthy();
  });

  test('returns subcategory by slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories/slow-feeders`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('slow-feeders');
  });

  test('returns 404 for unknown slug', async ({ request }) => {
    const res = await request.get(`${API_BASE}/categories/this-does-not-exist`);
    expect(res.status()).toBe(404);
  });
});

// ─── Brands ───────────────────────────────────────────────────────────────────

test.describe('GET /brands', () => {
  test('returns array of brands', async ({ request }) => {
    const res = await request.get(`${API_BASE}/brands`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('returns correct brand shape', async ({ request }) => {
    const res = await request.get(`${API_BASE}/brands`);
    const data = await res.json();
    const brand = data[0];
    expect(brand).toHaveProperty('id');
    expect(brand).toHaveProperty('name');
    expect(brand).toHaveProperty('slug');
  });

  test('returns brands sorted by name', async ({ request }) => {
    const res = await request.get(`${API_BASE}/brands`);
    const data = await res.json();
    const names = data.map((b: any) => b.name as string)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))
    expect(names).toEqual(sorted)
  });
});

test.describe('POST /brands', () => {
  test('creates a new brand', async ({ request }) => {
    const res = await request.post(`${API_BASE}/brands`, {
      data: { name: 'Test Brand E2E' },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('id');
    expect(data.name).toBe('Test Brand E2E');
    expect(data.slug).toBe('test-brand-e2e');
  });

  test('auto-generates slug from name', async ({ request }) => {
    const res = await request.post(`${API_BASE}/brands`, {
      data: { name: 'My Test Brand 123' },
    });
    const data = await res.json();
    expect(data.slug).toBe('my-test-brand-123');
  });
});

test.describe('PUT /brands/:id', () => {
  test('updates brand name', async ({ request }) => {
    // Create first
    const createRes = await request.post(`${API_BASE}/brands`, {
      data: { name: 'Brand To Update' },
    });
    const created = await createRes.json();

    // Update
    const updateRes = await request.put(`${API_BASE}/brands/${created.id}`, {
      data: { name: 'Updated Brand Name' },
    });
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe('Updated Brand Name');
  });

  test('returns 404 for unknown id', async ({ request }) => {
    const res = await request.put(`${API_BASE}/brands/00000000-0000-0000-0000-000000000000`, {
      data: { name: 'Ghost Brand' },
    });
    expect(res.status()).toBe(404);
  });
});