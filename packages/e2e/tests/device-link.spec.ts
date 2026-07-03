import { expect, test } from '@playwright/test';

import { addItem, openAccountMenu } from './helpers/actions';

test("a link code warns before replacing the second device's account, then swaps it", async ({
  browser,
}) => {
  const primaryContext = await browser.newContext();
  const primary = await primaryContext.newPage();
  await primary.goto('/');
  await addItem(primary, 'Сыр');

  await openAccountMenu(primary);
  await primary
    .getByRole('menuitem', { name: 'Подключить это устройство' })
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

  await openAccountMenu(secondary);
  await secondary
    .getByRole('menuitem', { name: 'Ввести код устройства' })
    .click();
  await secondary
    .getByPlaceholder('Код подключения устройства')
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
