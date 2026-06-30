import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect:  { timeout: 12_000 },
  workers: 1,            // tests share browser state — must run serially
  retries: 0,            // never retry in QA mode; we need accurate pass/fail
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL:     "http://localhost:3000",
    browserName: "chromium",
    headless:    true,
    screenshot:  "only-on-failure",
    video:       "off",
    trace:       "on-first-retry",
    locale:      "he-IL",
    timezoneId:  "Asia/Jerusalem",
  },
});
