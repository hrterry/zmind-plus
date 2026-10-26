import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SqliteEventStore } from "@zmind-plus/store";

import { createRuntime } from "./server";

const host = process.env.ZMIND_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.ZMIND_PORT ?? "4311", 10);
const databasePath = resolve(
  process.env.ZMIND_DATABASE_PATH ?? ".zmind-plus/events.db",
);

mkdirSync(dirname(databasePath), { recursive: true });
const store = new SqliteEventStore(databasePath);
const app = createRuntime({
  store,
  allowedOrigin: process.env.ZMIND_UI_ORIGIN ?? "http://127.0.0.1:4310",
});

const shutdown = async () => {
  await app.close();
  store.close();
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host, port });
console.log(`Zmind+ runtime ready at http://${host}:${port}`);
