import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 1,
  workers: 1,
  reporter: [["html", { open: "never" }], ["json", { outputFile: "tests/reports/playwright-results.json" }]],
  use: {
    baseURL: process.env.BASE_URL || "https://enazizi-com-br.lovable.app",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
