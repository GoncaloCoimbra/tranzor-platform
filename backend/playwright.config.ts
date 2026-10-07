/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';

const isCI = !!process.env.CI && !process.env.PLAYWRIGHT_FULL; // when CI is set, limit projects unless PLAYWRIGHT_FULL is provided

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: isCI ? 2 : 2,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:5174',
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
      command: 'npm run dev',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      cwd: path.resolve(process.cwd(), '../frontend'),
      timeout: 120000,
    },
    {
      // Ensure migrations are applied before starting the backend server in CI
      // Run migrate deploy, attempt to seed data for tests and then start dev server.
      // Behavior: in CI (process.env.CI set) run seed and fail loudly if it fails; locally, attempt seed but ignore failures.
      // Use a Node wrapper for cross-platform behavior.
      command: `npx prisma migrate deploy --schema prisma/schema.prisma && node -e "const cp=require('child_process'); if(process.env.CI){ const r=cp.spawnSync('npm',['run','db:seed'],{stdio:'inherit'}); if(r.status!==0){ console.error('Seed failed in CI with code', r.status); process.exit(r.status);} } else { try{ cp.spawnSync('npm',['run','db:seed'],{stdio:'inherit'}); } catch(e){} }" && npm run dev`,
      url: 'http://localhost:3001/health',
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
