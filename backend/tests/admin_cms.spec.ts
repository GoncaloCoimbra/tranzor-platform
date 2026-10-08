import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL ?? 'http://localhost:5174';
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001/api/v1';
const ADMIN_EMAIL = 'admin@tranzor.pt';

function getAdminPassword() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD is required for admin CMS E2E tests');
  }
  return password;
}

async function signInAdmin(page: Parameters<typeof test>[0]['page']) {
  const adminPassword = getAdminPassword();
  const response = await page.request.post(`${API_URL}/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: ADMIN_EMAIL, password: adminPassword },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBeTruthy();
  expect(body.data.token).toBeTruthy();

  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
  }, body.data.token);

  await page.goto(`${FRONTEND_URL}/admin/content`, { waitUntil: 'networkidle' });
}

test.describe('Admin CMS basic checks', () => {
  test('Admin can access Content and Coupons pages', async ({ page }) => {
    await signInAdmin(page);

    await page.goto(`${FRONTEND_URL}/admin/content`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1.adm-title', { state: 'visible', timeout: 15000 });
    await expect(page.locator('h1.adm-title')).toHaveText(/Gestão de conteúdos/i);

    await page.goto(`${FRONTEND_URL}/admin/coupons`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1.adm-title', { state: 'visible', timeout: 15000 });
    await expect(page.locator('h1.adm-title')).toHaveText(/Cupões de desconto/i);
  });
});
