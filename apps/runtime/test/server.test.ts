import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  generateScaleResearchEvents,
  syntheticResearchEvents,
} from "@zmind-plus/core";
import { SqliteEventStore } from "@zmind-plus/store";

import { createRuntime } from "../src/server";

describe("local runtime API", () => {
  let store: SqliteEventStore;
  let app: ReturnType<typeof createRuntime>;

  beforeEach(() => {
    store = new SqliteEventStore(":memory:");
    app = createRuntime({ store, allowedOrigin: "http://127.0.0.1:4310" });
  });

  afterEach(async () => {
    await app.close();
    store.close();
  });

  it("ingests a batch and returns its research projection", async () => {
    const ingest = await app.inject({
      method: "POST",
      url: "/api/runs/run-synthetic-001/events",
      payload: syntheticResearchEvents,
    });
    expect(ingest.statusCode).toBe(202);
    expect(ingest.json()).toEqual(
      expect.objectContaining({ accepted: syntheticResearchEvents.length }),
    );

    const projection = await app.inject({
      method: "GET",
      url: "/api/runs/run-synthetic-001/projection",
    });
    expect(projection.statusCode).toBe(200);
    expect(projection.json().nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "hypothesis-ws", status: "refuted" }),
      ]),
    );
  });

  it("replays SSE events after the supplied cursor", async () => {
    store.appendBatch(syntheticResearchEvents);
    const response = await app.inject({
      method: "GET",
      url: "/api/runs/run-synthetic-001/stream?after=15&follow=false",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("id: 16");
    expect(response.body).toContain("id: 17");
    expect(response.body).not.toContain("id: 15\n");
  });

  it("rejects a URL and payload run mismatch", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/runs/not-the-run/events",
      payload: syntheticResearchEvents[0]!,
    });

    expect(response.statusCode).toBe(400);
    expect(store.listRuns()).toHaveLength(0);
  });

  it("blocks unconfigured browser origins", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "https://untrusted.example" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("projects and catches up beyond the internal replay page", async () => {
    const events = generateScaleResearchEvents({ nodeCount: 5_100 });
    for (let offset = 0; offset < events.length; offset += 500) {
      store.appendBatch(events.slice(offset, offset + 500));
    }

    const projection = await app.inject({
      method: "GET",
      url: "/api/runs/run-scale-5100/projection",
    });
    expect(projection.statusCode).toBe(200);
    expect(projection.json().nodes).toHaveLength(5_100);

    const replay = await app.inject({
      method: "GET",
      url: "/api/runs/run-scale-5100/stream?after=9998&follow=false",
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.body).toContain(`id: ${events.length - 1}`);
  });
});
