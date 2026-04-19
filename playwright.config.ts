import { defineConfig } from "@playwright/test";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./__tests__/ui",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: !!process.env.CI,
  outputDir: "output/playwright/artifacts",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/report" }],
  ],
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: [
      "TZ=UTC E2E_TEST_MODE=1 npm run build",
      "cp -R public .next/standalone/",
      "cp -R .next/static .next/standalone/.next/static",
      `TZ=UTC E2E_TEST_MODE=1 HOSTNAME=127.0.0.1 PORT=${port} node .next/standalone/server.js`,
    ].join(" && "),
    url: `${baseURL}/api/test/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@portrait/,
      use: {
        viewport: { width: 1440, height: 960 },
        timezoneId: "UTC",
      },
    },
    {
      name: "portrait",
      grep: /@portrait/,
      use: {
        viewport: { width: 430, height: 932 },
        isMobile: true,
        timezoneId: "UTC",
      },
    },
  ],
});
