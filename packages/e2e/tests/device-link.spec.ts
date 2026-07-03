import { expect, test } from '@playwright/test';

import { addItem, openListMenu, openListSwitcher } from './helpers/actions';

test("a link code warns before replacing the second device's account, then swaps it", async ({
  browser,
}) => {
  const primaryContext = await browser.newContext();
  const primary = await primaryContext.newPage();
  await primary.goto('/');
  await addItem(primary, 'Сыр');

  await openListMenu(primary);
  await primary
    .getByRole('menuitem', { name: 'Подключить устройство' })
    .click();
  const linkCode = await primary
    .getByRole('dialog', { name: 'Код подключения устройства' })
    .getByText(/^[A-Z0-9]{6}$/)
    .innerText();
  expect(linkCode).toHaveLength(6);

  const secondaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  await secondary.goto('/');
  // starts on its own separate default list — doesn't see the primary's item yet
  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toHaveCount(0);

  await openListSwitcher(secondary, 'Мои покупки');
  await secondary.getByRole('menuitem', { name: 'Ввести код' }).click();
  await secondary
    .getByPlaceholder('Код приглашения или устройства')
    .fill(linkCode);
  await secondary.getByRole('button', { name: 'Продолжить' }).click();

  const warningDialog = secondary.getByRole('dialog', {
    name: 'Подключить устройство?',
  });
  await expect(warningDialog).toBeVisible();
  await warningDialog.getByRole('button', { name: 'Подключить' }).click();

  // the secondary device's account/lists/items are now the primary's
  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toBeVisible();

  await primaryContext.close();
  await secondaryContext.close();
});
