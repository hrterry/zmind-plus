import { describe, expect, it } from "vitest";

import { syntheticResearchEvents } from "@zmind-plus/core";

import { mergeResearchEvents } from "./useResearchRun";

describe("mergeResearchEvents", () => {
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
});
