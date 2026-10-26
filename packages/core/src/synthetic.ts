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

const coordinator: Actor = {
  id: "agent-coordinator",
  label: "Coordinator",
  type: "agent",
};

const reviewer: Actor = {
  id: "agent-reviewer",
  label: "Adversarial reviewer",
  type: "agent",
};

const experimenter: Actor = {
  id: "agent-experimenter",
  label: "Experiment runner",
  type: "agent",
};

const system: Actor = { id: "system", label: "Zmind+", type: "system" };

function time(sequence: number): string {
  return new Date(startedAt + sequence * 18_000).toISOString();
}

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

function base(sequence: number, actor: Actor) {
  return {
    schemaVersion: 1 as const,
    id: `event-${sequence.toString().padStart(3, "0")}`,
    runId,
    sequence,
    observedAt: time(sequence),
    actor,
  };
}

export const syntheticResearchEvents: ResearchEvent[] = [
  {
    ...base(0, system),
    type: "run.started",
    payload: {
      title: "Realtime collaboration architecture",
      objective:
        "Choose a resilient transport for a collaborative visual workspace.",
    },
  },
  {
    ...base(1, coordinator),
    type: "research.node.upserted",
    payload: {
      node: node(
        "question-root",
        "question",
        "Which transport should coordinate live edits?",
        "Compare operational simplicity, recovery, and interaction latency.",
        "active",
        coordinator.id,
      ),
    },
  },
  {
    ...base(2, coordinator),
    type: "agent.status.changed",
    payload: {
      agent: coordinator,
      status: "working",
      focus: "Splitting architecture and failure-mode research",
    },
  },
  {
    ...base(3, coordinator),
    type: "research.node.upserted",
    payload: {
      node: node(
        "hypothesis-ws",
        "hypothesis",
        "A direct WebSocket channel is sufficient",
        "One bidirectional connection appears to minimize moving parts.",
        "supported",
        coordinator.id,
        0.76,
      ),
    },
  },
  {
    ...base(4, coordinator),
    type: "research.edge.upserted",
    payload: {
      edge: edge("edge-q-h", "question-root", "hypothesis-ws", "proposes"),
    },
  },
  {
    ...base(5, reviewer),
    type: "agent.status.changed",
    payload: {
      agent: reviewer,
      status: "working",
      focus: "Testing reconnect and missed-event assumptions",
    },
  },
  {
    ...base(6, reviewer),
    type: "research.node.upserted",
    payload: {
      node: node(
        "critique-recovery",
        "critique",
        "Reconnect can silently lose the decision history",
        "A live socket transports updates but does not define replay or ordering.",
        "contested",
        reviewer.id,
        0.88,
      ),
    },
  },
  {
    ...base(7, reviewer),
    type: "research.edge.upserted",
    payload: {
      edge: edge(
        "edge-h-c",
        "hypothesis-ws",
        "critique-recovery",
        "challenges",
      ),
    },
  },
  {
    ...base(8, experimenter),
    type: "research.node.upserted",
    payload: {
      node: node(
        "experiment-reconnect",
        "experiment",
        "Interrupt 5% of long-lived connections",
        "Measure missing, duplicated, and reordered updates over 1,000 runs.",
        "active",
        experimenter.id,
      ),
    },
  },
  {
    ...base(9, experimenter),
    type: "research.edge.upserted",
    payload: {
      edge: edge(
        "edge-c-x",
        "critique-recovery",
        "experiment-reconnect",
        "tests",
      ),
    },
  },
  {
    ...base(10, experimenter),
    type: "agent.status.changed",
    payload: {
      agent: experimenter,
      status: "working",
      focus: "Running reconnect fault injection",
    },
  },
  {
    ...base(11, experimenter),
    type: "research.node.upserted",
    payload: {
      node: node(
        "evidence-loss",
        "evidence",
        "Unacknowledged updates disappear after reconnect",
        "The baseline lost updates in 31 of 1,000 interrupted runs.",
        "supported",
        experimenter.id,
        0.97,
      ),
    },
  },
  {
    ...base(12, experimenter),
    type: "research.edge.upserted",
    payload: {
      edge: edge(
        "edge-x-e",
        "experiment-reconnect",
        "evidence-loss",
        "produces",
      ),
    },
  },
  {
    ...base(13, reviewer),
    type: "research.edge.upserted",
    payload: {
      edge: edge("edge-e-h", "evidence-loss", "hypothesis-ws", "refutes"),
    },
  },
  {
    ...base(14, coordinator),
    type: "research.node.upserted",
    payload: {
      node: node(
        "hypothesis-ws",
        "hypothesis",
        "A direct WebSocket channel is sufficient",
        "Rejected: transport alone does not guarantee ordered recovery.",
        "refuted",
        coordinator.id,
        0.08,
      ),
    },
  },
  {
    ...base(15, coordinator),
    type: "research.node.upserted",
    payload: {
      node: node(
        "decision-event-log",
        "decision",
        "Use an append-only event log with a live delivery channel",
        "The durable log owns ordering and replay; the connection only reduces latency.",
        "supported",
        coordinator.id,
        0.93,
      ),
    },
  },
  {
    ...base(16, coordinator),
    type: "research.edge.upserted",
    payload: {
      edge: edge("edge-e-d", "evidence-loss", "decision-event-log", "supports"),
    },
  },
  {
    ...base(17, system),
    type: "human.attention.requested",
    payload: {
      nodeId: "decision-event-log",
      reason: "Approve the durability trade-off before implementation begins.",
      urgency: "high",
    },
  },
];
