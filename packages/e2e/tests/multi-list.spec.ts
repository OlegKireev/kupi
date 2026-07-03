import { expect, test } from '@playwright/test';

import { openListMenu, openListSwitcher } from './helpers/actions';

test('create a list, switch between lists, rename, then delete back to another existing list', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Новый список' }).click();
  await page.getByPlaceholder('Название списка').fill('Дача');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByRole('button', { name: 'Дача' })).toBeVisible();

  await openListSwitcher(page, 'Дача');
  await page.getByRole('menuitem', { name: 'Мои покупки' }).click();
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListSwitcher(page, 'Мои покупки');
  await page.getByRole('menuitem', { name: 'Дача' }).click();
  await expect(page.getByRole('button', { name: 'Дача' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Переименовать список' }).click();
  const renameDialog = page.getByRole('dialog', {
    name: 'Переименовать список',
  });
  await renameDialog.getByRole('textbox').fill('Дача 2.0');
  await renameDialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('button', { name: 'Дача 2.0' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Удалить/покинуть список' }).click();
  const deleteDialog = page.getByRole('dialog', {
    name: 'Удалить/покинуть список?',
  });
  await deleteDialog.getByRole('button', { name: 'Подтвердить' }).click();

  // "Дача 2.0" is gone, the untouched default list is still there
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});

test('deleting the last remaining list falls back to a fresh default list', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await openListMenu(page);
  await page.getByRole('menuitem', { name: 'Удалить/покинуть список' }).click();
  await page
    .getByRole('dialog', { name: 'Удалить/покинуть список?' })
    .getByRole('button', { name: 'Подтвердить' })
    .click();

  // App.tsx's refreshLists() creates a fresh "Мои покупки" list when none remain
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});
