import { buildApp } from '@/app';
import { openSqlite } from '@/db/connection';

const sqlite = openSqlite(process.env.DB_PATH);
const app = buildApp(sqlite);

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => app.log.info(`server listening on ${addr}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
