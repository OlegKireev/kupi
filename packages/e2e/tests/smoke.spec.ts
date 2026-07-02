import { expect, test } from '@playwright/test';

test('the app boots on the isolated e2e ports', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});
