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

export async function pickCategory(
  page: Page,
  chipLabel: string,
): Promise<void> {
  await page.getByText(chipLabel, { exact: true }).click();
}

export async function deleteItem(page: Page, name: string): Promise<void> {
  await openEditor(page, name);
  await page.getByRole('button', { name: 'Удалить' }).click();
}

export async function openListMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Меню списка' }).click();
}

export async function openListSwitcher(
  page: Page,
  currentListName: string,
): Promise<void> {
  await page.getByRole('button', { name: currentListName }).click();
}

/** Owner создаёт инвайт-код, guest вводит его — оба заканчивают на одном общем списке. */
export async function shareList(owner: Page, guest: Page): Promise<void> {
  await openListMenu(owner);
  await owner.getByRole('menuitem', { name: 'Пригласить' }).click();
  const inviteCode = await owner
    .getByRole('dialog', { name: 'Код приглашения' })
    .getByText(/^[A-Z0-9]{8}$/)
    .innerText();
  await owner.keyboard.press('Escape'); // Mantine Modal closes on Escape by default

  await openListSwitcher(guest, 'Мои покупки');
  await guest.getByRole('menuitem', { name: 'Ввести код' }).click();
  await guest
    .getByPlaceholder('Код приглашения или устройства')
    .fill(inviteCode);
  await guest.getByRole('button', { name: 'Продолжить' }).click();
}
