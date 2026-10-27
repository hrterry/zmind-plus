# Zmind+ MCP research recorder

This local stdio server gives MCP-capable agent hosts five explicit tools for
recording a semantic research map. It uses the official MCP TypeScript SDK v2
and the 2026-07-28 protocol while retaining SDK-managed compatibility with
legacy hosts.

## Local setup

Start the Zmind+ runtime, then build and link the recorder:

```bash
npm run build --workspace=@zmind-plus/mcp-server
npm link ./packages/mcp-server
claude mcp add zmind-plus -- zmind-mcp
```

Run `/mcp` in Claude Code to confirm that `zmind-plus` is connected. Set
`ZMIND_RUNTIME_URL` before launching Claude Code when the runtime is not at
`http://127.0.0.1:4310`.

The recorder exposes `start_research`, `attach_latest_research`,
`record_finding`, `connect_findings`, `request_human_review`, and
`get_research_state`. Use `attach_latest_research` to add semantic findings to
the same run that lifecycle hooks created automatically. The recorder stores
only content that the agent deliberately supplies to one of these tools. It
does not read hidden reasoning, the conversation transcript, files, prompts,
or tool results.

See the [research recorder plan](../../docs/MCP_RESEARCH_RECORDER_PLAN.md) for
the event and safety contract.
