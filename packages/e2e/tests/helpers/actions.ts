import { expect, type Page } from '@playwright/test';

export async function addItem(page: Page, name: string): Promise<void> {
  const input = page.getByPlaceholder('Добавить товар');
  await input.fill(name);
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name })).toBeVisible();
}

export async function toggleItem(page: Page, name: string): Promise<void> {
  await page.getByRole('checkbox', { name }).click();
}

export async function openEditor(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: `Редактировать ${name}` }).click();
}

export async function setQuantity(page: Page, delta: number): Promise<void> {
  const label = delta > 0 ? 'Увеличить количество' : 'Уменьшить количество';
  const button = page.getByRole('button', { name: label });
  for (let i = 0; i < Math.abs(delta); i++) {
    await button.click();
  }
}

export async function pickCategory(page: Page, chipLabel: string): Promise<void> {
  await page.getByText(chipLabel, { exact: true }).click();
}

export async function deleteItem(page: Page, name: string): Promise<void> {
  await openEditor(page, name);
  await page.getByRole('button', { name: 'Удалить' }).click();
}

export async function openListMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Меню списка' }).click();
}

export async function openListSwitcher(page: Page, currentListName: string): Promise<void> {
  await page.getByRole('button', { name: currentListName }).click();
}
