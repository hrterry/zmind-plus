import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { syntheticResearchEvents } from "@zmind-plus/core";

test("discovers a run created after the workbench is already open", async ({
  page,
}) => {
  let indexRequests = 0;
  const events = syntheticResearchEvents.map((event) => ({
    ...event,
    runId: "run-discovered",
    ...(event.type === "run.started"
      ? {
          payload: {
            title: "Newly discovered research",
            objective: "A run that started after the page opened",
          },
        }
      : {}),
  }));

  await page.route("**/api/runs", async (route) => {
    indexRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runs:
          indexRequests <= 2
            ? []
            : [
                {
                  id: "run-discovered",
                  title: "Newly discovered research",
                  objective: "A run that started after the page opened",
                  updatedAt: "2026-10-26T20:00:00.000Z",
                  lastSequence: events.length - 1,
                },
              ],
      }),
    });
  });
  await page.route("**/api/runs/run-discovered/events**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ events }),
    });
  });
  await page.route("**/api/runs/run-discovered/stream**", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: ": connected\n\n",
    });
  });

  await page.goto("/workbench");
  await expect(page.getByText("Local synthetic demo")).toBeVisible();
  await expect(
    page.getByText("A run that started after the page opened"),
  ).toBeVisible({ timeout: 5_000 });
  expect(indexRequests).toBeGreaterThanOrEqual(2);
});

test("loads the real graph and keeps branch navigation understandable", async ({
  page,
}) => {
  await page.goto("/workbench");

  const canvas = page.getByLabel("Research graph showing 14 of 14 nodes");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("14 visible · complete view")).toBeVisible();
  await expect(page.getByRole("button", { name: "New inquiry" })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: "Brief" }).click();
  await expect(
    page.getByRole("heading", { name: "Research brief" }),
  ).toBeVisible();
  for (const section of [
    "Current decision",
    "Evidence",
    "Reversals",
    "Open challenges",
    "Experiments",
  ]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }
  await page
    .getByRole("button", {
      name: /Use an append-only event log with a live delivery channel/,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Graph", pressed: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Use an append-only event log with a live delivery channel",
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Review decision" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Use an append-only event log with a live delivery channel",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask why this is current" }).click();
  await expect(page.getByText("Evidence-linked answer")).toBeVisible();
  await expect(page.getByText("2 direct graph relationships")).toBeVisible();
  await page
    .getByLabel("Ask a follow-up about this node")
    .fill("Which experiment changed this decision?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByText("Which experiment changed this decision?"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close inspector" }).click();
  await expect(
    page.getByText("Select a node to inspect its evidence and history."),
  ).toBeVisible();

  const foldRoot = page.getByRole("button", {
    name: "Fold branch: Which transport should coordinate live edits?",
  });
  await foldRoot.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("2 visible · 12 folded")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Expand branch: Which transport should coordinate live edits?",
    }),
  ).toBeAttached();

  const expandRoot = page.getByRole("button", {
    name: "Expand branch: Which transport should coordinate live edits?",
  });
  await expandRoot.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("14 visible · complete view")).toBeVisible();

  await page
    .getByPlaceholder("Find evidence, critique, decision…")
    .fill("unacknowledged");
  await expect(
    page.getByRole("button", {
      name: "Inspect: Unacknowledged updates disappear after reconnect",
    }),
  ).toBeAttached();
  const inspectEvidence = page.getByRole("button", {
    name: "Inspect: Unacknowledged updates disappear after reconnect",
  });
  await inspectEvidence.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", {
      name: "Unacknowledged updates disappear after reconnect",
    }),
  ).toBeVisible();

  await page.getByRole("heading", { name: "Why this matters" }).click();

  await page.screenshot({
    path: "test-results/workbench-synthetic.png",
    fullPage: true,
  });
});

test("imports and exports a complete run without leaving the workbench", async ({
  page,
}) => {
  const runId = "run-browser-import";
  const events = syntheticResearchEvents.map((event) => ({
    ...event,
    runId,
    id: `browser-${event.id}`,
    ...(event.type === "run.started"
      ? {
          payload: {
            title: "Imported browser research",
            objective: "Prove one-click local portability",
          },
        }
      : {}),
  }));
  let imported = false;

  await page.route("**/api/runs", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runs: imported
          ? [
              {
                id: runId,
                title: "Imported browser research",
                objective: "Prove one-click local portability",
                updatedAt: "2026-10-27T02:00:00.000Z",
                lastSequence: events.length - 1,
              },
            ]
          : [],
      }),
    });
  });
  await page.route(`**/api/runs/${runId}/events**`, async (route) => {
    if (route.request().method() === "POST") {
      imported = true;
      const batch = route.request().postDataJSON() as unknown[];
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: batch.length,
          duplicates: 0,
          lastSequence: batch.length - 1,
        }),
      });
      return;
    }
    const requestUrl = new URL(route.request().url());
    const after = Number(requestUrl.searchParams.get("after") ?? "-1");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        events: events.filter((event) => event.sequence > after),
      }),
    });
  });
  await page.route(`**/api/runs/${runId}/stream**`, async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: ": connected\n\n",
    });
  });

  await page.goto("/workbench");
  await page.locator('input[type="file"]').setInputFiles({
    name: "research.jsonl",
    mimeType: "application/x-ndjson",
    buffer: Buffer.from(
      events.map((event) => JSON.stringify(event)).join("\n"),
    ),
  });

  await expect(page.getByText(/Imported \d+ events/)).toBeVisible();
  await expect(
    page.getByText("Prove one-click local portability"),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("imported-browser-research.jsonl");
  const downloadPath = await download.path();
  if (downloadPath === null)
    throw new Error("The browser download has no path");
  const downloadedEvents = (await readFile(downloadPath, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { runId: string });
  expect(downloadedEvents).toHaveLength(events.length);
  expect(downloadedEvents.every((event) => event.runId === runId)).toBe(true);
  await expect(
    page.getByText("Downloaded a portable JSONL copy"),
  ).toBeVisible();
});
