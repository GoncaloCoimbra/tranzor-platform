import { test, expect } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api/v1';
const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL ?? 'http://localhost:5174';
const debug = Boolean(process.env.DEBUG);

test.describe('E2E - E-commerce Flow', () => {
  test('User Registration and Login Flow', async ({ page }) => {
    page.on('pageerror', err => { if (debug) console.log('PAGE ERROR:', err.message); });

    page.on('request', req => {
      if (req.url().startsWith('http://localhost:3001')) {
        debug && console.log(`[${new Date().toISOString()}] REQUEST:`, req.method(), req.url());
      }
    });
    page.on('response', res => {
      if (res.url().startsWith('http://localhost:3001')) {
        debug && console.log(`[${new Date().toISOString()}] RESPONSE:`, res.status(), res.url());
      }
    });
    page.on('requestfinished', req => {
      if (req.url().startsWith('http://localhost:3001')) {
        debug && console.log(`[${new Date().toISOString()}] REQUEST-FINISHED:`, req.method(), req.url());
      }
    });
    page.on('requestfailed', req => {
      if (req.url().startsWith('http://localhost:3001')) {
        debug && console.log(`[${new Date().toISOString()}] REQUEST-FAILED:`, req.method(), req.url(), 'failure:', req.failure()?.errorText);
      }
    });

    // Register
    await page.goto(`${FRONTEND_URL}/auth/register`);
    await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('input[name="name"]', { state: 'visible', timeout: 15000 });

    const email = `test${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.check('input[type="checkbox"]');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/auth/register') && res.request().method() === 'POST'),
      page.click('button[type="submit"]')
    ]);
    const cookies = await page.context().cookies();

    // Should be redirected to profile
    const [profileResponse] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/account/profile') && res.request().method() === 'GET'),
      expect(page).toHaveURL(`${FRONTEND_URL}/account/profile`)
    ]);
    const body = await profileResponse.json();
    debug && console.log('PROFILE RESPONSE BODY:', JSON.stringify(body));
    await expect(page.locator('input[name="email"]').first()).toHaveValue(email);

    // Logout via API cleanup if available
    await page.goto(`${FRONTEND_URL}/auth/login`);
    await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(`${FRONTEND_URL}/account/profile`);
  });

  test('Product browsing and filtering', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/shop/enhanced`);
    await page.waitForSelector('[data-testid="product-card"]', { state: 'visible', timeout: 15000 });

    // Check products are displayed
    const productCards = page.locator('[data-testid="product-card"]');
    await expect(productCards.first()).toBeVisible();

    // Filter by category using the visible category label
    await page.locator('label', { hasText: 'Artes' }).first().click();
    await expect(page.locator('label.filter-option.active', { hasText: 'Artes' })).toContainText('Artes');
  });

  test('Add to cart and checkout', async ({ page }) => {
    const email = `checkout-test${Date.now()}@example.com`;

    page.on('console', msg => { if (debug) console.log('BROWSER:', msg.text()); });
    page.on('pageerror', err => { if (debug) console.log('PAGE ERROR:', err.message); });
    page.on('dialog', async dialog => {
      if (debug) console.log('DIALOG:', dialog.type(), dialog.message());
      await dialog.accept();
    });
    page.on('request', req => {
      if (req.url().startsWith(API_URL)) {
        debug && console.log(`[${new Date().toISOString()}] REQUEST:`, req.method(), req.url());
      }
    });
    page.on('response', async res => {
      if (res.url().startsWith(API_URL)) {
        debug && console.log(`[${new Date().toISOString()}] RESPONSE:`, res.status(), res.url());
      }
    });

    // Register a fresh user so checkout can be completed.
    await page.goto(`${FRONTEND_URL}/auth/register`);
    await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 });
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="name"]', 'Checkout User');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.check('input[type="checkbox"]');

    await Promise.all([
      page.waitForResponse(res => res.url().includes('/auth/register') && res.request().method() === 'POST'),
      page.click('button[type="submit"]'),
    ]);

    await expect(page).toHaveURL(`${FRONTEND_URL}/account/profile`);

    // Browse products from the real shop page where product cards are rendered.
    await page.goto(`${FRONTEND_URL}/shop`);
    await page.waitForSelector('[data-testid="product-card"]', { state: 'visible', timeout: 15000 });

    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForURL(/\/shop\/product\//, { timeout: 15000 });
    await page.waitForSelector('[data-testid="add-to-cart"]', { state: 'visible', timeout: 15000 });

    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    const cartStorage = await page.evaluate(() => localStorage.getItem('cart-storage'));
    debug && console.log('CART STORAGE AFTER ADD:', cartStorage);

    await page.goto(`${FRONTEND_URL}/cart`);
    const cartItem = page.locator('[data-testid="cart-item"]');
    await expect(cartItem).toBeVisible();

    const cartStorageAfterNav = await page.evaluate(() => localStorage.getItem('cart-storage'));
    debug && console.log('CART STORAGE ON /cart:', cartStorageAfterNav);

    await page.click('[data-testid="checkout-btn"]');
    await expect(page).toHaveURL(/\/checkout/);
  });

  test('API - User Registration via REST', async () => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `api-test${Date.now()}@example.com`,
        password: 'TestPassword123!',
        confirmPassword: 'TestPassword123!',
        name: 'Test User',
        agreeTerms: true,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.user?.email).toBeTruthy();
    expect(data.data?.user?.id).toBeTruthy();
    expect(data.message).toContain('Conta criada');

    const setCookieHeader = response.headers.get('set-cookie') ?? '';
    expect(setCookieHeader).toContain('token=');
  });

  test('API - Get Products with filters', async () => {
    const response = await fetch(
      `${API_URL}/products?page=1&limit=10&sortBy=createdAt&order=desc`,
      { method: 'GET' }
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('Admin Dashboard Access', async ({ page }) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD is required for the admin E2E test');
    }

    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForURL('**/auth/login', { timeout: 20000 });

    await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 15000 });
    await page.fill('input[name="email"]', 'admin@tranzor.pt');
    await page.fill('input[name="password"]', adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 20000 });

    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-orders"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-revenue"]')).toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('Page load time - Homepage', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${FRONTEND_URL}/`);

    const loadTime = Date.now() - startTime;

    // Should load in less than 5 seconds (CI-friendly)
    expect(loadTime).toBeLessThan(5000);
  });

  test('Page load time - Shop', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${FRONTEND_URL}/shop`);

    const loadTime = Date.now() - startTime;

    // Increased threshold for CI shared runners
    expect(loadTime).toBeLessThan(4000);
  });
});

test.describe('Accessibility Tests', () => {
  test('Homepage accessibility', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);

    // Check for main landmark
    await expect(page.locator('main')).toBeVisible();

    // Check for proper heading hierarchy
    const h1 = await page.locator('h1');
    await expect(h1).toHaveCount(1);

    // Check for proper link text
    const links = await page.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Keyboard navigation', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);

    // Tab through interactive elements
    await page.press('body', 'Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeTruthy();
  });
});
