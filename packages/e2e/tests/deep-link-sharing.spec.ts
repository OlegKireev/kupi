import { expect, test } from '@playwright/test';

import { addItem, openAccountMenu, openListSwitcher } from './helpers/actions';

test('opening a list invite link on a second device auto-opens the join dialog, pre-filled', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');
  await addItem(owner, 'Хлеб');

  await openListSwitcher(owner, 'Мои покупки');
  await owner.getByRole('menuitem', { name: 'Пригласить в список' }).click();
  const inviteDialog = owner.getByRole('dialog', { name: 'Код приглашения' });
  await expect(
    inviteDialog.getByRole('img', { name: 'QR-код' }),
  ).toBeVisible();
  const inviteCode = await inviteDialog
    .getByText(/^[A-Z0-9]{8}$/)
    .innerText();
  await owner.keyboard.press('Escape');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/?listCode=${inviteCode}`);

  const joinDialog = guest.getByRole('dialog', {
    name: 'Присоединиться по коду списка',
  });
  await expect(joinDialog).toBeVisible();
  await expect(guest.getByPlaceholder('Код приглашения')).toHaveValue(
    inviteCode,
  );
  await joinDialog.getByRole('button', { name: 'Продолжить' }).click();

  await expect(guest.getByRole('checkbox', { name: 'Хлеб' })).toBeVisible();

  // диплинк-параметр сбрасывается из URL при обработке — reload не должен
  // открыть модалку повторно
  await guest.reload();
  await expect(
    guest.getByRole('dialog', { name: 'Присоединиться по коду списка' }),
  ).toBeHidden();

  await ownerContext.close();
  await guestContext.close();
});

test('opening a device link on a fresh browser skips straight to the warning dialog', async ({
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

  const secondaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  await secondary.goto(`/?deviceCode=${linkCode}`);

  // диплинк пропускает шаг ручного ввода — сразу предупреждающая модалка,
  // без промежуточного «Ввести код устройства»
  const warningDialog = secondary.getByRole('dialog', {
    name: 'Подключить устройство?',
  });
  await expect(warningDialog).toBeVisible();
  await warningDialog.getByRole('button', { name: 'Подключить' }).click();

  await expect(secondary.getByRole('checkbox', { name: 'Сыр' })).toBeVisible();

  await primaryContext.close();
  await secondaryContext.close();
});
