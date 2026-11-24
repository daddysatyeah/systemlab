import { defineConfig } from "@playwright/test";
const baseURL =
  process.env.SYSTEMLAB_TEST_URL ?? "http://127.0.0.1:4173/systemlab/";
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: process.env.SYSTEMLAB_TEST_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 30000,
      },
});
