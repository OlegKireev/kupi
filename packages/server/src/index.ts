import { openDb } from "./db.ts";
import { buildApp } from "./app.ts";

const db = openDb();
const app = buildApp(db);

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .then((addr) => app.log.info(`server listening on ${addr}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
