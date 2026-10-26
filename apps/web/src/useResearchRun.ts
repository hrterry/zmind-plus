import { useEffect, useState } from "react";

import {
  researchEventSchema,
  syntheticResearchEvents,
  type ResearchEvent,
} from "@zmind-plus/core";

export type ConnectionMode = "connecting" | "live" | "reconnecting" | "demo";

interface RunSummary {
  id: string;
  updatedAt: string;
  lastSequence: number;
}

interface RunsResponse {
  runs: RunSummary[];
}

interface EventsResponse {
  events: unknown[];
}

export function mergeResearchEvents(
  current: readonly ResearchEvent[],
  incoming: readonly ResearchEvent[],
): ResearchEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

export async function fetchResearchEventHistory(
  runId: string,
  lastSequence: number,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<ResearchEvent[]> {
  const events: ResearchEvent[] = [];
  let after = -1;

  while (after < lastSequence) {
    const response = await fetcher(
      `/api/runs/${encodeURIComponent(runId)}/events?after=${after}&limit=1000`,
      { signal },
    );
    if (!response.ok) throw new Error("Runtime event replay is unavailable");
    const payload = (await response.json()) as EventsResponse;
    const page = payload.events.map((event) =>
      researchEventSchema.parse(event),
    );
    if (page.length === 0) {
      throw new Error("Runtime event replay ended before the run cursor");
    }

    for (const event of page) {
      if (event.runId !== runId || event.sequence !== after + 1) {
        throw new Error("Runtime event replay is not contiguous");
      }
      events.push(event);
      after = event.sequence;
    }
  }

  return events;
}

export function useResearchRun() {
  const [events, setEvents] = useState<ResearchEvent[]>(
    syntheticResearchEvents,
  );
  const [mode, setMode] = useState<ConnectionMode>("connecting");

  useEffect(() => {
    const controller = new AbortController();
    let stream: EventSource | undefined;

    async function connect() {
      try {
        const runsResponse = await fetch("/api/runs", {
          signal: controller.signal,
        });
        if (!runsResponse.ok)
          throw new Error("Runtime run list is unavailable");
        const runs = (await runsResponse.json()) as RunsResponse;
        const latest = [...runs.runs].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )[0];

        if (latest === undefined) {
          setMode("demo");
          return;
        }

        const replay = await fetchResearchEventHistory(
          latest.id,
          latest.lastSequence,
          controller.signal,
        );
        setEvents(replay);
        setMode("live");

        const cursor = replay.at(-1)?.sequence ?? -1;
        stream = new EventSource(
          `/api/runs/${latest.id}/stream?after=${cursor}`,
        );
        stream.addEventListener("open", () => setMode("live"));
        stream.addEventListener("error", () => setMode("reconnecting"));
        stream.addEventListener("research-event", (message) => {
          try {
            const event = researchEventSchema.parse(
              JSON.parse((message as MessageEvent).data),
            );
            setEvents((current) => mergeResearchEvents(current, [event]));
          } catch {
            console.warn(
              "The local runtime emitted an invalid research event.",
            );
          }
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Using the local synthetic scenario.", error);
        setEvents(syntheticResearchEvents);
        setMode("demo");
      }
    }

    void connect();
    return () => {
      controller.abort();
      stream?.close();
    };
  }, []);

  return { events, mode };
}
