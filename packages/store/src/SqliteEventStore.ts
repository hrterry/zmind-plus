import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import {
  projectEvents,
  researchEventSchema,
  type ResearchEvent,
  type ResearchProjection,
} from "@zmind-plus/core";

interface RunRow {
  id: string;
  title: string;
  objective: string;
  created_at_ms: number;
  updated_at_ms: number;
  last_sequence: number;
}

interface EventRow {
  canonical_json: string;
  content_digest: string;
}

export interface StoredRun {
  id: string;
  title: string;
  objective: string;
  createdAt: string;
  updatedAt: string;
  lastSequence: number;
}

export interface AppendResult {
  appended: ResearchEvent[];
  duplicateCount: number;
  lastSequence: number;
}

export class EventStoreError extends Error {}
export class EventConflictError extends EventStoreError {}
export class EventSequenceError extends EventStoreError {}
export class RunMismatchError extends EventStoreError {}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function asEventRow(value: unknown): EventRow | undefined {
  if (value === undefined) return undefined;
  return value as EventRow;
}

function asRunRow(value: unknown): RunRow | undefined {
  if (value === undefined) return undefined;
  return value as RunRow;
}

export class SqliteEventStore {
  readonly #database: DatabaseSync;
  readonly #findEventById: StatementSync;
  readonly #findEventBySequence: StatementSync;
  readonly #findRun: StatementSync;
  readonly #insertEvent: StatementSync;
  readonly #insertRun: StatementSync;
  readonly #updateRun: StatementSync;
  readonly #listEvents: StatementSync;
  readonly #listRuns: StatementSync;

  constructor(filename: string) {
    this.#database = new DatabaseSync(filename);
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec("PRAGMA busy_timeout = 5000");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        last_sequence INTEGER NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS events (
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        event_id TEXT NOT NULL UNIQUE,
        event_type TEXT NOT NULL,
        observed_at_ms INTEGER NOT NULL,
        canonical_json TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        PRIMARY KEY (run_id, sequence)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS events_run_observed
        ON events(run_id, observed_at_ms);
    `);

    this.#findEventById = this.#database.prepare(
      "SELECT canonical_json, content_digest FROM events WHERE event_id = ?",
    );
    this.#findEventBySequence = this.#database.prepare(
      "SELECT canonical_json, content_digest FROM events WHERE run_id = ? AND sequence = ?",
    );
    this.#findRun = this.#database.prepare("SELECT * FROM runs WHERE id = ?");
    this.#insertEvent = this.#database.prepare(`
      INSERT INTO events (
        run_id, sequence, event_id, event_type, observed_at_ms,
        canonical_json, content_digest
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.#insertRun = this.#database.prepare(`
      INSERT INTO runs (
        id, title, objective, created_at_ms, updated_at_ms, last_sequence
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.#updateRun = this.#database.prepare(`
      UPDATE runs SET updated_at_ms = ?, last_sequence = ? WHERE id = ?
    `);
    this.#listEvents = this.#database.prepare(`
      SELECT canonical_json FROM events
      WHERE run_id = ? AND sequence > ?
      ORDER BY sequence ASC LIMIT ?
    `);
    this.#listRuns = this.#database.prepare(
      "SELECT * FROM runs ORDER BY updated_at_ms DESC",
    );
  }

  appendBatch(input: readonly unknown[]): AppendResult {
    if (input.length === 0) {
      throw new EventStoreError("At least one event is required");
    }
    if (input.length > 500) {
      throw new EventStoreError("A batch may contain at most 500 events");
    }

    const events = input.map((event) => researchEventSchema.parse(event));
    const runId = events[0]!.runId;

    for (const [index, event] of events.entries()) {
      if (event.runId !== runId) {
        throw new RunMismatchError("A batch cannot contain multiple runs");
      }
      if (index > 0 && event.sequence < events[index - 1]!.sequence) {
        throw new EventSequenceError(
          "Batch events must be ordered by sequence",
        );
      }
    }

    const appended: ResearchEvent[] = [];
    let duplicateCount = 0;
    let run = asRunRow(this.#findRun.get(runId));
    let currentLast = run?.last_sequence ?? -1;

    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const event of events) {
        const canonical = JSON.stringify(event);
        const contentDigest = digest(canonical);
        const existingById = asEventRow(this.#findEventById.get(event.id));

        if (existingById !== undefined) {
          if (existingById.content_digest !== contentDigest) {
            throw new EventConflictError(
              `Event ${event.id} already exists with different content`,
            );
          }
          duplicateCount += 1;
          continue;
        }

        const existingBySequence = asEventRow(
          this.#findEventBySequence.get(runId, event.sequence),
        );
        if (existingBySequence !== undefined) {
          throw new EventConflictError(
            `Sequence ${event.sequence} is already occupied for this run`,
          );
        }

        if (event.sequence !== currentLast + 1) {
          throw new EventSequenceError(
            `Expected sequence ${currentLast + 1}, received ${event.sequence}`,
          );
        }

        if (run === undefined) {
          if (event.sequence !== 0 || event.type !== "run.started") {
            throw new EventSequenceError(
              "A run must begin with run.started at sequence 0",
            );
          }
          const observedAtMs = Date.parse(event.observedAt);
          this.#insertRun.run(
            event.runId,
            event.payload.title,
            event.payload.objective,
            observedAtMs,
            observedAtMs,
            -1,
          );
          run = asRunRow(this.#findRun.get(runId));
        }

        const observedAtMs = Date.parse(event.observedAt);
        this.#insertEvent.run(
          event.runId,
          event.sequence,
          event.id,
          event.type,
          observedAtMs,
          canonical,
          contentDigest,
        );
        currentLast = event.sequence;
        this.#updateRun.run(observedAtMs, currentLast, runId);
        appended.push(event);
      }

      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }

    return { appended, duplicateCount, lastSequence: currentLast };
  }

  listEvents(runId: string, after = -1, limit = 1_000): ResearchEvent[] {
    const safeLimit = Math.max(1, Math.min(limit, 10_000));
    const rows = this.#listEvents.all(runId, after, safeLimit) as Array<{
      canonical_json: string;
    }>;
    return rows.map((row) =>
      researchEventSchema.parse(JSON.parse(row.canonical_json)),
    );
  }

  listAllEvents(runId: string, after = -1, pageSize = 10_000): ResearchEvent[] {
    const events: ResearchEvent[] = [];
    let cursor = after;

    while (true) {
      const page = this.listEvents(runId, cursor, pageSize);
      if (page.length === 0) break;
      events.push(...page);
      const nextCursor = page.at(-1)!.sequence;
      if (nextCursor <= cursor) {
        throw new EventStoreError("Event replay cursor did not advance");
      }
      cursor = nextCursor;
      if (page.length < Math.min(Math.max(1, pageSize), 10_000)) break;
    }

    return events;
  }

  listRuns(): StoredRun[] {
    return (this.#listRuns.all() as unknown as RunRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      objective: row.objective,
      createdAt: new Date(row.created_at_ms).toISOString(),
      updatedAt: new Date(row.updated_at_ms).toISOString(),
      lastSequence: row.last_sequence,
    }));
  }

  projectRun(runId: string): ResearchProjection | undefined {
    const events = this.listAllEvents(runId);
    return events.length === 0 ? undefined : projectEvents(events);
  }

  close(): void {
    this.#database.close();
  }
}
