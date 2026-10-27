import { describe, expect, it } from "vitest";

import { projectEvents, syntheticResearchEvents } from "@zmind-plus/core";

import { createResearchBrief, matchesResearchNode } from "./researchBrief";

const projection = projectEvents(syntheticResearchEvents);

describe("structured research brief", () => {
  it("projects deterministic decision, evidence, reversal, challenge, and experiment sections", () => {
    const sections = createResearchBrief(projection.nodes.values());
    expect(sections.map((section) => section.id)).toEqual([
      "decision",
      "evidence",
      "reversals",
      "challenges",
      "experiments",
    ]);
    expect(sections[0]!.nodes.map((node) => node.id)).toEqual([
      "decision-event-log",
    ]);
    expect(sections[1]!.nodes.map((node) => node.confidence)).toEqual([
      0.97, 0.95, 0.92,
    ]);
    expect(sections[2]!.nodes.map((node) => node.id)).toContain(
      "hypothesis-ws",
    );
    expect(sections[3]!.nodes).toHaveLength(4);
    expect(sections[4]!.nodes).toHaveLength(3);
  });

  it("uses the same semantic search fields for brief and graph disclosure", () => {
    const node = projection.nodes.get("evidence-loss")!;
    expect(matchesResearchNode(node, "unacknowledged")).toBe(true);
    expect(matchesResearchNode(node, "supported")).toBe(true);
    expect(matchesResearchNode(node, "evidence")).toBe(true);
    expect(matchesResearchNode(node, "missing term")).toBe(false);

    const sections = createResearchBrief(
      projection.nodes.values(),
      "unacknowledged",
    );
    expect(sections.flatMap((section) => section.nodes)).toEqual([node]);
  });
});
