import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:4317',
    headless: true,
    viewport: { width: 1440, height: 900 },
    video: 'on',
    screenshot: 'off',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4317 --strictPort',
    port: 4317,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
