import { describe, expect, it } from "vitest";

import { syntheticResearchEvents } from "@zmind-plus/core";

import {
  EventConflictError,
  EventSequenceError,
  SqliteEventStore,
} from "../src";

function createStore() {
  return new SqliteEventStore(":memory:");
}

describe("SqliteEventStore", () => {
  it("appends, replays, and projects a complete run", () => {
    const store = createStore();
    const result = store.appendBatch(syntheticResearchEvents);

    expect(result.appended).toHaveLength(syntheticResearchEvents.length);
    expect(result.lastSequence).toBe(syntheticResearchEvents.length - 1);
    expect(store.listEvents("run-synthetic-001", 14)).toHaveLength(
      syntheticResearchEvents.length - 15,
    );
    expect(
      store.projectRun("run-synthetic-001")?.nodes.get("hypothesis-ws")?.status,
    ).toBe("refuted");
    expect(store.listRuns()).toEqual([
      expect.objectContaining({
        id: "run-synthetic-001",
        lastSequence: syntheticResearchEvents.length - 1,
      }),
    ]);
    store.close();
  });

  it("treats identical event IDs as idempotent retries", () => {
    const store = createStore();
    store.appendBatch(syntheticResearchEvents);

    const retry = store.appendBatch(syntheticResearchEvents);

    expect(retry.appended).toHaveLength(0);
    expect(retry.duplicateCount).toBe(syntheticResearchEvents.length);
    store.close();
  });

  it("rejects an event ID reused with different content", () => {
    const store = createStore();
    const original = syntheticResearchEvents[0]!;
    if (original.type !== "run.started") {
      throw new Error("The synthetic scenario must begin with run.started");
    }
    store.appendBatch([original]);
    const changed = structuredClone(original);
    changed.payload.title = "Changed after the event was recorded";

    expect(() => store.appendBatch([changed])).toThrow(EventConflictError);
    store.close();
  });

  it("rolls back the entire batch when a sequence gap is found", () => {
    const store = createStore();

    expect(() =>
      store.appendBatch([
        syntheticResearchEvents[0],
        syntheticResearchEvents[2],
      ]),
    ).toThrow(EventSequenceError);
    expect(store.listRuns()).toHaveLength(0);
    expect(store.listEvents("run-synthetic-001")).toHaveLength(0);
    store.close();
  });
});
