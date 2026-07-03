import { buildApp } from '@/app';
import { openSqlite } from '@/db/connection';
import { purgeStaleData } from '@/db/purge';

const sqlite = openSqlite(process.env.DB_PATH);
const app = await buildApp(sqlite);

// buildApp уже сделал один прогон при старте — здесь только периодический
// повтор для долгоживущего процесса, раз в сутки.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
setInterval(() => void purgeStaleData(app.db), ONE_DAY_MS).unref();

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => app.log.info(`server listening on ${addr}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
