import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  timeout: 900_000,
  fullyParallel: true,
  workers: Number(process.env.WORKERS ?? 5),
  reporter: [['list']],
  use: { baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:4318', headless: true, video: 'off', actionTimeout: 8_000 },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --host 127.0.0.1 --port 4318 --strictPort --outDir qa/.build',
        port: 4318,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
