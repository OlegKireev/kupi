import { expect, type Page, test } from '@playwright/test';

import {
  addItem,
  deleteItem,
  openEditor,
  openListMenu,
  pickCategory,
  setQuantity,
  shareList,
  toggleItem,
} from './helpers/actions';

// Нет push/websocket — второе устройство узнаёт о чужих изменениях только на
// mount или 'online' (см. useItemSync), поэтому каждая межустройственная
// проверка ниже — reload + опрос, как в offline-sync.spec.ts: пишущее
// устройство не ждёт, пока его flush долетит до сервера.
async function afterReload(page: Page, isReady: () => Promise<boolean>): Promise<void> {
  await expect
    .poll(async () => {
      await page.reload();
      return isReady();
    })
    .toBe(true);
}

test('add, toggle, edit, and delete on a shared list propagate to the other device after reload', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('/');
  await shareList(owner, guest);

  await addItem(owner, 'Йогурт');
  await afterReload(guest, () => guest.getByRole('checkbox', { name: 'Йогурт' }).isVisible());

  await toggleItem(guest, 'Йогурт');
  await afterReload(owner, () => owner.getByRole('checkbox', { name: 'Йогурт' }).isChecked());

  await openEditor(owner, 'Йогурт');
  await setQuantity(owner, 2); // 1 -> 3
  await pickCategory(owner, '🥛 Молочное');

  await afterReload(guest, () => guest.getByText('(3)').isVisible());
  await openEditor(guest, 'Йогурт');
  await expect(guest.getByRole('radio', { name: '🥛 Молочное' })).toBeChecked();
  await openEditor(guest, 'Йогурт'); // close it back before deleteItem opens it itself

  await deleteItem(guest, 'Йогурт');
  await afterReload(owner, async () => (await owner.getByRole('checkbox', { name: 'Йогурт' }).count()) === 0);

  await ownerContext.close();
  await guestContext.close();
});

test('changes from both devices accumulate correctly across a three-hop round trip (owner → guest → owner)', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('/');
  await shareList(owner, guest);

  // hop 1: owner adds an item
  await addItem(owner, 'Молоко');

  // hop 2: guest syncs (picks up owner's item), then adds their own —
  // guest's own list must be the union of both, not just their own addition
  await afterReload(guest, () => guest.getByRole('checkbox', { name: 'Молоко' }).isVisible());
  await addItem(guest, 'Хлеб');
  await expect(guest.getByRole('checkbox')).toHaveCount(2);

  // hop 3: owner syncs back — must see guest's item on top of their own,
  // neither side's change should have clobbered the other's
  await afterReload(owner, () => owner.getByRole('checkbox', { name: 'Хлеб' }).isVisible());
  await expect(owner.getByRole('checkbox', { name: 'Молоко' })).toBeVisible();
  await expect(owner.getByRole('checkbox')).toHaveCount(2);

  // owner acts on guest's item; guest's next sync must reflect it without
  // losing either item
  await toggleItem(owner, 'Хлеб');
  await afterReload(guest, () => guest.getByRole('checkbox', { name: 'Хлеб' }).isChecked());
  await expect(guest.getByRole('checkbox', { name: 'Молоко' })).toBeVisible();
  await expect(guest.getByRole('checkbox')).toHaveCount(2);

  await ownerContext.close();
  await guestContext.close();
});

test('a list deleted by its owner disappears for a member on next sync, falling back to their own list', async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto('/');
  await addItem(owner, 'Сыр');

  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto('/');
  await shareList(owner, guest);
  await expect(guest.getByRole('checkbox', { name: 'Сыр' })).toBeVisible();

  await openListMenu(owner);
  await owner.getByRole('menuitem', { name: 'Удалить/покинуть список' }).click();
  await owner
    .getByRole('dialog', { name: 'Удалить/покинуть список?' })
    .getByRole('button', { name: 'Подтвердить' })
    .click();

  // список пропал из GET /lists у guest — App.tsx откатывается на первый
  // оставшийся список, тот самый дефолтный "Мои покупки", созданный при
  // бутстрапе guest ещё до shareList
  await afterReload(guest, async () => (await guest.getByRole('checkbox', { name: 'Сыр' }).count()) === 0);
  await expect(guest.getByRole('button', { name: 'Мои покупки' })).toBeVisible();

  await ownerContext.close();
  await guestContext.close();
});
