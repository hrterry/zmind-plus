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

export class ZmindClient {
  readonly #baseUrl: string;
  readonly #fetcher: typeof fetch;

  constructor(options: ZmindClientOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "http://127.0.0.1:4311").replace(
      /\/+$/,
      "",
    );
    this.#fetcher = options.fetcher ?? fetch;
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

    for (let offset = 0; offset < events.length; offset += 500) {
      const batch = events.slice(offset, offset + 500);
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
