import { expect, test } from "@playwright/test";

test("loads the real graph and keeps branch navigation understandable", async ({
  page,
}) => {
  await page.goto("/");

  const canvas = page.getByLabel("Research graph showing 14 of 14 nodes");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("14 visible · complete view")).toBeVisible();

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
