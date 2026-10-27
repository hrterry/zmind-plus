import { claudeHookSettings, sanitizeClaudeHook } from "./index";

const MAX_INPUT_BYTES = 1_048_576;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_INPUT_BYTES) throw new Error("Hook input is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  if (process.argv.includes("--print-settings")) {
    process.stdout.write(`${JSON.stringify(claudeHookSettings(), null, 2)}\n`);
    return;
  }

  const raw = JSON.parse(await readStdin()) as unknown;
  const record = sanitizeClaudeHook(raw);
  const runtimeUrl = (
    process.env.ZMIND_RUNTIME_URL ?? "http://127.0.0.1:4310"
  ).replace(/\/+$/, "");
  const response = await fetch(`${runtimeUrl}/api/adapters/claude-code/hooks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
    signal: AbortSignal.timeout(1_000),
  });
  if (!response.ok) throw new Error("The local runtime rejected the hook");
}

main().catch(() => {
  if (process.env.ZMIND_HOOK_STRICT === "1") {
    process.stderr.write("Zmind+ could not record this lifecycle event.\n");
    process.exitCode = 1;
  }
});
