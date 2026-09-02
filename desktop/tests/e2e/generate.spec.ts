import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 出题(AI 生成弹窗)全链路(web 层,2026-09-02 IA 重构:出题是各页面按钮,不再有独立页)。
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
        // plugin-sql 的 execute 把 invoke 结果按 [rowsAffected, lastInsertId] 解构,必须返回数组
        if (cmd.includes('|execute')) return [0, 0];
        if (cmd.includes('|load')) return ':memory:';
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

// 包内官方题库(e2e 里官方读路径走 mock DB → 播种自包内 JSON;同步远端拦截为同一份,自动同步零差异)
const BUNDLED_BANK = JSON.parse(readFileSync(new URL('../../public/questions.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
  await mockTauri(page);
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
  await mockChat(page);
  // LLM 配置:种一份 mock 端点,聊天请求由 mockChat 拦截
  await page.addInitScript(() =>
    localStorage.setItem('llm-config', JSON.stringify({ baseURL: 'http://mock.local/v1', model: 'mock-model' })),
  );
  // key 存内存 secrets(SQLite 降级):走设置页真实保存入口种下,生成链路才配齐
  await page.goto('/#/settings');
  await page.getByPlaceholder('sk-…').fill('sk-e2e-test');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('LLM 配置已保存').first()).toBeVisible();
});

test('AI 生成弹窗:生成 → 提交审核 → 通过 → 我的题库可见 → 可开始刷题', async ({ page }) => {
  // 1) 我的题库页开「AI 生成题目」弹窗,填知识点生成
  await page.goto('/#/my');
  await page.getByRole('button', { name: 'AI 生成题目' }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('AI 生成题目')).toBeVisible();
  await dlg.getByPlaceholder(/React Hooks/).fill('React Hooks 深入');
  await dlg.getByRole('button', { name: '生成', exact: true }).click();

  // 2) 预览出现(mock 返回 2 题),展开一题看答案
  await expect(dlg.getByText('LLM 判断出 2 道')).toBeVisible({ timeout: 10_000 });
  await dlg.getByText('useEffect 的清理函数在哪些时机执行?').click();
  await expect(dlg.getByText('参考答案要点')).toBeVisible();

  // 3) 提交审核(自动跳 #/drafts),批次名 = 知识点
  await dlg.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByText(/批次 01 · React Hooks 深入/)).toBeVisible();
  await expect(page.getByText(/2 题待审/)).toBeVisible();

  // 4) 本批全部通过 → 待审核清空
  await page.getByRole('button', { name: '本批全部通过' }).click();
  await expect(page.getByText('没有待审核的题')).toBeVisible({ timeout: 10_000 });

  // 5) 首页:我的题库卡片出现 2 题
  await page.goto('/#/');
  const myCard = page.locator('main').getByRole('link', { name: /我的题库/ }).first();
  await expect(myCard).toBeVisible();
  await expect(myCard.getByText('0/2')).toBeVisible();

  // 6) 进我的题库:可开始刷题
  await myCard.click();
  await expect(page.getByRole('heading', { name: '我的题库' })).toBeVisible();

  // 7) 我的题库题目列表:行尾 icon 编辑/删除直接可见;来源徽标可见(AI 生成)
  await page.goto('/#/my/browse');
  await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '删除' }).first()).toBeVisible();
  await expect(page.getByText('AI 生成', { exact: true }).first()).toBeVisible();
});

test('待审核:逐题拒绝不进我的题库', async ({ page }) => {
  await page.goto('/#/my');
  await page.getByRole('button', { name: 'AI 生成题目' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder(/React Hooks/).fill('Event Loop');
  await dlg.getByRole('button', { name: '生成', exact: true }).click();
  await expect(dlg.getByText('LLM 判断出 2 道')).toBeVisible({ timeout: 10_000 });
  await dlg.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByText(/2 题待审/)).toBeVisible();

  // 展开第一题拒绝(拒绝 = 删除,需确认)
  await page.getByText('useEffect 的清理函数在哪些时机执行?').click();
  await page.getByRole('button', { name: /拒绝/ }).click();
  await expect(page.getByText('拒绝这道题?')).toBeVisible();
  await page.getByRole('button', { name: '确认拒绝' }).click();
  await expect(page.getByText(/1 题待审/)).toBeVisible({ timeout: 10_000 });

  // 首页我的题库仍为空(引导去出题)
  await page.goto('/#/');
  await expect(page.getByText('还是空的')).toBeVisible();
});

test('JD 管理:新增 JD → 行内「按 JD 生成」弹窗 → 提交审核(来源按 JD)', async ({ page }) => {
  // 1) JD 管理:新增 JD(弹窗)
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'JD 管理' })).toBeVisible();
  await page.getByRole('button', { name: '新增 JD' }).first().click();
  await page.getByRole('dialog').getByLabel('标题(可空)').fill('AI 应用工程师');
  await page.getByRole('dialog').getByLabel('公司').fill('示例公司');
  await page.getByRole('dialog').getByLabel('职位描述(JD)').fill('负责 RAG 检索系统的设计与优化,熟悉向量数据库与 embedding 调优,有 LLM 应用落地经验。');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();

  // 2) JD 列表出现该条;行内「按 JD 生成题目」开弹窗(jd 模式,标题带 JD 名)
  await expect(page.getByText('AI 应用工程师').first()).toBeVisible();
  await page.getByRole('button', { name: /按 JD 生成题目/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText(/按 JD 生成题目 · AI 应用工程师/)).toBeVisible();

  // 3) 定向生成(mock)并提交审核:批次名带 JD定向 · 公司
  await dlg.getByRole('button', { name: '生成', exact: true }).click();
  await expect(dlg.getByText('LLM 判断出 2 道')).toBeVisible({ timeout: 10_000 });
  await dlg.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByText(/批次 01 · JD定向 · 示例公司/)).toBeVisible();

  // 4) 通过后来源徽标 = 按 JD
  await page.getByRole('button', { name: '本批全部通过' }).click();
  await page.goto('/#/my/browse');
  await expect(page.getByText('按 JD', { exact: true }).first()).toBeVisible();
});

test('题库分类页:复习/学新题双入口 + 是哪些题深链', async ({ page }) => {
  await page.goto('/#/agent');
  // 两张数字卡:待复习 / 新题;新题有货 → 学习新题按钮
  await expect(page.getByText('题待复习')).toBeVisible();
  await expect(page.getByText('题新题没学过')).toBeVisible();
  await expect(page.getByRole('link', { name: /学习新题 \d+ 题/ })).toBeVisible();
  // 新库无进度:待复习为 0 时不渲染「开始复习」(有到期题才出现——模式用户自选)
  await expect(page.getByRole('link', { name: /开始复习/ })).toHaveCount(0);
  await page.getByRole('link', { name: '是哪些题' }).first().click();
  await expect(page).toHaveURL(/browse\?status=/);
  await expect(page.getByRole('combobox', { name: '状态' })).not.toContainText('全部状态');
});

test('官方题题目列表:添加到我的题库 → toast + 标识 + 副本进我的库(来源官方复制)', async ({ page }) => {
  await page.goto('/#/agent/browse');
  const firstRow = page.locator('main .bg-card > div.border-b').first();
  const addBtn = firstRow.getByRole('button', { name: '添加到我的题库' });

  await addBtn.hover();
  await expect(page.getByText('添加到我的题库')).toBeVisible();
  await addBtn.click();

  await expect(page.getByText('已添加到我的题库')).toBeVisible();
  const addedBtn = firstRow.getByRole('button', { name: '已在我的库' });
  await expect(addedBtn).toBeDisabled();
  await page.mouse.move(5, 5);
  await addedBtn.locator('..').hover();
  await expect(page.getByText('已在我的库')).toBeVisible();

  // 副本落我的库模块 0(官方题副本),来源徽标 = 官方复制
  await page.goto('/#/my/browse');
  await expect(page.getByText('官方题副本').first()).toBeVisible();
  await expect(page.getByText('官方复制', { exact: true }).first()).toBeVisible();
});

test('设置页:同步官方题库 → 远端新增题落地', async ({ page }) => {
  // 远端比包内多一题(后注册的 route 优先)
  const remote = JSON.parse(JSON.stringify(BUNDLED_BANK));
  remote.questions.push({
    id: 'agent.99.1', category: 'agent', module: 99, moduleName: '同步验证', index: 1, type: 'qa',
    difficulty: '中', tags: ['sync'], title: '远端同步新增的验证题?', focus: '同步链路',
    answer: ['这是远端新增题的答案,内容长度超过五十字以满足共享校验的最低要求,验证同步落库链路完整。'],
    followups: [],
  });
  remote.total = remote.questions.length;
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: remote }));

  await page.goto('/#/settings');
  await page.getByRole('button', { name: '同步官方题库' }).click();
  await expect(page.getByText(/官方题库已同步:新增 1 · 修订 0 · 移除 0/)).toBeVisible({ timeout: 10_000 });

  // 同步进来的题进官方库聚合(题目列表可见)
  await page.goto('/#/agent/browse');
  await expect(page.getByText('远端同步新增的验证题?')).toBeVisible({ timeout: 10_000 });
});

test('设置页渲染:预设与 key 表单', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  // 五分区:刷题(题量)/外观/LLM/数据管理/关于
  await expect(page.getByText('每次学习题量')).toBeVisible();
  await expect(page.getByText('外观')).toBeVisible();
  await expect(page.getByText('LLM(AI 生题用)')).toBeVisible();
  await expect(page.getByText('数据管理')).toBeVisible();
  await expect(page.getByText('关于')).toBeVisible();
  await expect(page.getByText('baseURL', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenAI 兼容端点')).toBeVisible();
  const keyInput = page.getByPlaceholder('sk-…');
  await expect(keyInput).toBeVisible();
  await keyInput.fill('sk-e2e-test');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('LLM 配置已保存').first()).toBeVisible();
});

test('官方题题目列表:统一筛选栏(模块/难度/状态)', async ({ page }) => {
  await page.goto('/#/agent/browse');
  await expect(page.getByRole('combobox', { name: '模块' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '难度' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '状态' })).toBeVisible();
  await expect(page.getByText(/共 \d+ 题/)).toBeVisible();
  // 筛单个模块:出现该模块统计 + 进度条
  await page.getByRole('combobox', { name: '模块' }).click();
  await page.getByRole('option', { name: /· / }).first().click();
  await expect(page.getByText(/已学 \d+\/\d+/).first()).toBeVisible();
  // 叠加难度筛选,计数变化
  const totalText = await page.getByText(/共 \d+ 题/).innerText();
  await page.getByRole('combobox', { name: '难度' }).click();
  await page.getByRole('option', { name: '高', exact: true }).click();
  await expect(page.getByText(/共 \d+ 题/)).not.toHaveText(totalText);
  // 重置回全部
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.getByRole('combobox', { name: '模块' })).toContainText('全部模块');
});
