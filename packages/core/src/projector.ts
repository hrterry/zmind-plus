import { researchEventSchema } from "./schema";
import type {
  Actor,
  ResearchEdge,
  ResearchEvent,
  ResearchNode,
} from "./schema";

export interface AgentActivity {
  agent: Actor;
  status: "queued" | "working" | "waiting" | "complete" | "failed";
  focus: string;
  updatedAt: string;
}

export interface AttentionRequest {
  eventId: string;
  nodeId: string;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export interface ResearchProjection {
  runId?: string;
  title?: string;
  objective?: string;
  lastSequence: number;
  nodes: Map<string, ResearchNode>;
  edges: Map<string, ResearchEdge>;
  agents: Map<string, AgentActivity>;
  attention: AttentionRequest[];
}

export function emptyProjection(): ResearchProjection {
  return {
    lastSequence: -1,
    nodes: new Map(),
    edges: new Map(),
    agents: new Map(),
    attention: [],
  };
}

export function projectEvents(input: readonly unknown[]): ResearchProjection {
  const events = input.map((event) => researchEventSchema.parse(event));
  const projection = emptyProjection();

  for (const event of events) {
    applyEvent(projection, event);
  }

  return projection;
}

export function applyEvent(
  projection: ResearchProjection,
  event: ResearchEvent,
): ResearchProjection {
  if (event.sequence <= projection.lastSequence) {
    throw new Error(
      `Event sequence ${event.sequence} must follow ${projection.lastSequence}`,
    );
  }

  if (projection.runId !== undefined && projection.runId !== event.runId) {
    throw new Error(`Cannot mix runs ${projection.runId} and ${event.runId}`);
  }

  projection.runId = event.runId;
  projection.lastSequence = event.sequence;

  switch (event.type) {
    case "run.started":
      projection.title = event.payload.title;
      projection.objective = event.payload.objective;
      break;
    case "research.node.upserted":
      projection.nodes.set(event.payload.node.id, event.payload.node);
      break;
    case "research.edge.upserted": {
      const { edge } = event.payload;
      if (
        !projection.nodes.has(edge.source) ||
        !projection.nodes.has(edge.target)
      ) {
        throw new Error(`Edge ${edge.id} references an unknown node`);
      }
      projection.edges.set(edge.id, edge);
      break;
    }
    case "agent.status.changed":
      projection.agents.set(event.payload.agent.id, {
        agent: event.payload.agent,
        status: event.payload.status,
        focus: event.payload.focus,
        updatedAt: event.observedAt,
      });
      break;
    case "human.attention.requested":
      if (!projection.nodes.has(event.payload.nodeId)) {
        throw new Error(
          `Attention request references unknown node ${event.payload.nodeId}`,
        );
      }
      projection.attention.push({
        eventId: event.id,
        nodeId: event.payload.nodeId,
        reason: event.payload.reason,
        urgency: event.payload.urgency,
      });
      break;
  }

  return projection;
}
