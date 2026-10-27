import type { ResearchEvent } from "@zmind-plus/core";

type EventListener = (event: ResearchEvent) => void;

export class EventHub {
  readonly #listeners = new Map<string, Set<EventListener>>();

  constructor(readonly maxListenersPerRun = 32) {}

  subscribe(runId: string, listener: EventListener): () => void {
    const listeners = this.#listeners.get(runId) ?? new Set<EventListener>();
    if (listeners.size >= this.maxListenersPerRun) {
      throw new Error("This run has reached the live viewer limit");
    }
    listeners.add(listener);
    this.#listeners.set(runId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(runId);
    };
  }

  publish(events: readonly ResearchEvent[]): void {
    for (const event of events) {
      for (const listener of this.#listeners.get(event.runId) ?? []) {
        listener(event);
      }
    }
  }

  listenerCount(runId: string): number {
    return this.#listeners.get(runId)?.size ?? 0;
  }
}
