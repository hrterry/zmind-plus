import { createHash } from "node:crypto";

import { z } from "zod";

import {
  researchEventSchema,
  type Actor,
  type ResearchEvent,
  type ResearchProjection,
} from "@zmind-plus/core";

const hookEventNameSchema = z.enum([
  "SessionStart",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "PostToolUse",
  "Stop",
  "StopFailure",
  "SessionEnd",
]);

const rawHookSchema = z
  .object({
    session_id: z.string().min(1).max(500),
    prompt_id: z.string().min(1).max(500).optional(),
    hook_event_name: hookEventNameSchema,
    source: z.string().min(1).max(100).optional(),
    agent_id: z.string().min(1).max(500).optional(),
    agent_type: z.string().max(200).optional(),
    task_id: z.string().min(1).max(500).optional(),
    tool_use_id: z.string().min(1).max(500).optional(),
    tool_name: z.string().max(200).optional(),
    duration_ms: z.number().finite().nonnegative().max(86_400_000).optional(),
    error: z.string().max(100).optional(),
    reason: z.string().max(100).optional(),
  })
  .passthrough()
  .superRefine((input, context) => {
    const requiredField: Partial<
      Record<
        z.infer<typeof hookEventNameSchema>,
        | "source"
        | "agent_id"
        | "task_id"
        | "tool_use_id"
        | "tool_name"
        | "error"
        | "reason"
      >
    > = {
      SessionStart: "source",
      SubagentStart: "agent_id",
      SubagentStop: "agent_id",
      TaskCreated: "task_id",
      TaskCompleted: "task_id",
      PostToolUse: "tool_use_id",
      StopFailure: "error",
      SessionEnd: "reason",
    };
    const field = requiredField[input.hook_event_name];
    if (field !== undefined && input[field] === undefined) {
      context.addIssue({
        code: "custom",
        message: `${field} is required for ${input.hook_event_name}`,
        path: [field],
      });
    }
    if (
      input.hook_event_name === "PostToolUse" &&
      input.tool_name === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "tool_name is required for PostToolUse",
        path: ["tool_name"],
      });
    }
  });

export const claudeHookRecordSchema = z
  .object({
    adapterVersion: z.literal(1),
    deliveryKey: z.string().regex(/^[a-f0-9]{32}$/),
    sessionKey: z.string().regex(/^[a-f0-9]{24}$/),
    promptKey: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    observedAt: z.iso.datetime({ offset: true }),
    eventName: hookEventNameSchema,
    source: z
      .enum(["startup", "resume", "clear", "compact", "fork"])
      .optional(),
    agentKey: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    agentType: z.string().min(1).max(80).optional(),
    taskKey: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    toolKey: z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional(),
    toolName: z.string().min(1).max(80).optional(),
    durationMs: z.number().int().nonnegative().max(86_400_000).optional(),
    failureType: z
      .string()
      .regex(/^[a-z_]{1,40}$/)
      .optional(),
    endReason: z
      .string()
      .regex(/^[a-z_]{1,40}$/)
      .optional(),
  })
  .superRefine((input, context) => {
    const requirements: Partial<
      Record<z.infer<typeof hookEventNameSchema>, Array<keyof typeof input>>
    > = {
      SessionStart: ["source"],
      SubagentStart: ["agentKey"],
      SubagentStop: ["agentKey"],
      TaskCreated: ["taskKey"],
      TaskCompleted: ["taskKey"],
      PostToolUse: ["toolKey", "toolName"],
      StopFailure: ["failureType"],
      SessionEnd: ["endReason"],
    };
    for (const field of requirements[input.eventName] ?? []) {
      if (input[field] === undefined) {
        context.addIssue({
          code: "custom",
          message: `${field} is required for ${input.eventName}`,
          path: [field],
        });
      }
    }
  });

export type ClaudeHookRecord = z.infer<typeof claudeHookRecordSchema>;

function digest(value: string, length: number): string {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function safeLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const label = value
    .replace(/[^a-zA-Z0-9:_./ -]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return label.length === 0 ? undefined : label;
}

function safeEnum(value: string | undefined): string | undefined {
  const normalized = value
    ?.toLowerCase()
    .replace(/[^a-z_]/g, "")
    .slice(0, 40);
  return normalized === undefined || normalized.length === 0
    ? undefined
    : normalized;
}

export function sanitizeClaudeHook(
  input: unknown,
  observedAt = new Date().toISOString(),
): ClaudeHookRecord {
  const raw = rawHookSchema.parse(input);
  const sessionKey = digest(`session:${raw.session_id}`, 24);
  const promptKey =
    raw.prompt_id === undefined
      ? undefined
      : digest(`prompt:${raw.prompt_id}`, 24);
  const agentKey =
    raw.agent_id === undefined
      ? undefined
      : digest(`agent:${raw.agent_id}`, 24);
  const taskKey =
    raw.task_id === undefined ? undefined : digest(`task:${raw.task_id}`, 24);
  const toolKey =
    raw.tool_use_id === undefined
      ? undefined
      : digest(`tool:${raw.tool_use_id}`, 24);
  const source = z
    .enum(["startup", "resume", "clear", "compact", "fork"])
    .safeParse(raw.source);
  const identity = [
    sessionKey,
    raw.hook_event_name,
    promptKey ?? "before-prompt",
    agentKey ?? "main-agent",
    taskKey ?? "no-task",
    toolKey ?? "no-tool",
    source.success ? source.data : "no-source",
  ].join(":");

  return claudeHookRecordSchema.parse({
    adapterVersion: 1,
    deliveryKey: digest(identity, 32),
    sessionKey,
    ...(promptKey === undefined ? {} : { promptKey }),
    observedAt,
    eventName: raw.hook_event_name,
    ...(source.success ? { source: source.data } : {}),
    ...(agentKey === undefined ? {} : { agentKey }),
    ...(safeLabel(raw.agent_type) === undefined
      ? {}
      : { agentType: safeLabel(raw.agent_type) }),
    ...(taskKey === undefined ? {} : { taskKey }),
    ...(toolKey === undefined ? {} : { toolKey }),
    ...(safeLabel(raw.tool_name) === undefined
      ? {}
      : { toolName: safeLabel(raw.tool_name) }),
    ...(raw.duration_ms === undefined
      ? {}
      : { durationMs: Math.round(raw.duration_ms) }),
    ...(safeEnum(raw.error) === undefined
      ? {}
      : { failureType: safeEnum(raw.error) }),
    ...(safeEnum(raw.reason) === undefined
      ? {}
      : { endReason: safeEnum(raw.reason) }),
  });
}

export function claudeDeliveryEventId(deliveryKey: string): string {
  return `claude-delivery-${deliveryKey}-0`;
}

function runId(record: ClaudeHookRecord): string {
  return `claude-${record.sessionKey}`;
}

function rootNodeId(record: ClaudeHookRecord): string {
  return `claude-root-${record.sessionKey}`;
}

function coordinator(record: ClaudeHookRecord): Actor {
  return {
    id: `claude-coordinator-${record.sessionKey}`,
    label: "Claude Code coordinator",
    type: "agent",
  };
}

function agent(record: ClaudeHookRecord): Actor {
  if (record.agentKey === undefined) return coordinator(record);
  return {
    id: `claude-agent-${record.agentKey}`,
    label: record.agentType ?? "Claude Code subagent",
    type: "agent",
  };
}

function provenance(record: ClaudeHookRecord, locator: string) {
  return {
    adapter: "claude-code",
    locator,
    digest: digest(`${record.deliveryKey}:${locator}`, 64),
    contentCaptured: false,
  } as const;
}

export function projectClaudeHook(
  input: unknown,
  projection: ResearchProjection | undefined,
): ResearchEvent[] {
  const record = claudeHookRecordSchema.parse(input);
  const events: ResearchEvent[] = [];
  let sequence = projection?.lastSequence ?? -1;
  const system: Actor = {
    id: "adapter-claude-code",
    label: "Claude Code adapter",
    type: "system",
  };

  function emit(
    id: string,
    actor: Actor,
    event: Omit<
      ResearchEvent,
      "schemaVersion" | "id" | "runId" | "sequence" | "observedAt" | "actor"
    >,
  ): void {
    sequence += 1;
    events.push(
      researchEventSchema.parse({
        schemaVersion: 1,
        id,
        runId: runId(record),
        sequence,
        observedAt: record.observedAt,
        actor,
        ...event,
      }),
    );
  }

  if (projection === undefined) {
    emit(`claude-bootstrap-${record.sessionKey}-run`, system, {
      type: "run.started",
      payload: {
        title: "Claude Code research session",
        objective:
          "Supervise agent activity without capturing conversation content.",
      },
    });
    emit(`claude-bootstrap-${record.sessionKey}-root`, system, {
      type: "research.node.upserted",
      payload: {
        node: {
          id: rootNodeId(record),
          kind: "question",
          title: "Research objective",
          summary:
            "Content stays in Claude Code; Zmind+ records lifecycle metadata only.",
          status: "active",
          ownerId: coordinator(record).id,
          tags: ["claude-code", "metadata-only"],
          provenance: provenance(record, `sessions/${record.sessionKey}`),
        },
      },
    });
  }

  const baseId = claudeDeliveryEventId(record.deliveryKey);
  const activeProjection = projection;
  const currentAgent = agent(record);
  const currentAgentNodeId =
    record.agentKey === undefined
      ? undefined
      : `claude-agent-node-${record.agentKey}`;
  const taskNodeId =
    record.taskKey === undefined ? undefined : `claude-task-${record.taskKey}`;

  switch (record.eventName) {
    case "SessionStart":
      emit(baseId, coordinator(record), {
        type: "agent.status.changed",
        payload: {
          agent: coordinator(record),
          status: "working",
          focus:
            record.source === "resume"
              ? "Resumed research session"
              : "Started research session",
        },
      });
      break;
    case "SubagentStart": {
      emit(baseId, currentAgent, {
        type: "agent.status.changed",
        payload: {
          agent: currentAgent,
          status: "working",
          focus: "Working on an assigned research branch",
        },
      });
      if (currentAgentNodeId !== undefined) {
        emit(`${baseId}-node`, currentAgent, {
          type: "research.node.upserted",
          payload: {
            node: {
              id: currentAgentNodeId,
              kind: "proposal",
              title: `${record.agentType ?? "Specialist"} branch`,
              summary:
                "Subagent activity is visible; its conversation content remains private.",
              status: "active",
              ownerId: currentAgent.id,
              tags: ["subagent", "metadata-only"],
              provenance: provenance(record, `agents/${record.agentKey}`),
            },
          },
        });
        if (
          !activeProjection?.edges.has(`claude-edge-root-${record.agentKey}`)
        ) {
          emit(`${baseId}-edge`, currentAgent, {
            type: "research.edge.upserted",
            payload: {
              edge: {
                id: `claude-edge-root-${record.agentKey}`,
                source: rootNodeId(record),
                target: currentAgentNodeId,
                kind: "decomposes",
              },
            },
          });
        }
      }
      break;
    }
    case "SubagentStop":
      emit(baseId, currentAgent, {
        type: "agent.status.changed",
        payload: {
          agent: currentAgent,
          status: "complete",
          focus: "Completed an assigned research branch",
        },
      });
      if (currentAgentNodeId !== undefined) {
        emit(`${baseId}-node`, currentAgent, {
          type: "research.node.upserted",
          payload: {
            node: {
              id: currentAgentNodeId,
              kind: "proposal",
              title: `${record.agentType ?? "Specialist"} branch`,
              summary:
                "Subagent activity completed; conversation content was not captured.",
              status: "complete",
              ownerId: currentAgent.id,
              tags: ["subagent", "metadata-only"],
              provenance: provenance(record, `agents/${record.agentKey}`),
            },
          },
        });
        if (
          !activeProjection?.edges.has(`claude-edge-root-${record.agentKey}`)
        ) {
          emit(`${baseId}-edge`, currentAgent, {
            type: "research.edge.upserted",
            payload: {
              edge: {
                id: `claude-edge-root-${record.agentKey}`,
                source: rootNodeId(record),
                target: currentAgentNodeId,
                kind: "decomposes",
              },
            },
          });
        }
      }
      break;
    case "TaskCreated":
    case "TaskCompleted":
      if (taskNodeId === undefined || record.taskKey === undefined) {
        emit(baseId, currentAgent, {
          type: "agent.status.changed",
          payload: {
            agent: currentAgent,
            status: record.eventName === "TaskCreated" ? "working" : "complete",
            focus:
              record.eventName === "TaskCreated"
                ? "Created a research task"
                : "Completed a research task",
          },
        });
        break;
      }
      const taskKey = record.taskKey;
      emit(baseId, currentAgent, {
        type: "research.node.upserted",
        payload: {
          node: {
            id: taskNodeId,
            kind: "experiment",
            title: `Research task ${taskKey.slice(0, 6)}`,
            summary:
              "Task text remains in Claude Code; only lifecycle state is recorded.",
            status: record.eventName === "TaskCreated" ? "active" : "complete",
            ownerId: currentAgent.id,
            tags: ["task", "metadata-only"],
            provenance: provenance(record, `tasks/${taskKey}`),
          },
        },
      });
      if (!activeProjection?.edges.has(`claude-edge-task-${taskKey}`)) {
        emit(`${baseId}-edge`, currentAgent, {
          type: "research.edge.upserted",
          payload: {
            edge: {
              id: `claude-edge-task-${taskKey}`,
              source:
                currentAgentNodeId !== undefined &&
                activeProjection?.nodes.has(currentAgentNodeId)
                  ? currentAgentNodeId
                  : rootNodeId(record),
              target: taskNodeId,
              kind: "tests",
            },
          },
        });
      }
      break;
    case "PostToolUse":
      emit(baseId, currentAgent, {
        type: "agent.status.changed",
        payload: {
          agent: currentAgent,
          status: "working",
          focus: `${record.toolName ?? "Tool"} completed${record.durationMs === undefined ? "" : ` in ${record.durationMs} ms`}`,
        },
      });
      break;
    case "Stop":
      emit(baseId, coordinator(record), {
        type: "agent.status.changed",
        payload: {
          agent: coordinator(record),
          status: "waiting",
          focus: "Waiting for the next instruction",
        },
      });
      break;
    case "StopFailure":
      emit(baseId, coordinator(record), {
        type: "agent.status.changed",
        payload: {
          agent: coordinator(record),
          status: "failed",
          focus:
            record.failureType === undefined
              ? "Turn failed"
              : `Turn failed: ${record.failureType.replaceAll("_", " ")}`,
        },
      });
      break;
    case "SessionEnd":
      emit(baseId, coordinator(record), {
        type: "agent.status.changed",
        payload: {
          agent: coordinator(record),
          status: "complete",
          focus: "Research session ended",
        },
      });
      break;
  }

  return events;
}

export function claudeHookSettings(command = "zmind-claude-hook") {
  const events = [
    "SessionStart",
    "SubagentStart",
    "SubagentStop",
    "TaskCreated",
    "TaskCompleted",
    "PostToolUse",
    "Stop",
    "StopFailure",
    "SessionEnd",
  ] as const;
  return {
    hooks: Object.fromEntries(
      events.map((eventName) => [
        eventName,
        [
          {
            matcher: "",
            hooks: [{ type: "command", command, async: true }],
          },
        ],
      ]),
    ),
  };
}
