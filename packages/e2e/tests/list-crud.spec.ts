import { expect, test } from '@playwright/test';

import {
  addItem,
  deleteItem,
  openEditor,
  pickCategory,
  setQuantity,
  toggleItem,
} from './helpers/actions';

test('a fresh device bootstraps an account with a default list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Мои покупки' })).toBeVisible();
});

test('add (with autocomplete), check, edit quantity/category, and delete an item', async ({
  page,
}) => {
  await page.goto('/');

  await addItem(page, 'Молоко');

  // adding an item feeds item_frequency — re-typing a prefix now suggests it
  const input = page.getByPlaceholder('Добавить товар');
  await input.fill('Мол');
  await expect(page.getByRole('option', { name: /молоко/i })).toBeVisible();
  await input.fill('');

  await toggleItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).toBeChecked();
  await toggleItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).not.toBeChecked();

  await openEditor(page, 'Молоко');
  await setQuantity(page, 2); // 1 -> 3
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await pickCategory(page, '🥛 Молочное');
  await expect(page.getByRole('radio', { name: '🥛 Молочное' })).toBeChecked();

  // the editor is still open from the openEditor() call above; deleteItem's
  // helper opens the editor itself (see helpers/actions.ts), so close it
  // first here — otherwise that second openEditor call toggles it shut.
  await openEditor(page, 'Молоко');

  await deleteItem(page, 'Молоко');
  await expect(page.getByRole('checkbox', { name: 'Молоко' })).toHaveCount(0);
});
