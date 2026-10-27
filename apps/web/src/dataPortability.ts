import type { ResearchEvent } from "@zmind-plus/core";
import {
  parseResearchJsonl,
  serializeResearchJsonl,
  ZmindClient,
  ZmindSdkError,
  type AppendReceipt,
} from "@zmind-plus/sdk";

import { fetchResearchEventHistory, type RunSummary } from "./useResearchRun";

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export class DataPortabilityError extends Error {}

export function validatePortableRun(input: string): ResearchEvent[] {
  let events: ResearchEvent[];
  try {
    events = parseResearchJsonl(input);
  } catch (error) {
    if (error instanceof ZmindSdkError) {
      throw new DataPortabilityError(error.message);
    }
    throw error;
  }

  if (events[0]?.type !== "run.started" || events[0].sequence !== 0) {
    throw new DataPortabilityError(
      "The file must begin with the run start event at sequence 0",
    );
  }
  for (let index = 1; index < events.length; index += 1) {
    if (events[index]!.sequence !== events[index - 1]!.sequence + 1) {
      throw new DataPortabilityError(
        `The event sequence has a gap before ${events[index]!.sequence}`,
      );
    }
  }
  return events;
}

export async function importResearchJsonl(
  file: Pick<File, "size" | "text">,
  fetcher: typeof fetch = fetch,
): Promise<AppendReceipt> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new DataPortabilityError(
      "This file is over 25 MiB. Use the local import command for larger archives.",
    );
  }
  const events = validatePortableRun(await file.text());
  try {
    return await new ZmindClient({ baseUrl: "", fetcher }).append(events);
  } catch (error) {
    if (error instanceof ZmindSdkError) {
      throw new DataPortabilityError(error.message);
    }
    throw error;
  }
}

export async function exportResearchJsonl(
  run: RunSummary,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const events = await fetchResearchEventHistory(
    run.id,
    run.lastSequence,
    new AbortController().signal,
    fetcher,
  );
  return serializeResearchJsonl(events);
}

export function portableFilename(title: string): string {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  return `${safeTitle || "research-run"}.jsonl`;
}

export function downloadText(filename: string, contents: string): void {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/x-ndjson;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
