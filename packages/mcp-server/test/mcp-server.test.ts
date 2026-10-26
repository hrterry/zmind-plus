import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { createRuntime } from "@zmind-plus/runtime/src/server";
import { SqliteEventStore } from "@zmind-plus/store";

import { ResearchWriter } from "../src/ResearchWriter";
import { createResearchMcpServer } from "../src/server";

describe("research recorder MCP server", () => {
  let store: SqliteEventStore;
  let runtime: ReturnType<typeof createRuntime>;

  beforeEach(() => {
    store = new SqliteEventStore(":memory:");
    runtime = createRuntime({ store });
  });

  afterEach(async () => {
    await runtime.close();
    store.close();
  });

  it("records a complete semantic path through the official MCP client", async () => {
    const fetcher = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      const headers = init?.headers as Record<string, string> | undefined;
      const payload = typeof init?.body === "string" ? init.body : undefined;
      const injected = await runtime.inject({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: `${url.pathname}${url.search}`,
        ...(headers === undefined ? {} : { headers }),
        ...(payload === undefined ? {} : { payload }),
      });
      return new globalThis.Response(injected.body, {
        status: injected.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    const writer = new ResearchWriter({
      baseUrl: "http://runtime.local",
      fetcher,
    });
    const server = createResearchMcpServer(writer);
    const client = new Client({ name: "recorder-test", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "start_research",
      "attach_latest_research",
      "record_finding",
      "connect_findings",
      "request_human_review",
      "get_research_state",
    ]);

    await client.callTool({
      name: "start_research",
      arguments: {
        runId: "run-mcp-test",
        title: "Compare two deployment strategies",
        objective: "Choose using explicit operational evidence.",
      },
    });
    await client.callTool({
      name: "attach_latest_research",
      arguments: {},
    });
    await client.callTool({
      name: "record_finding",
      arguments: {
        id: "evidence-test",
        kind: "evidence",
        title: "Recovery drill result",
        summary: "The synthetic drill recovered within the target window.",
        status: "supported",
        confidence: 0.86,
      },
    });
    const rootId = store.projectRun("run-mcp-test")!.nodes.values().next()
      .value!.id;
    await client.callTool({
      name: "connect_findings",
      arguments: {
        source: rootId,
        target: "evidence-test",
        kind: "supports",
      },
    });
    await client.callTool({
      name: "request_human_review",
      arguments: {
        nodeId: "evidence-test",
        reason: "Confirm whether the recovery target is strict enough.",
        urgency: "medium",
      },
    });

    const projection = store.projectRun("run-mcp-test")!;
    expect(projection.nodes.size).toBe(2);
    expect(projection.edges.size).toBe(1);
    expect(projection.attention).toHaveLength(1);
    expect(projection.lastSequence).toBe(4);

    await client.close();
    await server.close();
  });
});
