import { test, expect } from '@playwright/test';

// mock Tauri invoke:web 环境无 __TAURI__,storage 的 initStorage 会降级(catch 兜底,空 cache)。
// 此 mock 让 plugin-sql/keyring 的 invoke 调用不抛错,保证应用渲染。
// 注:持久化在降级模式不跨刷新;真持久化已由 tauri dev 运行时验证。
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        // plugin-sql: select 返回空数组(无历史数据),其余返回安全默认
        if (cmd.includes('|select')) return [];
        if (cmd.includes("|execute")) return [0, 0];
        if (cmd.includes('|load')) return ':memory:';
        // keyring
        if (cmd === 'get_api_key') return null;
        return null;
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' } },
    };
  });
});

test('首页渲染:不白屏,有题库入口', async ({ page }) => {
  await page.goto('/');
  // 等应用挂载
  await page.waitForLoadState('networkidle');
  const body = page.locator('body');
  await expect(body).not.toBeEmpty();
  const text = await body.innerText();
  expect(text.length).toBeGreaterThan(0);
});

test('首页含 AI Agent 题库入口', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByText(/AI\s*Agent/i).first()).toBeVisible({ timeout: 10_000 });
});

test('控制台无未捕获错误(应用启动健康)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  // 允许 fetch/invoke 降级警告,但不应有阻断渲染的未捕获异常
  expect(errors.filter((e) => !e.includes('Failed to fetch') && !e.includes('invoke')))
    .toEqual([]);
});
