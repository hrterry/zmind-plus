import { readFile } from "node:fs/promises";

import { ZmindClient, ZmindSdkError } from "./index";

interface CliOptions {
  file: string;
  runtime: string;
}

function parseArguments(arguments_: readonly string[]): CliOptions {
  let file = "-";
  let runtime = "http://127.0.0.1:4310";

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--file") {
      file = arguments_[index + 1] ?? "";
      index += 1;
    } else if (argument === "--runtime") {
      runtime = arguments_[index + 1] ?? "";
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: zmind-import [--file run.jsonl|-] [--runtime http://127.0.0.1:4310]",
      );
      process.exit(0);
    } else {
      throw new ZmindSdkError(`Unknown argument: ${argument}`);
    }
  }

  if (file.length === 0) throw new ZmindSdkError("--file requires a value");
  if (!/^https?:\/\//.test(runtime)) {
    throw new ZmindSdkError("--runtime must be an HTTP or HTTPS URL");
  }
  return { file, runtime };
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += String(chunk);
  return input;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const input =
    options.file === "-"
      ? await readStdin()
      : await readFile(options.file, "utf8");
  const receipt = await new ZmindClient({
    baseUrl: options.runtime,
  }).appendJsonl(input);
  console.log(
    `Imported ${receipt.accepted} events for ${receipt.runId}; ` +
      `${receipt.duplicates} duplicates; sequence ${receipt.lastSequence}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Import failed";
  console.error(`Zmind+ import failed: ${message}`);
  process.exitCode = 1;
});
