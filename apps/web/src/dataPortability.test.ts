import { describe, expect, it, vi } from "vitest";

import { syntheticResearchEvents } from "@zmind-plus/core";
import { serializeResearchJsonl } from "@zmind-plus/sdk";

import {
  DataPortabilityError,
  exportResearchJsonl,
  importResearchJsonl,
  MAX_IMPORT_BYTES,
  portableFilename,
  validatePortableRun,
} from "./dataPortability";

const jsonl = serializeResearchJsonl(syntheticResearchEvents);

describe("workbench data portability", () => {
  it("requires a complete contiguous run before importing", () => {
    const gap = syntheticResearchEvents.filter((event) => event.sequence !== 2);
    expect(() => validatePortableRun(serializeResearchJsonl(gap))).toThrow(
      /gap before 3/,
    );
    expect(() =>
      validatePortableRun(
        serializeResearchJsonl(syntheticResearchEvents.slice(1)),
      ),
    ).toThrow(/begin with the run start event/);
  });

  it("rejects oversized files without reading or sending them", async () => {
    const file = {
      size: MAX_IMPORT_BYTES + 1,
      text: vi.fn<() => Promise<string>>(),
    };
    const fetcher = vi.fn<typeof fetch>();
    await expect(importResearchJsonl(file, fetcher)).rejects.toEqual(
      new DataPortabilityError(
        "This file is over 25 MiB. Use the local import command for larger archives.",
      ),
    );
    expect(file.text).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("imports a validated run through the loopback API", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toContain("/api/runs/run-synthetic-001/events");
      const events = JSON.parse(String(init?.body)) as unknown[];
      return new Response(
        JSON.stringify({
          accepted: events.length,
          duplicates: 0,
          lastSequence: events.length - 1,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      );
    });

    const receipt = await importResearchJsonl(
      { size: jsonl.length, text: async () => jsonl },
      fetcher,
    );
    expect(receipt.runId).toBe("run-synthetic-001");
    expect(receipt.accepted).toBe(syntheticResearchEvents.length);
  });

  it("exports every page in stable JSONL order", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const after = Number(
        new URL(String(input), "http://local.test").searchParams.get("after"),
      );
      return new Response(
        JSON.stringify({
          events: syntheticResearchEvents
            .filter((event) => event.sequence > after)
            .slice(0, 1_000),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const output = await exportResearchJsonl(
      {
        id: "run-synthetic-001",
        title: "Synthetic research",
        objective: "Test export",
        updatedAt: "2026-10-27T00:00:00.000Z",
        lastSequence: syntheticResearchEvents.length - 1,
      },
      fetcher,
    );
    expect(validatePortableRun(output)).toEqual(syntheticResearchEvents);
  });

  it("creates readable filesystem-safe download names", () => {
    expect(portableFilename("  Evidence / Decision: v2  ")).toBe(
      "evidence-decision-v2.jsonl",
    );
    expect(portableFilename("研究")).toBe("research-run.jsonl");
  });
});
