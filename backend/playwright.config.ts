/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const isCI = !!process.env.CI && !process.env.PLAYWRIGHT_FULL; // when CI is set, limit projects unless PLAYWRIGHT_FULL is provided
const frontendUrl = process.env.PLAYWRIGHT_FRONTEND_URL ?? 'http://localhost:5174';
const backendPort = process.env.PORT ?? '3001';
const backendHealthUrl = process.env.PLAYWRIGHT_BACKEND_HEALTH_URL ?? `http://localhost:${backendPort}/health`;
const frontendPort = process.env.PLAYWRIGHT_FRONTEND_PORT ?? '5174';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isCI ? 2 : 2,
  reporter: 'html',

  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: isCI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },

        // Mobile testing
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
      ],

  webServer: [
    {
      command: `npm run dev -- --host 0.0.0.0 --port ${frontendPort}`,
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(process.cwd(), '../frontend'),
      timeout: 120000,
    },
    {
      command: 'npx prisma migrate deploy --schema prisma/schema.prisma && npm run dev',
      url: backendHealthUrl,
      reuseExistingServer: !process.env.CI,
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5435/Tranzor_test',
      },
      timeout: 180000,
    },
  ],
});
