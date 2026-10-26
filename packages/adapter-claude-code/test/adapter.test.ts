import { describe, expect, it } from "vitest";

import { projectEvents } from "@zmind-plus/core";

import {
  claudeHookSettings,
  projectClaudeHook,
  sanitizeClaudeHook,
} from "../src";

const observedAt = "2026-10-26T20:00:00.000Z";

describe("Claude Code adapter", () => {
  it("drops conversation content and machine paths at the process boundary", () => {
    const privateText = "PRIVATE_VALUE_MUST_NOT_ESCAPE";
    const record = sanitizeClaudeHook(
      {
        session_id: "session-123",
        prompt_id: "prompt-123",
        hook_event_name: "PostToolUse",
        agent_id: "agent-123",
        agent_type: "Explore",
        tool_use_id: "tool-123",
        tool_name: "Read",
        duration_ms: 42,
        cwd: `/private/${privateText}`,
        transcript_path: `/private/${privateText}/transcript.jsonl`,
        scratchpad_dir: `/private/${privateText}/scratch`,
        prompt: privateText,
        task_description: privateText,
        tool_input: { content: privateText },
        tool_response: { output: privateText },
        last_assistant_message: privateText,
        compact_summary: privateText,
        unknown_future_field: privateText,
      },
      observedAt,
    );

    expect(JSON.stringify(record)).not.toContain(privateText);
    expect(record).toEqual(
      expect.objectContaining({
        eventName: "PostToolUse",
        agentType: "Explore",
        toolName: "Read",
        durationMs: 42,
      }),
    );
    expect(record.sessionKey).not.toContain("session-123");
  });

  it("bootstraps a valid run and projects subagent lifecycle branches", () => {
    const session = sanitizeClaudeHook(
      {
        session_id: "session-123",
        hook_event_name: "SessionStart",
        source: "startup",
      },
      observedAt,
    );
    const initialEvents = projectClaudeHook(session, undefined);
    const initial = projectEvents(initialEvents);

    expect(initialEvents.map((event) => event.type)).toEqual([
      "run.started",
      "research.node.upserted",
      "agent.status.changed",
    ]);
    expect(initial.nodes.size).toBe(1);

    const started = sanitizeClaudeHook(
      {
        session_id: "session-123",
        prompt_id: "prompt-123",
        hook_event_name: "SubagentStart",
        agent_id: "agent-123",
        agent_type: "security-reviewer",
      },
      "2026-10-26T20:00:01.000Z",
    );
    const startedEvents = projectClaudeHook(started, initial);
    const withAgent = projectEvents([...initialEvents, ...startedEvents]);

    expect(withAgent.nodes.size).toBe(2);
    expect(withAgent.edges.size).toBe(1);
    expect([...withAgent.agents.values()]).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "working" })]),
    );

    const stopped = sanitizeClaudeHook(
      {
        session_id: "session-123",
        prompt_id: "prompt-123",
        hook_event_name: "SubagentStop",
        agent_id: "agent-123",
        agent_type: "security-reviewer",
        last_assistant_message: "PRIVATE_SUBAGENT_RESPONSE_92741",
      },
      "2026-10-26T20:00:02.000Z",
    );
    const stoppedEvents = projectClaudeHook(stopped, withAgent);
    const completed = projectEvents([
      ...initialEvents,
      ...startedEvents,
      ...stoppedEvents,
    ]);
    const branch = [...completed.nodes.values()].find((node) =>
      node.tags.includes("subagent"),
    );

    expect(branch?.status).toBe("complete");
    expect(JSON.stringify(stoppedEvents)).not.toContain(
      "PRIVATE_SUBAGENT_RESPONSE_92741",
    );
  });

  it("generates non-blocking hooks for every supported lifecycle event", () => {
    const settings = claudeHookSettings();
    const hooks = Object.values(settings.hooks).flatMap((entries) => entries);

    expect(Object.keys(settings.hooks)).toHaveLength(9);
    expect(hooks.every((entry) => entry.hooks[0]?.async === true)).toBe(true);
  });

  it("rejects lifecycle events missing their documented identifiers", () => {
    expect(() =>
      sanitizeClaudeHook({
        session_id: "session-123",
        hook_event_name: "PostToolUse",
        tool_name: "Read",
      }),
    ).toThrow();
    expect(() =>
      sanitizeClaudeHook({
        session_id: "session-123",
        hook_event_name: "SubagentStart",
      }),
    ).toThrow();
  });
});
