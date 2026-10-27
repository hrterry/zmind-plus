import { describe, expect, it } from "vitest";

import { researchEventSchema, syntheticResearchEvents } from "../src";

function rawNodeEvent() {
  const event = syntheticResearchEvents.find(
    (candidate) => candidate.type === "research.node.upserted",
  );
  if (event?.type !== "research.node.upserted") {
    throw new Error("The synthetic scenario must contain a research node");
  }
  return structuredClone(event) as unknown as {
    payload: {
      node: {
        provenance: {
          locator: string;
          contentCaptured?: boolean;
        };
      };
    };
  };
}

describe("event privacy boundary", () => {
  it("defaults raw content capture to off", () => {
    const input = rawNodeEvent();
    delete input.payload.node.provenance.contentCaptured;

    const parsed = researchEventSchema.parse(input);
    if (parsed.type !== "research.node.upserted") {
      throw new Error("Expected a research node event");
    }
    expect(parsed.payload.node.provenance.contentCaptured).toBe(false);
  });

  it.each([
    "/users/operator/private/notes.md",
    "~/private/notes.md",
    "~\\private\\notes.md",
    "C:\\Users\\operator\\notes.md",
    "\\\\server\\share\\notes.md",
    "file:///users/operator/private/notes.md",
  ])("rejects a workstation locator: %s", (locator) => {
    const input = rawNodeEvent();
    input.payload.node.provenance.locator = locator;

    expect(() => researchEventSchema.parse(input)).toThrow(/absolute path/);
  });

  it.each([
    "nodes/evidence-17",
    "repository/docs/decision.md#recovery",
    "https://example.org/research/paper",
  ])("accepts a portable locator: %s", (locator) => {
    const input = rawNodeEvent();
    input.payload.node.provenance.locator = locator;

    expect(() => researchEventSchema.parse(input)).not.toThrow();
  });
});
