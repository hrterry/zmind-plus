import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import type { ResearchEvent, ResearchProjection } from "@zmind-plus/core";
import {
  EventConflictError,
  EventSequenceError,
  EventStoreError,
  RunMismatchError,
  SqliteEventStore,
} from "@zmind-plus/store";

import { EventHub } from "./EventHub";

interface CreateRuntimeOptions {
  store: SqliteEventStore;
  hub?: EventHub;
  allowedOrigin?: string;
  allowedOrigins?: readonly string[];
}

function serializeProjection(projection: ResearchProjection) {
  return {
    runId: projection.runId,
    title: projection.title,
    objective: projection.objective,
    lastSequence: projection.lastSequence,
    nodes: [...projection.nodes.values()],
    edges: [...projection.edges.values()],
    agents: [...projection.agents.values()],
    attention: projection.attention,
  };
}

function writeSse(stream: NodeJS.WritableStream, event: ResearchEvent): void {
  stream.write(`id: ${event.sequence}\n`);
  stream.write("event: research-event\n");
  stream.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createRuntime(options: CreateRuntimeOptions): FastifyInstance {
  const hub = options.hub ?? new EventHub();
  const allowedOrigins = new Set(
    options.allowedOrigins ??
      (options.allowedOrigin === undefined ? [] : [options.allowedOrigin]),
  );
  const app = Fastify({
    bodyLimit: 1_048_576,
    logger: false,
  });

  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      return reply.code(403).send({ error: "This origin is not allowed" });
    }
    if (origin !== undefined && allowedOrigins.has(origin)) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Vary", "Origin");
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "The event payload is invalid" });
    }
    if (error instanceof EventConflictError) {
      return reply.code(409).send({ error: error.message });
    }
    if (
      error instanceof EventSequenceError ||
      error instanceof RunMismatchError ||
      error instanceof EventStoreError
    ) {
      return reply.code(400).send({ error: error.message });
    }
    return reply
      .code(500)
      .send({ error: "The local runtime could not complete the request" });
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/runs", async () => ({ runs: options.store.listRuns() }));

  app.get<{
    Params: { runId: string };
    Querystring: { after?: string; limit?: string };
  }>("/api/runs/:runId/events", async (request) => {
    const after = Number.parseInt(request.query.after ?? "-1", 10);
    const limit = Number.parseInt(request.query.limit ?? "1000", 10);
    return {
      events: options.store.listEvents(
        request.params.runId,
        Number.isFinite(after) ? after : -1,
        Number.isFinite(limit) ? limit : 1_000,
      ),
    };
  });

  app.get<{ Params: { runId: string } }>(
    "/api/runs/:runId/projection",
    async (request, reply) => {
      const projection = options.store.projectRun(request.params.runId);
      if (projection === undefined) {
        return reply
          .code(404)
          .send({ error: "This research run does not exist" });
      }
      return serializeProjection(projection);
    },
  );

  app.post<{ Params: { runId: string } }>(
    "/api/runs/:runId/events",
    async (request, reply) => {
      const input = Array.isArray(request.body) ? request.body : [request.body];
      if (
        input.some(
          (event) =>
            (event as { runId?: unknown })?.runId !== request.params.runId,
        )
      ) {
        throw new RunMismatchError("The URL run ID must match every event");
      }
      const result = options.store.appendBatch(input);
      hub.publish(result.appended);
      return reply.code(202).send({
        accepted: result.appended.length,
        duplicates: result.duplicateCount,
        lastSequence: result.lastSequence,
      });
    },
  );

  app.get<{
    Params: { runId: string };
    Querystring: { after?: string; follow?: string };
  }>("/api/runs/:runId/stream", async (request, reply) => {
    const headerCursor = request.headers["last-event-id"];
    const cursorValue =
      typeof headerCursor === "string"
        ? headerCursor
        : (request.query.after ?? "-1");
    const after = Number.parseInt(cursorValue, 10);
    const replay = options.store.listAllEvents(
      request.params.runId,
      Number.isFinite(after) ? after : -1,
    );

    reply.hijack();
    reply.raw.writeHead(200, {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    });
    for (const event of replay) writeSse(reply.raw, event);

    if (request.query.follow === "false") {
      reply.raw.end();
      return;
    }

    const unsubscribe = hub.subscribe(request.params.runId, (event) => {
      writeSse(reply.raw, event);
    });
    const heartbeat = setInterval(
      () => reply.raw.write(": keepalive\n\n"),
      15_000,
    );
    request.raw.once("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  return app;
}
