import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./demo",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4310",
    viewport: { width: 1440, height: 810 },
    video: {
      mode: "on",
      size: { width: 1440, height: 810 },
    },
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
