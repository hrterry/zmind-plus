import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import {
  createGraphView,
  generateScaleResearchEvents,
  projectEvents,
} from "../src";

const enabled = process.env.GRAPH_SCALE_BENCHMARK === "1";
const sizes = [1_000, 5_000, 20_000];

describe.skipIf(!enabled)("graph scale benchmark", () => {
  for (const nodeCount of sizes) {
    it(`${nodeCount.toLocaleString("en-US")} nodes`, () => {
      const events = generateScaleResearchEvents({ nodeCount });
      const heapBefore = process.memoryUsage().heapUsed;
      const projectionStart = performance.now();
      const projection = projectEvents(events);
      const projectionMs = performance.now() - projectionStart;
      const viewStart = performance.now();
      const view = createGraphView(projection, { defaultExpandedDepth: 1 });
      const visibilityMs = performance.now() - viewStart;
      const heapDeltaMiB =
        (process.memoryUsage().heapUsed - heapBefore) / (1024 * 1024);

      console.info(
        JSON.stringify({
          nodeCount,
          eventCount: events.length,
          visibleNodeCount: view.nodes.length,
          projectionMs: Number(projectionMs.toFixed(1)),
          visibilityMs: Number(visibilityMs.toFixed(1)),
          heapDeltaMiB: Number(heapDeltaMiB.toFixed(1)),
        }),
      );

      expect(projection.nodes.size).toBe(nodeCount);
      expect(view.nodes.length).toBeLessThanOrEqual(80);
    });
  }
});
