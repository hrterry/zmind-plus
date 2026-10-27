import { randomUUID } from "node:crypto";

import {
  edgeKindSchema,
  nodeKindSchema,
  nodeStatusSchema,
  researchEventSchema,
  type EdgeKind,
  type NodeKind,
  type NodeStatus,
  type ResearchEvent,
} from "@zmind-plus/core";

interface ProjectionResponse {
  runId: string;
  lastSequence: number;
  nodes: Array<{ id: string; title: string; status: NodeStatus }>;
  edges: Array<{ id: string; source: string; target: string; kind: EdgeKind }>;
}

export interface ResearchState {
  runId: string;
  lastSequence: number;
  nodes: ProjectionResponse["nodes"];
  edges: ProjectionResponse["edges"];
}

export interface ResearchWriterOptions {
  baseUrl?: string | undefined;
  fetcher?: typeof fetch | undefined;
}

export class ResearchWriterError extends Error {}

export class ResearchWriter {
  readonly #baseUrl: string;
  readonly #fetcher: typeof fetch;
  #activeRunId: string | undefined;

  constructor(options: ResearchWriterOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? "http://127.0.0.1:4310").replace(
      /\/+$/,
      "",
    );
    this.#fetcher = options.fetcher ?? fetch;
  }

  get activeRunId(): string | undefined {
    return this.#activeRunId;
  }

  async attachLatestResearch(): Promise<ResearchState> {
    const response = await this.#fetcher(`${this.#baseUrl}/api/runs`);
    if (!response.ok)
      throw new ResearchWriterError("The local runtime is unavailable");
    const payload = (await response.json()) as {
      runs?: Array<{ id: string; updatedAt: string }>;
    };
    const latest = [...(payload.runs ?? [])].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    )[0];
    if (latest === undefined) {
      throw new ResearchWriterError("No local research run is available yet");
    }
    this.#activeRunId = latest.id;
    return this.getResearchState();
  }

  async startResearch(input: {
    title: string;
    objective: string;
    rootTitle?: string | undefined;
    runId?: string | undefined;
  }): Promise<ResearchState> {
    const runId = input.runId ?? `run-${randomUUID()}`;
    const existing = await this.#projection(runId);
    if (existing !== undefined) {
      throw new ResearchWriterError("That research run already exists");
    }
    const actor = {
      id: "mcp-recorder",
      label: "Research recorder",
      type: "system",
    } as const;
    const observedAt = new Date().toISOString();
    const rootId = `root-${randomUUID()}`;
    const events = [
      researchEventSchema.parse({
        schemaVersion: 1,
        id: `event-${randomUUID()}`,
        runId,
        sequence: 0,
        observedAt,
        actor,
        type: "run.started",
        payload: { title: input.title, objective: input.objective },
      }),
      researchEventSchema.parse({
        schemaVersion: 1,
        id: `event-${randomUUID()}`,
        runId,
        sequence: 1,
        observedAt,
        actor,
        type: "research.node.upserted",
        payload: {
          node: {
            id: rootId,
            kind: "question",
            title: input.rootTitle ?? input.title,
            summary: input.objective,
            status: "active",
            tags: ["mcp-recorded"],
            provenance: {
              adapter: "mcp",
              locator: `runs/${runId}/nodes/${rootId}`,
              digest: `mcp-${rootId}`,
              contentCaptured: true,
            },
          },
        },
      }),
    ];
    await this.#append(runId, events);
    this.#activeRunId = runId;
    return (await this.#projection(runId))!;
  }

  async recordFinding(input: {
    id?: string | undefined;
    kind: NodeKind;
    title: string;
    summary: string;
    status?: NodeStatus | undefined;
    confidence?: number | undefined;
    tags?: string[] | undefined;
  }): Promise<{ runId: string; nodeId: string }> {
    const runId = this.#requireRun();
    const nodeId = input.id ?? `node-${randomUUID()}`;
    nodeKindSchema.parse(input.kind);
    nodeStatusSchema.parse(input.status ?? "active");
    await this.#appendWithCursor(runId, (sequence) => [
      researchEventSchema.parse({
        schemaVersion: 1,
        id: `event-${randomUUID()}`,
        runId,
        sequence,
        observedAt: new Date().toISOString(),
        actor: {
          id: "mcp-recorder",
          label: "Research recorder",
          type: "system",
        },
        type: "research.node.upserted",
        payload: {
          node: {
            id: nodeId,
            kind: input.kind,
            title: input.title,
            summary: input.summary,
            status: input.status ?? "active",
            ...(input.confidence === undefined
              ? {}
              : { confidence: input.confidence }),
            tags: input.tags ?? [],
            provenance: {
              adapter: "mcp",
              locator: `runs/${runId}/nodes/${nodeId}`,
              digest: `mcp-${nodeId}`,
              contentCaptured: true,
            },
          },
        },
      }),
    ]);
    return { runId, nodeId };
  }

  async connectFindings(input: {
    source: string;
    target: string;
    kind: EdgeKind;
    label?: string | undefined;
  }): Promise<{ runId: string; edgeId: string }> {
    const runId = this.#requireRun();
    edgeKindSchema.parse(input.kind);
    const state = await this.getResearchState();
    const nodeIds = new Set(state.nodes.map((node) => node.id));
    if (!nodeIds.has(input.source) || !nodeIds.has(input.target)) {
      throw new ResearchWriterError("Both relationship endpoints must exist");
    }
    const edgeId = `edge-${randomUUID()}`;
    await this.#appendWithCursor(runId, (sequence) => [
      researchEventSchema.parse({
        schemaVersion: 1,
        id: `event-${randomUUID()}`,
        runId,
        sequence,
        observedAt: new Date().toISOString(),
        actor: {
          id: "mcp-recorder",
          label: "Research recorder",
          type: "system",
        },
        type: "research.edge.upserted",
        payload: { edge: { id: edgeId, ...input } },
      }),
    ]);
    return { runId, edgeId };
  }

  async requestHumanReview(input: {
    nodeId: string;
    reason: string;
    urgency: "low" | "medium" | "high";
  }): Promise<{ runId: string }> {
    const runId = this.#requireRun();
    const state = await this.getResearchState();
    if (!state.nodes.some((node) => node.id === input.nodeId)) {
      throw new ResearchWriterError("The review target must exist");
    }
    await this.#appendWithCursor(runId, (sequence) => [
      researchEventSchema.parse({
        schemaVersion: 1,
        id: `event-${randomUUID()}`,
        runId,
        sequence,
        observedAt: new Date().toISOString(),
        actor: {
          id: "mcp-recorder",
          label: "Research recorder",
          type: "system",
        },
        type: "human.attention.requested",
        payload: input,
      }),
    ]);
    return { runId };
  }

  async getResearchState(): Promise<ResearchState> {
    const runId = this.#requireRun();
    const projection = await this.#projection(runId);
    if (projection === undefined)
      throw new ResearchWriterError("The active run no longer exists");
    return projection;
  }

  async #appendWithCursor(
    runId: string,
    createEvents: (sequence: number) => ResearchEvent[],
  ): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const projection = await this.#projection(runId);
      if (projection === undefined)
        throw new ResearchWriterError("The active run does not exist");
      const response = await this.#post(
        runId,
        createEvents(projection.lastSequence + 1),
      );
      if (response.status === 409) continue;
      if (!response.ok)
        throw new ResearchWriterError(
          "The local runtime rejected the research update",
        );
      return;
    }
    throw new ResearchWriterError(
      "The research run is changing too quickly; try again",
    );
  }

  async #append(runId: string, events: ResearchEvent[]): Promise<void> {
    const response = await this.#post(runId, events);
    if (!response.ok)
      throw new ResearchWriterError(
        "The local runtime rejected the research update",
      );
  }

  #post(runId: string, events: ResearchEvent[]): Promise<Response> {
    return this.#fetcher(
      `${this.#baseUrl}/api/runs/${encodeURIComponent(runId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(events),
      },
    );
  }

  async #projection(runId: string): Promise<ProjectionResponse | undefined> {
    const response = await this.#fetcher(
      `${this.#baseUrl}/api/runs/${encodeURIComponent(runId)}/projection`,
    );
    if (response.status === 404) return undefined;
    if (!response.ok)
      throw new ResearchWriterError("The local runtime is unavailable");
    return (await response.json()) as ProjectionResponse;
  }

  #requireRun(): string {
    if (this.#activeRunId === undefined) {
      throw new ResearchWriterError(
        "Start a research run before recording findings",
      );
    }
    return this.#activeRunId;
  }
}
