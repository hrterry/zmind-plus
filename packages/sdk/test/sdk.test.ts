import { describe, expect, it, vi } from "vitest";

import {
  generateScaleResearchEvents,
  syntheticResearchEvents,
} from "@zmind-plus/core";

import {
  createResearchEventBatches,
  parseResearchJsonl,
  serializeResearchJsonl,
  ZmindClient,
  ZmindSdkError,
} from "../src";

describe("Zmind adapter SDK", () => {
  it("parses blank-line tolerant JSONL", () => {
    const input = syntheticResearchEvents
      .slice(0, 3)
      .map((event) => JSON.stringify(event))
      .join("\n\n");

    expect(parseResearchJsonl(input)).toEqual(
      syntheticResearchEvents.slice(0, 3),
    );
  });

  it("reports invalid JSON by line without echoing content", () => {
    expect(() => parseResearchJsonl("\nprivate raw value{")).toThrow(
      new ZmindSdkError("Line 2 is not valid JSON"),
    );
  });

  it("round-trips portable JSONL without changing event meaning", () => {
    const events = syntheticResearchEvents.slice(0, 4);
    expect(parseResearchJsonl(serializeResearchJsonl(events))).toEqual(events);
  });

  it("honors both byte and event limits when creating request batches", () => {
    const events = syntheticResearchEvents.slice(0, 4);
    const twoEventBytes = new TextEncoder().encode(
      JSON.stringify(events.slice(0, 2)),
    ).byteLength;
    const batches = createResearchEventBatches(events, {
      maxBodyBytes: twoEventBytes,
      maxEvents: 3,
    });

    expect(batches.map((batch) => batch.length)).toEqual([2, 2]);
    expect(
      batches.every(
        (batch) =>
          new TextEncoder().encode(JSON.stringify(batch)).byteLength <=
          twoEventBytes,
      ),
    ).toBe(true);
  });

  it("validates and uploads large runs in bounded sequential batches", async () => {
    const events = generateScaleResearchEvents({ nodeCount: 600 });
    const batchSizes: number[] = [];
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const batch = JSON.parse(String(init?.body)) as unknown[];
      batchSizes.push(batch.length);
      const lastSequence = (batch.at(-1) as { sequence: number }).sequence;
      return new Response(
        JSON.stringify({
          accepted: batch.length,
          duplicates: 0,
          lastSequence,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    });

    const receipt = await new ZmindClient({
      baseUrl: "http://local.test/",
      fetcher,
    }).append(events);

    expect(batchSizes).toEqual([500, 500, 200]);
    expect(receipt).toEqual({
      runId: "run-scale-600",
      accepted: events.length,
      duplicates: 0,
      lastSequence: events.length - 1,
      requests: 3,
    });
  });

  it("rejects mixed runs before the first request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const mixed = [
      syntheticResearchEvents[0]!,
      { ...syntheticResearchEvents[1]!, runId: "another-run" },
    ];

    await expect(new ZmindClient({ fetcher }).append(mixed)).rejects.toThrow(
      /multiple runs/,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
