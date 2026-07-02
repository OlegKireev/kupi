import { rm } from 'node:fs/promises';

import { tmpDbPath } from './tests/tmp-db';

export default async function globalTeardown(): Promise<void> {
  await Promise.all(
    ['', '-wal', '-shm', '-journal'].map((suffix) =>
      rm(`${tmpDbPath}${suffix}`, { force: true }),
    ),
  );
}
