import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SqliteEventStore } from "@zmind-plus/store";

import { createRuntime } from "./server";

const host = process.env.ZMIND_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.ZMIND_PORT ?? "4311", 10);
const databasePath = resolve(
  process.env.ZMIND_DATABASE_PATH ?? ".zmind-plus/events.db",
);
const allowedOrigins = (
  process.env.ZMIND_UI_ORIGINS ?? "http://127.0.0.1:4310,http://localhost:4310"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

mkdirSync(dirname(databasePath), { recursive: true });
const store = new SqliteEventStore(databasePath);
const app = createRuntime({
  store,
  allowedOrigins,
});

const shutdown = async () => {
  await app.close();
  store.close();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host, port });
console.log(`Zmind+ runtime ready at http://${host}:${port}`);
