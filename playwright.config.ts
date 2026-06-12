import { defineConfig, devices } from "@playwright/test";

// Tracker-blocking E2E. Self-contained: all network is mocked via route
// interception, so no dev server or DB is needed.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { ...devices["Desktop Chrome"] },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
