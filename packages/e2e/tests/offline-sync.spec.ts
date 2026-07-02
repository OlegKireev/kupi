import { expect, test } from '@playwright/test';

import { addItem, toggleItem } from './helpers/actions';

test('offline changes apply optimistically and flush to the server once back online', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await addItem(page, 'Йогурт'); // flushes immediately — the device is online

  await context.setOffline(true);
  await toggleItem(page, 'Йогурт');
  // optimistic local patch applies immediately, no network needed
  await expect(page.getByRole('checkbox', { name: 'Йогурт' })).toBeChecked();

  // reusing the auth cookie in a new context simulates a second device on the same
  // account. Deliberately NOT `context.storageState()`: that snapshot bundles
  // localStorage too, which would leak this device's offline-queue cache (including
  // the not-yet-flushed toggle) into the "other" context and make it look like the
  // change already reached the server. A real second device only shares the cookie.
  const cookies = await context.cookies();
  const otherContext = await browser.newContext({ storageState: { cookies, origins: [] } });
  const otherPage = await otherContext.newPage();
  await otherPage.goto('/');
  // the toggle is still queued on the offline device, hasn't reached the server yet
  await expect(otherPage.getByRole('checkbox', { name: 'Йогурт' })).not.toBeChecked();

  await context.setOffline(false); // fires the 'online' window event, which triggers a flush

  await expect
    .poll(async () => {
      await otherPage.reload();
      return otherPage.getByRole('checkbox', { name: 'Йогурт' }).isChecked();
    })
    .toBe(true);

  await context.close();
  await otherContext.close();
});
