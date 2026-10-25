import { defineConfig, devices } from "@playwright/test";

// Runs against a production build (`npm run build` first, or `npm run test:e2e`).
// Demo mode is forced on for the test server only; never enable it in production.
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      // API and stress specs are viewport-independent; run them once.
      testIgnore: /api\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      BRIX_DEMO_MODE: "true",
      NEXT_PUBLIC_BRIX_DEMO_MODE: "true",
      BRIX_TEST_STORAGE: "true",
      CRON_SECRET: "brix-browser-test-cron-secret-not-for-deployment",
    },
  },
});
