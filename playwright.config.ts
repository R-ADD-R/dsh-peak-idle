import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: true,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: process.env.CI ? undefined : 'msedge', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30_000 },
  reporter: 'list',
})
