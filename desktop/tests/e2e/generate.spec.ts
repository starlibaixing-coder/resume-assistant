import { test, expect, type Page } from '@playwright/test';

// 生题全链路(web 层):生题 → 草稿区 approve → 我的题库 → 刷题入口。
// chat endpoint 用 page.route mock;Tauri invoke 用 init mock(SQLite 降级内存)。
// 真 LLM(智谱)与真 SQLite 持久化由 tauri dev 手测,此处验证 React 整链路。

const QUESTIONS = [
  {
    difficulty: '中',
    title: 'useEffect 的清理函数在哪些时机执行?',
    focus: '理解 effect 生命周期与清理时机',
    answer: [
      '组件卸载时执行一次清理',
      '下一次 effect 重新执行前,会先执行上一次的清理函数,防止过期闭包和重复副作用',
      '严格模式下开发环境会额外跑一次挂载加清理,用于暴露不幂等的副作用',
    ],
    followups: ['为什么严格模式要故意执行两次?'],
    tags: ['react'],
  },
  {
    difficulty: '高',
    title: '手写深比较函数要处理哪些边界?',
    focus: '递归与边界处理',
    answer: [
      '递归比较类型与引用,对象逐键递归,数组逐项递归',
      '处理 NaN、Date、RegExp 等特殊值',
      '循环引用用 WeakSet 记录已访问路径,避免无限递归',
    ],
    followups: [],
    tags: ['js'],
  },
];

async function mockTauri(page: Page) {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd.includes('|select')) return [];
        if (cmd.includes('|execute')) return { rowsAffected: 0 };
        if (cmd.includes('|load')) return ':memory:';
        if (cmd === 'get_api_key') return 'test-key';
        return null;
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' } },
    };
  });
}

async function mockChat(page: Page) {
  await page.route('**/chat/completions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(QUESTIONS) } }] }),
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockTauri(page);
  await mockChat(page);
});

test('生题 → 存草稿 → approve → 我的题库可见 → 可开始刷题', async ({ page }) => {
  // 1) 生题页:填知识点,生成
  await page.goto('/#/generate');
  await page.getByPlaceholder(/React Hooks/).fill('React Hooks 深入');
  await page.getByRole('button', { name: '生成', exact: true }).click();

  // 2) 预览出现(mock 返回 2 题)
  await expect(page.getByText('LLM 判断出 2 道')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('useEffect 的清理函数在哪些时机执行?')).toBeVisible();

  // 3) 存入草稿区(自动跳 #/drafts)
  await page.getByRole('button', { name: /存入草稿区/ }).click();
  await expect(page.getByText(/批次 01 · React Hooks 深入/)).toBeVisible();
  await expect(page.getByText(/2 待审/)).toBeVisible();

  // 4) 本批全部通过 → 草稿区清空
  await page.getByRole('button', { name: '本批全部通过' }).click();
  await expect(page.getByText('草稿区是空的')).toBeVisible({ timeout: 10_000 });

  // 5) 首页:我的题库卡片出现 2 题(限主内容区,侧栏也有同名入口)
  await page.goto('/#/');
  const myCard = page.locator('main').getByRole('link', { name: /我的题库/ }).first();
  await expect(myCard).toBeVisible();
  await expect(myCard.getByText('0/2')).toBeVisible();

  // 6) 进我的题库复习页:可开始刷题
  await myCard.click();
  await expect(page.getByRole('heading', { name: /我的题库/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /开始/ })).toBeVisible();

  // 7) 我的题库浏览:我的题可展开出 编辑/删除(功能⑥)
  await page.goto('/#/my/browse');
  await page.locator('main .bg-card > div > div').first().click();
  await expect(page.getByRole('button', { name: '编辑' })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除' })).toBeVisible();
});

test('草稿区:逐题拒绝不进我的题库', async ({ page }) => {
  await page.goto('/#/generate');
  await page.getByPlaceholder(/React Hooks/).fill('Event Loop');
  await page.getByRole('button', { name: '生成', exact: true }).click();
  await expect(page.getByText('LLM 判断出 2 道')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /存入草稿区/ }).click();
  await expect(page.getByText(/2 待审/)).toBeVisible();

  // 展开第一题拒绝
  await page.getByText('useEffect 的清理函数在哪些时机执行?').click();
  await page.getByRole('button', { name: /拒绝/ }).click();
  await expect(page.getByText(/1 待审/)).toBeVisible({ timeout: 10_000 });

  // 首页我的题库仍为空(引导去生题)
  await page.goto('/#/');
  await expect(page.getByText('还是空的')).toBeVisible();
});

test('设置页渲染:预设与 key 表单', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByRole('button', { name: '智谱 GLM' })).toBeVisible();
  // 外观(主题)与数据管理(清空)也在此页
  await expect(page.getByText('外观')).toBeVisible();
  await expect(page.getByText('数据管理')).toBeVisible();
  // mock 返回了 key,label 会显示「API key(已存于系统钥匙串)」
  await expect(page.getByText(/^API key/)).toBeVisible();
  await expect(page.getByPlaceholder(/保持不变|sk-/)).toBeVisible();
});

test('官方题浏览页:按模块单模块翻页 + 全部题目分维度筛选', async ({ page }) => {
  await page.goto('/#/agent/browse');
  // 默认按模块:一次只显示一个模块,底部上/下模块翻页(题库 meta 模块顺序即翻页顺序)
  await expect(page.getByText(/1 \/ \d+/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^← 已是第一个/ })).toBeDisabled();
  await page.getByRole('button', { name: /下一个 · / }).click();
  await expect(page.getByText(/2 \/ \d+/)).toBeVisible();
  // 切全部题目:全局序号 + 模块名标签 + 题目标签 + 难度/状态两维筛选
  await page.getByRole('button', { name: '全部题目' }).click();
  await expect(page.getByText('难度', { exact: true })).toBeVisible();
  await expect(page.getByText('状态', { exact: true })).toBeVisible();
  await expect(page.getByText(/共 \d+ 题/)).toBeVisible();
  // 难度筛"高"后列表变化
  const totalText = await page.getByText(/共 \d+ 题/).innerText();
  await page.locator('main button').filter({ hasText: /^高$/ }).click();
  await expect(page.getByText(/共 \d+ 题/)).not.toHaveText(totalText);
});
