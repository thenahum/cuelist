import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1100, height: 1200 } } },
    { name: "webkit-iphone", use: { ...devices["iPhone 15"], defaultBrowserType: "webkit" } },
    { name: "webkit-ipad", use: { ...devices["iPad Air"], defaultBrowserType: "webkit" } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "",
      VITE_SENTRY_DSN: "",
    },
  },
});
