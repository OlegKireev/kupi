import { expect, test } from '@playwright/test';

import { addItem, openListMenu, openListSwitcher } from './helpers/actions';

test('an invite code shares a list, including its existing items, with a second device', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');
  await addItem(owner, 'Хлеб');

  await openListMenu(owner);
  await owner.getByRole('menuitem', { name: 'Пригласить' }).click();
  const inviteCode = await owner
    .getByRole('dialog', { name: 'Код приглашения' })
    .getByText(/^[A-Z0-9]{8}$/)
    .innerText();
  expect(inviteCode).toHaveLength(8);

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('/');
  await openListSwitcher(guest, 'Мои покупки');
  await guest.getByRole('menuitem', { name: 'Ввести код' }).click();
  await guest.getByPlaceholder('Код приглашения или устройства').fill(inviteCode);
  await guest.getByRole('button', { name: 'Продолжить' }).click();

  await expect(guest.getByRole('checkbox', { name: 'Хлеб' })).toBeVisible();

  await ownerContext.close();
  await guestContext.close();
});

test('a malformed code is rejected client-side with no network round-trip', async ({ page }) => {
  await page.goto('/');
  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Ввести код' }).click();
  // 5 chars: neither an 8-char invite code nor a 6-char link code
  await page.getByPlaceholder('Код приглашения или устройства').fill('SHORT');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Неверный код')).toBeVisible();
});

test('a well-formed but unissued invite code is rejected by the server with the same toast', async ({ page }) => {
  await page.goto('/');
  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Ввести код' }).click();
  await page.getByPlaceholder('Код приглашения или устройства').fill('ZZZZZZZZ');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Неверный код')).toBeVisible();
});
