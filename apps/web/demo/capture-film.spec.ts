import path from "node:path";

import { expect, test } from "@playwright/test";

const assetsDirectory = path.resolve(process.cwd(), "../../docs/assets");

test("capture the deterministic product film", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Your agents can think in parallel/,
    }),
  ).toBeVisible();

  await page.screenshot({
    path: path.join(assetsDirectory, "zmind-plus-poster.png"),
  });
  await page.waitForTimeout(3_500);

  await page.locator(".research-film").evaluate((element) => {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  await page.waitForTimeout(1_400);

  for (const chapter of [
    "Decompose",
    "Challenge",
    "Test",
    "Revise",
    "Decide",
  ]) {
    await page.getByRole("button", { name: `Show ${chapter} chapter` }).click();
    await page.waitForTimeout(4_000);
  }

  await page.locator(".final-cta").evaluate((element) => {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  await page.waitForTimeout(1_400);
  await expect(
    page.getByRole("heading", { name: /Let agents go wide/ }),
  ).toBeVisible();
  await page.waitForTimeout(3_500);

  const video = page.video();
  await page.close();
  if (video === null) throw new Error("Playwright video capture is disabled");
  await video.saveAs(path.join(assetsDirectory, "zmind-plus-demo.webm"));
});
