import { expect, test } from "@playwright/test";

test("tells the research supervision story and links to the product", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Your agents can think in parallel/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open workbench" }),
  ).toHaveAttribute("href", "/workbench");
  await expect(
    page.getByRole("link", { name: "Explore the live prototype" }),
  ).toHaveAttribute("href", "/workbench");

  await page.screenshot({
    path: "test-results/landing-hero.png",
  });

  await page.getByRole("button", { name: "Show Decide chapter" }).click();
  await expect(
    page.getByText("The agents stop where human judgment matters."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play research film" }),
  ).toBeVisible();
  await page.waitForTimeout(600);

  await page.screenshot({
    path: "test-results/landing-film.png",
  });
});

test("keeps the landing story usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Your agents can think in parallel/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open workbench" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Watch research unfold" }).click();
  await expect(page.locator("#research-film")).toBeInViewport();
  await page.screenshot({
    path: "test-results/landing-mobile.png",
  });
});

test("honors reduced motion with a stable final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.getByText(/05 \/ 05 · Decide/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play research film" }),
  ).toBeVisible();
});
