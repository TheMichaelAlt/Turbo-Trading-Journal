import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', timeout: 30000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'msedge', headless: true, viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30000 },
})
