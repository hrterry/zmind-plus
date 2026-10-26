import { describe, expect, it } from "vitest";

import {
  createGraphView,
  generateScaleResearchEvents,
  projectEvents,
  syntheticResearchEvents,
} from "../src";

describe("progressive graph visibility", () => {
  it("folds deep branches without changing the complete projection", () => {
    const projection = projectEvents(syntheticResearchEvents);
    const view = createGraphView(projection, { defaultExpandedDepth: 1 });

    expect(projection.nodes.size).toBe(14);
    expect(view.nodes.length).toBeLessThan(projection.nodes.size);
    expect(view.hiddenNodeCount).toBe(
      projection.nodes.size - view.nodes.length,
    );
    expect(
      view.nodes.some(
        (entry) => entry.isCollapsed && entry.hiddenDescendantCount > 0,
      ),
    ).toBe(true);
  });

  it("reveals a matching node and every ancestor without mutating expansion", () => {
    const projection = projectEvents(syntheticResearchEvents);
    const collapsed = new Set(["hypothesis-ws"]);
    const hidden = createGraphView(projection, {
      defaultExpandedDepth: 1,
      collapsedNodeIds: collapsed,
    });
    const revealed = createGraphView(projection, {
      defaultExpandedDepth: 1,
      collapsedNodeIds: collapsed,
      revealNodeIds: new Set(["evidence-loss"]),
    });

    expect(hidden.nodes.some(({ node }) => node.id === "evidence-loss")).toBe(
      false,
    );
    expect(revealed.nodes.some(({ node }) => node.id === "evidence-loss")).toBe(
      true,
    );
    expect(collapsed).toEqual(new Set(["hypothesis-ws"]));
  });

  it("limits a 1,000-node corpus to a compact deterministic overview", () => {
    const projection = projectEvents(
      generateScaleResearchEvents({ nodeCount: 1_000 }),
    );
    const first = createGraphView(projection, { defaultExpandedDepth: 1 });
    const second = createGraphView(projection, { defaultExpandedDepth: 1 });

    expect(first.nodes.length).toBeLessThanOrEqual(80);
    expect(first.hiddenNodeCount).toBe(1_000 - first.nodes.length);
    expect(first.nodes.map(({ node }) => node.id)).toEqual(
      second.nodes.map(({ node }) => node.id),
    );
    expect(first.edges.map((edge) => edge.id)).toEqual(
      second.edges.map((edge) => edge.id),
    );

    const expanded = createGraphView(projection, {
      defaultExpandedDepth: 1,
      expandedNodeIds: new Set(["node-001"]),
    });
    expect(expanded.nodes.length).toBeGreaterThan(first.nodes.length);
    expect(expanded.hiddenNodeCount).toBeLessThan(first.hiddenNodeCount);
  });

  it("turns a cyclic component into a finite display tree", () => {
    const events = generateScaleResearchEvents({ nodeCount: 3 });
    events.push({
      schemaVersion: 1,
      id: "scale-event-cycle",
      runId: "run-scale-3",
      sequence: events.length,
      observedAt: "2026-01-01T00:00:01.000Z",
      actor: {
        id: "system-scale",
        label: "Synthetic coordinator",
        type: "system",
      },
      type: "research.edge.upserted",
      payload: {
        edge: {
          id: "edge-cycle",
          source: "node-2",
          target: "node-0",
          kind: "decomposes",
        },
      },
    });

    const projection = projectEvents(events);
    const view = createGraphView(projection);

    expect(view.nodes.map(({ node }) => node.id)).toEqual([
      "node-0",
      "node-1",
      "node-2",
    ]);
    expect(view.hiddenNodeCount).toBe(0);
  });
});
