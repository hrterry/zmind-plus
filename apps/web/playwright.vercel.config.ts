import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./vercel-e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4312",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "VITE_ZMIND_DEMO_ONLY=true vite build && vite preview --host 127.0.0.1 --port 4312",
    url: "http://127.0.0.1:4312",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
