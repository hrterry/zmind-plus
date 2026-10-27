import { expect, test } from "@playwright/test";

test("serves deep links as a self-contained public demo", async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/api/") || pathname === "/health") {
      runtimeRequests.push(pathname);
    }
  });

  const response = await page.goto("/workbench");
  expect(response?.status()).toBe(200);
  await expect(page.getByText(/Public synthetic demo/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Self-host/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Import/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Brief" })).toBeVisible();
  await page.waitForTimeout(2_200);
  expect(runtimeRequests).toEqual([]);

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Your agents can think in parallel/,
    }),
  ).toBeVisible();
});
