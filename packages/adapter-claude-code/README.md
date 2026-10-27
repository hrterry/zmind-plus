# Claude Code adapter

This optional adapter turns Claude Code lifecycle hooks into provider-neutral
Zmind+ research events. It captures metadata only: prompts, responses,
transcripts, task descriptions, tool inputs, tool outputs, and local paths are
discarded before the hook command makes a network request.

## Local setup

From a Zmind+ checkout:

```bash
npm run build --workspace=@zmind-plus/adapter-claude-code
npm link ./packages/adapter-claude-code
zmind-claude-hook --print-settings
```

Merge the printed `hooks` object into the Claude Code settings scope you want:

- `.claude/settings.local.json` for this checkout and this user;
- `.claude/settings.json` for a shared project configuration;
- `~/.claude/settings.json` for every local project.

Do not replace an existing `hooks` object. Merge the generated event keys with
the hooks already configured. Run `/hooks` inside Claude Code to confirm the
configuration was loaded.

The hook sends through the public local gateway at `http://127.0.0.1:4310` by
default, which works with both Vite development and Docker. Set
`ZMIND_RUNTIME_URL` if the local runtime uses another address. Visualization is
best-effort and never blocks Claude Code when the runtime is down. Set
`ZMIND_HOOK_STRICT=1` only when a missing visualization event should fail the
hook.

The implementation follows Anthropic's current
[hooks reference](https://code.claude.com/docs/en/hooks) and
[settings scope documentation](https://code.claude.com/docs/en/settings).
