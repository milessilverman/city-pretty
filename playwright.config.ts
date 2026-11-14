import { defineConfig } from "@playwright/test";

const PORT = 8765;
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
  webServer: { command: `node scripts/serve.mjs ${PORT}`, url: `http://127.0.0.1:${PORT}/city-pretty/`, reuseExistingServer: !process.env.CI },
});
