import { describe, expect, it } from "vitest";

import { projectEvents, syntheticResearchEvents } from "../src";

describe("research event projection", () => {
  it("reconstructs the current research state", () => {
    const projection = projectEvents(syntheticResearchEvents);

    expect(projection.nodes.size).toBe(6);
    expect(projection.edges.size).toBe(6);
    expect(projection.nodes.get("hypothesis-ws")?.status).toBe("refuted");
    expect(projection.nodes.get("decision-event-log")?.status).toBe(
      "supported",
    );
    expect(projection.edges.get("edge-e-h")).toEqual(
      expect.objectContaining({
        source: "evidence-loss",
        target: "hypothesis-ws",
        kind: "refutes",
      }),
    );
    expect(projection.attention).toEqual([
      expect.objectContaining({
        nodeId: "decision-event-log",
        urgency: "high",
      }),
    ]);
  });

  it("rejects reordered events", () => {
    expect(() =>
      projectEvents([syntheticResearchEvents[1], syntheticResearchEvents[0]]),
    ).toThrow(/must follow/);
  });

  it("rejects edges that point to unknown nodes", () => {
    const edgeEvent = syntheticResearchEvents.find(
      (event) => event.type === "research.edge.upserted",
    );

    expect(edgeEvent).toBeDefined();
    expect(() =>
      projectEvents([syntheticResearchEvents[0], edgeEvent]),
    ).toThrow(/unknown node/);
  });
});
