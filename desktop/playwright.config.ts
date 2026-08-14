import { defineConfig, devices } from '@playwright/test';

// Web 层 e2e(跑 vite dev,不启动 Tauri 壳)。
// invoke 用 tests/e2e 中 page.addInitScript 注入 mock,让 storage 降级不崩。
// 真 Tauri 持久化由 tauri dev 运行时验证;此处只验 React 应用 UI 整链路。
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
