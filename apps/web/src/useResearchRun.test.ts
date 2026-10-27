import { describe, expect, it, vi } from "vitest";

import {
  generateScaleResearchEvents,
  syntheticResearchEvents,
} from "@zmind-plus/core";

import {
  chooseRunId,
  fetchResearchEventHistory,
  mergeResearchEvents,
} from "./useResearchRun";

const runs = [
  {
    id: "new-run",
    title: "New run",
    objective: "New objective",
    updatedAt: "2026-10-26T20:00:02.000Z",
    lastSequence: 8,
  },
  {
    id: "old-run",
    title: "Old run",
    objective: "Old objective",
    updatedAt: "2026-10-26T20:00:01.000Z",
    lastSequence: 4,
  },
];

describe("mergeResearchEvents", () => {
  it("auto-follows the newest run but preserves a manual historical choice", () => {
    expect(chooseRunId(undefined, runs, false)).toBe("new-run");
    expect(chooseRunId("old-run", runs, true)).toBe("old-run");
    expect(chooseRunId("removed-run", runs, true)).toBe("new-run");
    expect(chooseRunId("old-run", [], true)).toBeUndefined();
  });

  it("deduplicates reconnect replays and preserves sequence order", () => {
    const current = syntheticResearchEvents.slice(0, 4);
    const incoming = [
      syntheticResearchEvents[3]!,
      syntheticResearchEvents[5]!,
      syntheticResearchEvents[4]!,
    ];

    const merged = mergeResearchEvents(current, incoming);

    expect(merged.map((event) => event.sequence)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("bootstraps every bounded page before opening a live cursor", async () => {
    const events = generateScaleResearchEvents({ nodeCount: 700 });
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), "http://local.test");
      const after = Number.parseInt(url.searchParams.get("after") ?? "-1", 10);
      const page = events
        .filter((event) => event.sequence > after)
        .slice(0, 1_000);
      return new Response(JSON.stringify({ events: page }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const replay = await fetchResearchEventHistory(
      "run-scale-700",
      events.length - 1,
      new AbortController().signal,
      fetcher,
    );

    expect(replay).toHaveLength(events.length);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(replay.at(-1)?.sequence).toBe(events.length - 1);
  });

  it("rejects a replay page with a sequence gap", async () => {
    const events = syntheticResearchEvents.slice(0, 3);
    const fetcher = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ events: [events[0], events[2]] }), {
          status: 200,
        }),
      ),
    );

    await expect(
      fetchResearchEventHistory(
        "run-synthetic-001",
        2,
        new AbortController().signal,
        fetcher,
      ),
    ).rejects.toThrow(/not contiguous/);
  });
});
