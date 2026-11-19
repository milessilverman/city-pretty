import { defineConfig } from "@playwright/test";

// Set PW_PORT to run several checkouts' suites at once. The server is never reused locally, so a run can't
// silently test another checkout's files (an agent worktree once did exactly that).
const PORT = Number(process.env.PW_PORT || 8765);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/city-pretty/`,
    // A preinstalled Chromium can be used instead of `npx playwright install` (PW_CHROMIUM=/path/to/chrome)
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: `node scripts/serve.mjs ${PORT}`, url: `http://127.0.0.1:${PORT}/city-pretty/`, reuseExistingServer: false },
});
