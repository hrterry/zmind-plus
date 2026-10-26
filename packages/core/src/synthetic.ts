import { researchEventSchema } from "./schema";
import type {
  Actor,
  EdgeKind,
  NodeKind,
  NodeStatus,
  ResearchEdge,
  ResearchEvent,
  ResearchNode,
} from "./schema";

const runId = "run-synthetic-001";
const startedAt = Date.parse("2026-10-26T16:00:00.000Z");

const actors = {
  system: { id: "system", label: "Zmind+", type: "system" },
  coordinator: { id: "agent-coordinator", label: "Coordinator", type: "agent" },
  architecture: {
    id: "agent-architecture",
    label: "Architecture expert",
    type: "agent",
  },
  performance: {
    id: "agent-performance",
    label: "Performance expert",
    type: "agent",
  },
  security: { id: "agent-security", label: "Security expert", type: "agent" },
  reviewer: {
    id: "agent-reviewer",
    label: "Adversarial reviewer",
    type: "agent",
  },
  experimenter: {
    id: "agent-experimenter",
    label: "Experiment runner",
    type: "agent",
  },
} as const satisfies Record<string, Actor>;

function provenance(locator: string) {
  return {
    adapter: "synthetic-demo",
    locator,
    digest: `demo-${locator.replaceAll("/", "-")}`,
    contentCaptured: false,
  };
}

function node(
  id: string,
  kind: NodeKind,
  title: string,
  summary: string,
  status: NodeStatus,
  ownerId?: string,
  confidence?: number,
): ResearchNode {
  return {
    id,
    kind,
    title,
    summary,
    status,
    ...(ownerId === undefined ? {} : { ownerId }),
    ...(confidence === undefined ? {} : { confidence }),
    tags: [],
    provenance: provenance(`nodes/${id}`),
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  kind: EdgeKind,
): ResearchEdge {
  return { id, source, target, kind };
}

type EventType = ResearchEvent["type"];
type EventOfType<T extends EventType> = Extract<ResearchEvent, { type: T }>;

const events: ResearchEvent[] = [];

function emit<T extends EventType>(
  actor: Actor,
  type: T,
  payload: EventOfType<T>["payload"],
): void {
  const sequence = events.length;
  events.push(
    researchEventSchema.parse({
      schemaVersion: 1,
      id: `event-${sequence.toString().padStart(3, "0")}`,
      runId,
      sequence,
      observedAt: new Date(startedAt + sequence * 12_000).toISOString(),
      actor,
      type,
      payload,
    }),
  );
}

function emitNode(actor: Actor, researchNode: ResearchNode): void {
  emit(actor, "research.node.upserted", { node: researchNode });
}

function emitEdge(actor: Actor, researchEdge: ResearchEdge): void {
  emit(actor, "research.edge.upserted", { edge: researchEdge });
}

function emitAgent(
  agent: Actor,
  status: "queued" | "working" | "waiting" | "complete" | "failed",
  focus: string,
): void {
  emit(agent, "agent.status.changed", { agent, status, focus });
}

emit(actors.system, "run.started", {
  title: "Realtime collaboration architecture",
  objective:
    "Choose a resilient transport for a collaborative visual workspace.",
});

emitNode(
  actors.coordinator,
  node(
    "question-root",
    "question",
    "Which transport should coordinate live edits?",
    "Compare operational simplicity, recovery, latency, and authorization boundaries.",
    "active",
    actors.coordinator.id,
  ),
);

emitAgent(
  actors.coordinator,
  "working",
  "Coordinating three independent research tracks",
);
emitAgent(
  actors.architecture,
  "working",
  "Designing recovery and replay semantics",
);
emitAgent(
  actors.performance,
  "working",
  "Modelling burst latency and fan-out cost",
);
emitAgent(actors.security, "working", "Reviewing authorization boundaries");
emitAgent(
  actors.reviewer,
  "working",
  "Searching for assumptions shared across tracks",
);
emitAgent(actors.experimenter, "queued", "Waiting for falsifiable hypotheses");

const hypotheses = [
  node(
    "hypothesis-ws",
    "hypothesis",
    "A direct WebSocket channel is sufficient",
    "One bidirectional connection appears to minimize moving parts.",
    "supported",
    actors.architecture.id,
    0.76,
  ),
  node(
    "hypothesis-log",
    "hypothesis",
    "A durable event log should own ordering",
    "Live delivery can remain lightweight if replay has a separate authority.",
    "contested",
    actors.performance.id,
    0.62,
  ),
  node(
    "hypothesis-crdt",
    "hypothesis",
    "Client-side CRDT state can remove coordination",
    "Conflict-free convergence may permit more offline autonomy.",
    "contested",
    actors.security.id,
    0.58,
  ),
];

for (const hypothesis of hypotheses) {
  const owner = Object.values(actors).find(
    (actor) => actor.id === hypothesis.ownerId,
  )!;
  emitNode(owner, hypothesis);
  emitEdge(
    owner,
    edge(`edge-q-${hypothesis.id}`, "question-root", hypothesis.id, "proposes"),
  );
}

const critiques = [
  {
    node: node(
      "critique-recovery",
      "critique",
      "Reconnect can silently lose the decision history",
      "A socket transports updates but does not define replay or ordering.",
      "contested",
      actors.reviewer.id,
      0.9,
    ),
    hypothesis: "hypothesis-ws",
  },
  {
    node: node(
      "critique-operations",
      "critique",
      "The log may add cost without improving interaction latency",
      "Durability is only useful if replay stays outside the hot interaction path.",
      "contested",
      actors.reviewer.id,
      0.81,
    ),
    hypothesis: "hypothesis-log",
  },
  {
    node: node(
      "critique-authorization",
      "critique",
      "Offline convergence can bypass revoked permissions",
      "A valid merge is not necessarily an authorized merge.",
      "contested",
      actors.reviewer.id,
      0.87,
    ),
    hypothesis: "hypothesis-crdt",
  },
];

for (const critique of critiques) {
  emitNode(actors.reviewer, critique.node);
  emitEdge(
    actors.reviewer,
    edge(
      `edge-${critique.hypothesis}-${critique.node.id}`,
      critique.hypothesis,
      critique.node.id,
      "challenges",
    ),
  );
}

emitAgent(
  actors.experimenter,
  "working",
  "Running three falsification experiments",
);

const experiments = [
  {
    node: node(
      "experiment-reconnect",
      "experiment",
      "Interrupt 5% of long-lived connections",
      "Measure missing, duplicated, and reordered updates over 1,000 runs.",
      "active",
      actors.experimenter.id,
    ),
    critique: "critique-recovery",
  },
  {
    node: node(
      "experiment-burst",
      "experiment",
      "Replay a 50× collaboration burst",
      "Compare direct broadcast with append-and-fan-out under identical load.",
      "active",
      actors.experimenter.id,
    ),
    critique: "critique-operations",
  },
  {
    node: node(
      "experiment-revocation",
      "experiment",
      "Revoke access during an offline editing window",
      "Attempt to merge edits created before and after permission revocation.",
      "active",
      actors.experimenter.id,
    ),
    critique: "critique-authorization",
  },
];

for (const experiment of experiments) {
  emitNode(actors.experimenter, experiment.node);
  emitEdge(
    actors.experimenter,
    edge(
      `edge-${experiment.critique}-${experiment.node.id}`,
      experiment.critique,
      experiment.node.id,
      "tests",
    ),
  );
}

const evidence = [
  {
    node: node(
      "evidence-loss",
      "evidence",
      "Unacknowledged updates disappear after reconnect",
      "The socket-only baseline lost updates in 31 of 1,000 interrupted runs.",
      "supported",
      actors.experimenter.id,
      0.97,
    ),
    experiment: "experiment-reconnect",
    hypothesis: "hypothesis-ws",
    verdict: "refutes" as const,
  },
  {
    node: node(
      "evidence-replay",
      "evidence",
      "Durable replay preserves latency within the target budget",
      "P95 interaction latency increased by 3 ms while recovery became deterministic.",
      "supported",
      actors.experimenter.id,
      0.92,
    ),
    experiment: "experiment-burst",
    hypothesis: "hypothesis-log",
    verdict: "supports" as const,
  },
  {
    node: node(
      "evidence-revocation",
      "evidence",
      "Convergent state still needs server authorization",
      "Two technically valid offline merges contained edits from a revoked actor.",
      "supported",
      actors.experimenter.id,
      0.95,
    ),
    experiment: "experiment-revocation",
    hypothesis: "hypothesis-crdt",
    verdict: "contradicts" as const,
  },
];

for (const result of evidence) {
  emitNode(actors.experimenter, result.node);
  emitEdge(
    actors.experimenter,
    edge(
      `edge-${result.experiment}-${result.node.id}`,
      result.experiment,
      result.node.id,
      "produces",
    ),
  );
  emitEdge(
    actors.reviewer,
    edge(
      `edge-${result.node.id}-${result.hypothesis}`,
      result.node.id,
      result.hypothesis,
      result.verdict,
    ),
  );
}

emitNode(
  actors.architecture,
  node(
    "hypothesis-ws",
    "hypothesis",
    "A direct WebSocket channel is sufficient",
    "Rejected: transport alone does not guarantee ordered recovery.",
    "refuted",
    actors.architecture.id,
    0.08,
  ),
);

emitNode(
  actors.coordinator,
  node(
    "decision-event-log",
    "decision",
    "Use an append-only event log with a live delivery channel",
    "The durable log owns ordering and replay; the connection only reduces latency.",
    "supported",
    actors.coordinator.id,
    0.93,
  ),
);
emitEdge(
  actors.coordinator,
  edge(
    "edge-evidence-decision",
    "evidence-replay",
    "decision-event-log",
    "supports",
  ),
);
emitEdge(
  actors.coordinator,
  edge("edge-decision-ws", "decision-event-log", "hypothesis-ws", "supersedes"),
);

emit(actors.system, "human.attention.requested", {
  nodeId: "decision-event-log",
  reason:
    "Approve the durability and authorization boundary before implementation begins.",
  urgency: "high",
});

emitAgent(actors.architecture, "complete", "Recovery model documented");
emitAgent(actors.performance, "complete", "Latency budget verified");
emitAgent(actors.security, "complete", "Authorization boundary identified");
emitAgent(actors.reviewer, "complete", "Three assumptions challenged");
emitAgent(
  actors.experimenter,
  "complete",
  "Falsification experiments complete",
);
emitAgent(actors.coordinator, "waiting", "Waiting for the human decision");

export const syntheticResearchEvents: ResearchEvent[] = events;
