import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL ?? 'http://localhost:5174';

test.describe('B2B Quote Request Flow', () => {
  test('should submit a B2B quote request successfully', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/b2b/quote-request`);

    await page.fill('input[name="companyName"]', 'Empresa Teste B2B');
    await page.fill('input[name="contactName"]', 'João Silva');
    await page.fill('input[name="email"]', 'b2b-test@example.com');
    await page.fill('input[name="phone"]', '+351910000000');
    await page.selectOption('select[name="category"]', 'papelaria');
    await page.fill('input[name="quantity"]', '120');
    await page.fill('textarea[name="description"]', 'Solicitação de materiais escolares para 120 unidades.');

    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-success')).toHaveText(/Orçamento solicitado com sucesso/i);
  });
});
