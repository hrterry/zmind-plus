import type { Actor, NodeKind, ResearchEvent, ResearchNode } from "./schema";

export interface ScaleCorpusOptions {
  nodeCount: number;
  branchingFactor?: number;
}

const systemActor: Actor = {
  id: "system-scale",
  label: "Synthetic coordinator",
  type: "system",
};

const nodeKinds: NodeKind[] = [
  "hypothesis",
  "critique",
  "experiment",
  "evidence",
  "claim",
  "lesson",
];

export function generateScaleResearchEvents({
  nodeCount,
  branchingFactor = 8,
}: ScaleCorpusOptions): ResearchEvent[] {
  if (!Number.isSafeInteger(nodeCount) || nodeCount < 1) {
    throw new Error("nodeCount must be a positive safe integer");
  }
  if (!Number.isSafeInteger(branchingFactor) || branchingFactor < 2) {
    throw new Error("branchingFactor must be a safe integer of at least 2");
  }

  const width = String(nodeCount - 1).length;
  const runId = `run-scale-${nodeCount}`;
  const startedAt = Date.parse("2026-01-01T00:00:00.000Z");
  const events: ResearchEvent[] = [];

  function nodeId(index: number): string {
    return `node-${String(index).padStart(width, "0")}`;
  }

  function emit(event: Omit<ResearchEvent, "id" | "sequence" | "observedAt">) {
    const sequence = events.length;
    events.push({
      ...event,
      id: `scale-event-${sequence}`,
      sequence,
      observedAt: new Date(startedAt + sequence).toISOString(),
    } as ResearchEvent);
  }

  emit({
    schemaVersion: 1,
    runId,
    actor: systemActor,
    type: "run.started",
    payload: {
      title: `${nodeCount.toLocaleString("en-US")} node scale corpus`,
      objective: "Verify progressive disclosure under a broad research tree.",
    },
  });

  for (let index = 0; index < nodeCount; index += 1) {
    const id = nodeId(index);
    const kind =
      index === 0 ? "question" : nodeKinds[(index - 1) % nodeKinds.length]!;
    const node: ResearchNode = {
      id,
      kind,
      title:
        index === 0 ? "Scale research objective" : `Synthetic ${kind} ${index}`,
      summary: "Provider-neutral generated content for graph scale validation.",
      status: index % 7 === 0 ? "contested" : "supported",
      confidence: 0.5 + (index % 50) / 100,
      tags: ["synthetic", "scale"],
      provenance: {
        adapter: "scale-generator",
        locator: `generated/${id}`,
        digest: `synthetic-${id}`,
        contentCaptured: false,
      },
    };

    emit({
      schemaVersion: 1,
      runId,
      actor: systemActor,
      type: "research.node.upserted",
      payload: { node },
    });

    if (index > 0) {
      const parentIndex = Math.floor((index - 1) / branchingFactor);
      emit({
        schemaVersion: 1,
        runId,
        actor: systemActor,
        type: "research.edge.upserted",
        payload: {
          edge: {
            id: `edge-${parentIndex}-${index}`,
            source: nodeId(parentIndex),
            target: id,
            kind: index % 3 === 0 ? "tests" : "decomposes",
          },
        },
      });
    }
  }

  return events;
}
