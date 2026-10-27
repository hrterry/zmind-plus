import { z } from "zod";

export const actorTypeSchema = z.enum(["human", "agent", "tool", "system"]);

export const actorSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: actorTypeSchema,
});

export const nodeKindSchema = z.enum([
  "question",
  "hypothesis",
  "proposal",
  "critique",
  "experiment",
  "evidence",
  "decision",
  "claim",
  "lesson",
  "artifact",
]);

export const nodeStatusSchema = z.enum([
  "queued",
  "active",
  "blocked",
  "supported",
  "contested",
  "refuted",
  "superseded",
  "complete",
]);

export const edgeKindSchema = z.enum([
  "decomposes",
  "proposes",
  "challenges",
  "tests",
  "supports",
  "refutes",
  "contradicts",
  "depends_on",
  "supersedes",
  "produces",
]);

function isPrivacySafeLocator(locator: string): boolean {
  const normalized = locator.trim();
  return !(
    normalized.startsWith("/") ||
    normalized.startsWith("~\\") ||
    normalized.startsWith("~/") ||
    normalized.startsWith("\\\\") ||
    /^[a-z]:[\\/]/i.test(normalized) ||
    /^file:/i.test(normalized)
  );
}

export const provenanceSchema = z.object({
  adapter: z.string().min(1),
  locator: z
    .string()
    .min(1)
    .refine(isPrivacySafeLocator, "Locator must not expose an absolute path"),
  digest: z.string().min(1),
  contentCaptured: z.boolean().default(false),
});

export const researchNodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKindSchema,
  title: z.string().min(1),
  summary: z.string().default(""),
  status: nodeStatusSchema,
  ownerId: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).default([]),
  provenance: provenanceSchema,
});

export const researchEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  kind: edgeKindSchema,
  label: z.string().optional(),
});

const eventBase = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  runId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  observedAt: z.iso.datetime({ offset: true }),
  actor: actorSchema,
});

const runStartedEventSchema = eventBase.extend({
  type: z.literal("run.started"),
  payload: z.object({
    title: z.string().min(1),
    objective: z.string().min(1),
  }),
});

const nodeUpsertedEventSchema = eventBase.extend({
  type: z.literal("research.node.upserted"),
  payload: z.object({ node: researchNodeSchema }),
});

const edgeUpsertedEventSchema = eventBase.extend({
  type: z.literal("research.edge.upserted"),
  payload: z.object({ edge: researchEdgeSchema }),
});

const agentStatusEventSchema = eventBase.extend({
  type: z.literal("agent.status.changed"),
  payload: z.object({
    agent: actorSchema.refine((actor) => actor.type === "agent"),
    status: z.enum(["queued", "working", "waiting", "complete", "failed"]),
    focus: z.string().min(1),
  }),
});

const attentionRequestedEventSchema = eventBase.extend({
  type: z.literal("human.attention.requested"),
  payload: z.object({
    nodeId: z.string().min(1),
    reason: z.string().min(1),
    urgency: z.enum(["low", "medium", "high"]),
  }),
});

export const researchEventSchema = z.discriminatedUnion("type", [
  runStartedEventSchema,
  nodeUpsertedEventSchema,
  edgeUpsertedEventSchema,
  agentStatusEventSchema,
  attentionRequestedEventSchema,
]);

export type Actor = z.infer<typeof actorSchema>;
export type ResearchNode = z.infer<typeof researchNodeSchema>;
export type ResearchEdge = z.infer<typeof researchEdgeSchema>;
export type ResearchEvent = z.infer<typeof researchEventSchema>;
export type NodeKind = z.infer<typeof nodeKindSchema>;
export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type EdgeKind = z.infer<typeof edgeKindSchema>;
