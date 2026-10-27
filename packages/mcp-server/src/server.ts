import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import {
  edgeKindSchema,
  nodeKindSchema,
  nodeStatusSchema,
} from "@zmind-plus/core";

import { ResearchWriter } from "./ResearchWriter";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

export function createResearchMcpServer(writer = new ResearchWriter()) {
  const server = new McpServer({ name: "zmind-plus", version: "0.0.0" });

  server.registerTool(
    "start_research",
    {
      description:
        "Start a visible research map. Record the stated objective, not hidden reasoning or a transcript.",
      inputSchema: z.object({
        title: z.string().min(1).max(160),
        objective: z.string().min(1).max(2_000),
        rootTitle: z.string().min(1).max(240).optional(),
        runId: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
      }),
    },
    async (input) => {
      const state = await writer.startResearch(input);
      return textResult({ runId: state.runId, rootNodeId: state.nodes[0]?.id });
    },
  );

  server.registerTool(
    "attach_latest_research",
    {
      description:
        "Attach this recorder to the most recently active local Zmind+ run, such as the run created automatically by lifecycle hooks.",
      inputSchema: z.object({}),
    },
    async () => {
      const state = await writer.attachLatestResearch();
      return textResult({ runId: state.runId, nodes: state.nodes.length });
    },
  );

  server.registerTool(
    "record_finding",
    {
      description:
        "Record or update one concise research question, hypothesis, critique, experiment, evidence item, decision, claim, lesson, proposal, or artifact.",
      inputSchema: z.object({
        id: z
          .string()
          .min(1)
          .max(160)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
        kind: nodeKindSchema,
        title: z.string().min(1).max(240),
        summary: z.string().max(4_000),
        status: nodeStatusSchema.optional(),
        confidence: z.number().min(0).max(1).optional(),
        tags: z.array(z.string().min(1).max(60)).max(12).optional(),
      }),
    },
    async (input) => textResult(await writer.recordFinding(input)),
  );

  server.registerTool(
    "connect_findings",
    {
      description:
        "Connect two existing findings with an explicit research relationship.",
      inputSchema: z.object({
        source: z.string().min(1).max(160),
        target: z.string().min(1).max(160),
        kind: edgeKindSchema,
        label: z.string().min(1).max(160).optional(),
      }),
    },
    async (input) => textResult(await writer.connectFindings(input)),
  );

  server.registerTool(
    "request_human_review",
    {
      description:
        "Ask the human to review a consequential uncertainty or decision attached to an existing finding.",
      inputSchema: z.object({
        nodeId: z.string().min(1).max(160),
        reason: z.string().min(1).max(1_000),
        urgency: z.enum(["low", "medium", "high"]),
      }),
    },
    async (input) => textResult(await writer.requestHumanReview(input)),
  );

  server.registerTool(
    "get_research_state",
    {
      description:
        "Get the compact current node, relationship, and status state for the active research run.",
      inputSchema: z.object({}),
    },
    async () => textResult(await writer.getResearchState()),
  );

  return server;
}
