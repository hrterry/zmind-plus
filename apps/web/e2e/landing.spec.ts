import { expect, test, type Page } from "@playwright/test";

async function expectConnectorAnchored(
  page: Page,
  pathQuery: string,
  nodeQuery: string,
) {
  const distance = await page.evaluate(
    ({ nodeSelector, pathSelector }) => {
      const path = document.querySelector(pathSelector);
      const node = document.querySelector(nodeSelector);
      if (!(path instanceof SVGPathElement) || !(node instanceof HTMLElement)) {
        throw new Error(`Missing connector geometry: ${pathSelector}`);
      }

      const end = path.getPointAtLength(path.getTotalLength());
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error("Connector is not rendered");
      const screenEnd = new DOMPoint(end.x, end.y).matrixTransform(matrix);
      const nodeRect = node.getBoundingClientRect();
      return Math.hypot(
        screenEnd.x - (nodeRect.left + nodeRect.width / 2),
        screenEnd.y - nodeRect.top,
      );
    },
    { nodeSelector: nodeQuery, pathSelector: pathQuery },
  );

  expect(distance).toBeLessThan(2);
}

async function expectResearchConnectorsAnchored(page: Page) {
  await expectConnectorAnchored(page, ".hero-line-a", ".agent-one");
  await expectConnectorAnchored(page, ".hero-line-b", ".agent-two");
  await expectConnectorAnchored(page, ".hero-line-c", ".agent-three");
  await expectConnectorAnchored(page, ".line-a", ".node-architecture");
  await expectConnectorAnchored(page, ".line-b", ".node-performance");
  await expectConnectorAnchored(page, ".line-c", ".node-security");
}

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
  await expectResearchConnectorsAnchored(page);

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
  await expectResearchConnectorsAnchored(page);

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
