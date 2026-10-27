import { z } from "zod";

import { researchEventSchema, type ResearchEvent } from "@zmind-plus/core";

const appendResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  lastSequence: z.number().int().min(-1),
});

const errorResponseSchema = z.object({
  error: z.string().min(1).max(300),
});

export interface AppendReceipt {
  runId: string;
  accepted: number;
  duplicates: number;
  lastSequence: number;
  requests: number;
}

export interface ZmindClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export class ZmindSdkError extends Error {}

export const DEFAULT_APPEND_BODY_BYTES = 900_000;
export const DEFAULT_APPEND_EVENT_LIMIT = 500;

function validatedEvents(input: readonly unknown[]): ResearchEvent[] {
  if (input.length === 0)
    throw new ZmindSdkError("At least one event is required");
  const events = input.map((event) => researchEventSchema.parse(event));
  const runId = events[0]!.runId;

  for (const [index, event] of events.entries()) {
    if (event.runId !== runId) {
      throw new ZmindSdkError("One append call cannot contain multiple runs");
    }
    if (index > 0 && event.sequence <= events[index - 1]!.sequence) {
      throw new ZmindSdkError(
        "Events must be in strictly increasing sequence order",
      );
    }
  }

  return events;
}

export function createResearchEventBatches(
  events: readonly ResearchEvent[],
  options: {
    maxBodyBytes?: number;
    maxEvents?: number;
  } = {},
): ResearchEvent[][] {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_APPEND_BODY_BYTES;
  const maxEvents = options.maxEvents ?? DEFAULT_APPEND_EVENT_LIMIT;
  if (maxBodyBytes < 3 || maxEvents < 1) {
    throw new ZmindSdkError("Batch limits must be positive");
  }

  const encoder = new TextEncoder();
  const batches: ResearchEvent[][] = [];
  let batch: ResearchEvent[] = [];
  let batchBytes = 2;

  for (const event of events) {
    const eventBytes = encoder.encode(JSON.stringify(event)).byteLength;
    if (eventBytes + 2 > maxBodyBytes) {
      throw new ZmindSdkError(
        `Event ${event.sequence} is too large for the local runtime`,
      );
    }

    const separatorBytes = batch.length === 0 ? 0 : 1;
    if (
      batch.length >= maxEvents ||
      batchBytes + separatorBytes + eventBytes > maxBodyBytes
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = 2;
    }

    batch.push(event);
    batchBytes += (batch.length === 1 ? 0 : 1) + eventBytes;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
}

export function parseResearchJsonl(input: string): ResearchEvent[] {
  const events: ResearchEvent[] = [];
  for (const [index, sourceLine] of input.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (line.length === 0) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new ZmindSdkError(`Line ${index + 1} is not valid JSON`);
    }
    const parsed = researchEventSchema.safeParse(value);
    if (!parsed.success) {
      throw new ZmindSdkError(
        `Line ${index + 1} is not a valid research event`,
      );
    }
    events.push(parsed.data);
  }
  return validatedEvents(events);
}

export function serializeResearchJsonl(input: readonly unknown[]): string {
  return `${validatedEvents(input)
    .map((event) => JSON.stringify(event))
    .join("\n")}\n`;
}

export class ZmindClient {
  readonly #baseUrl: string;
  readonly #fetcher: typeof fetch;

  constructor(options: ZmindClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "http://127.0.0.1:4310").replace(
      /\/+$/,
      "",
    );
    const fetcher = options.fetcher ?? globalThis.fetch;
    this.#fetcher = (input, init) => fetcher(input, init);
  }

  async append(input: readonly unknown[]): Promise<AppendReceipt> {
    const events = validatedEvents(input);
    const runId = events[0]!.runId;
    const receipt: AppendReceipt = {
      runId,
      accepted: 0,
      duplicates: 0,
      lastSequence: -1,
      requests: 0,
    };

    for (const batch of createResearchEventBatches(events)) {
      const response = await this.#fetcher(
        `${this.#baseUrl}/api/runs/${encodeURIComponent(runId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        },
      );
      if (!response.ok) {
        const errorBody = errorResponseSchema.safeParse(
          await response.json().catch(() => undefined),
        );
        const detail = errorBody.success ? `: ${errorBody.data.error}` : "";
        throw new ZmindSdkError(
          `Runtime rejected event batch (${response.status})${detail}`,
        );
      }

      const batchReceipt = appendResponseSchema.parse(await response.json());
      receipt.accepted += batchReceipt.accepted;
      receipt.duplicates += batchReceipt.duplicates;
      receipt.lastSequence = batchReceipt.lastSequence;
      receipt.requests += 1;
    }

    return receipt;
  }

  async appendJsonl(input: string): Promise<AppendReceipt> {
    return this.append(parseResearchJsonl(input));
  }
}
