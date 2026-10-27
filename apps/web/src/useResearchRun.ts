import { useCallback, useEffect, useRef, useState } from "react";

import {
  researchEventSchema,
  syntheticResearchEvents,
  type ResearchEvent,
} from "@zmind-plus/core";

export type ConnectionMode = "connecting" | "live" | "reconnecting" | "demo";

export interface RunSummary {
  id: string;
  title: string;
  objective: string;
  updatedAt: string;
  lastSequence: number;
}

interface RunsResponse {
  runs: RunSummary[];
}

interface EventsResponse {
  events: unknown[];
}

export function chooseRunId(
  current: string | undefined,
  runs: readonly RunSummary[],
  manuallySelected: boolean,
): string | undefined {
  if (
    manuallySelected &&
    current !== undefined &&
    runs.some((run) => run.id === current)
  ) {
    return current;
  }
  return runs[0]?.id;
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
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [connectionRevision, setConnectionRevision] = useState(0);
  const manualSelection = useRef(false);
  const runsRef = useRef<RunSummary[]>([]);

  const discoverRuns = useCallback(
    async (signal?: AbortSignal, preferredRunId?: string) => {
      const runsResponse = await fetch(
        "/api/runs",
        signal === undefined ? undefined : { signal },
      );
      if (!runsResponse.ok) throw new Error("Runtime run list is unavailable");
      const payload = (await runsResponse.json()) as RunsResponse;
      const sorted = [...payload.runs].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
      runsRef.current = sorted;
      setRuns(sorted);
      if (preferredRunId !== undefined) {
        if (!sorted.some((run) => run.id === preferredRunId)) {
          throw new Error("The imported run is not available yet");
        }
        manualSelection.current = true;
        setSelectedRunId(preferredRunId);
        setConnectionRevision((revision) => revision + 1);
      } else {
        setSelectedRunId((current) =>
          chooseRunId(current, sorted, manualSelection.current),
        );
      }
      if (sorted.length === 0) setMode("demo");
      return sorted;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function pollRuns() {
      try {
        await discoverRuns(controller.signal);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Local run discovery is unavailable.", error);
        if (runsRef.current.length === 0) setMode("demo");
      }
    }

    void pollRuns();
    const poll = window.setInterval(() => void pollRuns(), 2_000);
    return () => {
      controller.abort();
      window.clearInterval(poll);
    };
  }, [discoverRuns]);

  useEffect(() => {
    if (selectedRunId === undefined) return;
    const activeRunId = selectedRunId;
    const controller = new AbortController();
    let stream: EventSource | undefined;
    const selected = runsRef.current.find((run) => run.id === activeRunId);
    if (selected === undefined) return;
    const lastSequence = selected.lastSequence;

    async function connect() {
      setMode("connecting");
      try {
        const replay = await fetchResearchEventHistory(
          activeRunId,
          lastSequence,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setEvents(replay);
        setMode("live");

        const cursor = replay.at(-1)?.sequence ?? -1;
        stream = new EventSource(
          `/api/runs/${encodeURIComponent(activeRunId)}/stream?after=${cursor}`,
        );
        stream.addEventListener("open", () => setMode("live"));
        stream.addEventListener("error", () => setMode("reconnecting"));
        stream.addEventListener("research-event", (message) => {
          try {
            const event = researchEventSchema.parse(
              JSON.parse((message as MessageEvent).data),
            );
            if (event.runId !== activeRunId) return;
            setEvents((current) => mergeResearchEvents(current, [event]));
          } catch {
            console.warn(
              "The local runtime emitted an invalid research event.",
            );
          }
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("The selected local run is unavailable.", error);
        setMode("reconnecting");
      }
    }

    void connect();
    return () => {
      controller.abort();
      stream?.close();
    };
  }, [connectionRevision, selectedRunId]);

  function selectRun(runId: string) {
    manualSelection.current = true;
    setSelectedRunId(runId);
  }

  async function openRun(runId: string): Promise<void> {
    await discoverRuns(undefined, runId);
  }

  return { events, mode, runs, selectedRunId, selectRun, openRun };
}
