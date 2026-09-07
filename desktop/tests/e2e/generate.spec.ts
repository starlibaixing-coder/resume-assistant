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
  await page.getByRole('button', { name: '保存 LLM 配置', exact: true }).click();
  await expect(page.getByText('LLM 配置已保存').first()).toBeVisible();
});

test('AI 生成:生成 → 提交审核 → 通过 → 我的题库可见 → 可开始学习', async ({ page }) => {
  // 1) 我的题库页「添加题目」进 /add,切「AI 生成」页签,填知识点生成
  await page.goto('/#/my');
  await page.getByRole('link', { name: '添加题目' }).first().click();
  await expect(page.getByRole('heading', { name: '添加题目' })).toBeVisible();
  // v7 模式卡片:先切到 AI 生成
  await page.locator('[data-add-mode="ai"]').click();
  const aiSection = page.locator('[data-add-section="ai"]');
  await aiSection.getByPlaceholder(/React Hooks/).fill('React Hooks 深入');
  await aiSection.getByRole('button', { name: '生成题目', exact: true }).click();

  // 2) 预览出现(mock 返回 2 题),展开一题看答案
  await expect(page.getByText('AI 判断出 2 道题')).toBeVisible({ timeout: 10_000 });
  await page.getByText('useEffect 的清理函数在哪些时机执行?').click();
  await expect(page.getByText('参考答案要点')).toBeVisible();

  // 3) 提交审核(自动跳 #/drafts),批次名 = 知识点
  await page.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByRole('heading', { name: 'React Hooks 深入' })).toBeVisible();
  await expect(page.getByText(/2 题待审/)).toBeVisible();

  // 4) 本批全部通过 → 待审核清空
  await page.getByRole('button', { name: '本批全部通过' }).click();
  await expect(page.getByText('没有待审核的题')).toBeVisible({ timeout: 10_000 });

  // 5) 首页:我的题库卡片出现 2 题
  await page.goto('/#/');
  const myCard = page.locator('main').getByRole('link', { name: /我的题库/ }).first();
  await expect(myCard).toBeVisible();
  await expect(myCard.getByText('0/2')).toBeVisible();

  // 6) 进我的题库(题库空间):2 题在列
  await myCard.click();
  await expect(page).toHaveURL(/library\?category=my/);
  await expect(page.getByText('共 2 题')).toBeVisible();

  // 7) 我的题库题目列表:行尾 icon 编辑/删除直接可见;来源徽标可见(AI 生成)
  await page.goto('/#/my/browse');
  await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '删除' }).first()).toBeVisible();
  await expect(page.getByText('AI 生成', { exact: true }).first()).toBeVisible();
});

test('待审核:逐题拒绝不进我的题库', async ({ page }) => {
  await page.goto('/#/my');
  await page.getByRole('link', { name: '添加题目' }).first().click();
  await page.locator('[data-add-mode="ai"]').click();
  const aiSection = page.locator('[data-add-section="ai"]');
  await aiSection.getByPlaceholder(/React Hooks/).fill('Event Loop');
  await aiSection.getByRole('button', { name: '生成题目', exact: true }).click();
  await expect(page.getByText('AI 判断出 2 道题')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByText(/2 题待审/)).toBeVisible();

  // 详情栏就地拒绝(v10:第一题默认选中;拒绝 = 删除,需确认)
  await page.getByRole('button', { name: '拒绝', exact: true }).click();
  await expect(page.getByText('拒绝这道题?')).toBeVisible();
  await page.getByRole('button', { name: '确认拒绝' }).click();
  await expect(page.getByText(/1 题待审/)).toBeVisible({ timeout: 10_000 });

  // 首页我的题库仍为空(空态卡中性文案)
  await page.goto('/#/');
  await expect(page.getByText('暂无题目')).toBeVisible();
});

test('JD 管理:内联新增 JD → 行内「按 JD 生成」→ 提交审核(来源按 JD)', async ({ page }) => {
  // 1) JD 管理:内联创建(表单出现在列表顶部,不弹窗)
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'JD 管理' })).toBeVisible();
  await page.getByRole('button', { name: '新增 JD' }).first().click();
  await page.getByLabel('标题(可空)').fill('AI 应用工程师');
  await page.getByLabel('公司').fill('示例公司');
  await page.getByLabel('职位描述(JD)').fill('负责 RAG 检索系统的设计与优化,熟悉向量数据库与 embedding 调优,有 LLM 应用落地经验。');
  await page.getByRole('button', { name: '添加 JD', exact: true }).click();

  // 2) JD 列表出现该条;行内「按 JD 生成题目」开弹窗(jd 模式,标题带 JD 名)
  await expect(page.getByText('AI 应用工程师').first()).toBeVisible();
  await page.getByRole('button', { name: /按 JD 生成题目/ }).click();
  // 深链 /add?jd=<id>:锁定按 JD 模式
  await expect(page).toHaveURL(/add\?jd=/);
  // 按 JD 段已选中该 JD(下拉显示标题)
  const jdSection = page.locator('[data-add-section="jd"]');
  await expect(jdSection.getByRole('combobox', { name: '目标 JD' })).toContainText('AI 应用工程师');

  // 3) 定向生成(mock)并提交审核:批次名带 JD定向 · 公司
  await jdSection.getByRole('button', { name: '生成题目', exact: true }).click();
  await expect(page.getByText('AI 判断出 2 道题')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /提交审核/ }).click();
  await expect(page.getByRole('heading', { name: 'JD定向 · 示例公司' })).toBeVisible();

  // 4) 通过后来源徽标 = 按 JD
  await page.getByRole('button', { name: '本批全部通过' }).click();
  await page.goto('/#/my/browse');
  await expect(page.getByText('按 JD', { exact: true }).first()).toBeVisible();
});

test('今日页:交接式计划(现在卡)+ 学习新题深链到混排会话', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  // 官方库已播种、零进度:第一件事 = 学习新题,「现在」卡是唯一主行动;
  // 审核零值不出现(交接式只显示未完成项)
  await expect(page.getByText('现在', { exact: true })).toBeVisible();
  const learnCta = page.getByRole('link', { name: '开始学习' });
  await expect(learnCta).toBeVisible();
  await expect(page.getByRole('link', { name: /求职材料/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '去审核' })).toHaveCount(0);
  // 「现在」卡 CTA → 全库混排会话(focus=new)
  await learnCta.click();
  await expect(page).toHaveURL(/session\?focus=new/);
  await expect(page.locator('main span.font-display').first()).toHaveText(/^1 \/ \d+$/);
});

test('官方题题目列表:详情栏添加到我的题库 → toast + 置灰 + 副本进我的库(来源官方复制)', async ({ page }) => {
  await page.goto('/#/agent/browse');
  // v10:第一行默认选中,「添加到我的题库」在右侧详情栏就地完成
  const addBtn = page.getByRole('button', { name: '添加到我的题库' });
  await expect(addBtn).toBeVisible();
  await addBtn.click();

  await expect(page.getByText('已添加到我的题库')).toBeVisible();
  await expect(page.getByRole('button', { name: '已在我的库' })).toBeDisabled();

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
  await expect(page.getByText('远端同步新增的验证题?').first()).toBeVisible({ timeout: 10_000 });
});

test('设置页渲染:预设与 key 表单', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  // 五分区:学习(题量)/外观/LLM/数据管理/关于;v10:多选一统一 RadioGroup
  await expect(page.getByRole('radiogroup', { name: '每次学习题量' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: '外观主题' })).toBeVisible();
  await expect(page.getByText('AI 生成(LLM)')).toBeVisible();
  await expect(page.getByText('数据管理')).toBeVisible();
  await expect(page.getByText('关于')).toBeVisible();
  await expect(page.getByText('baseURL', { exact: true })).toBeVisible();
  await expect(page.getByText('OpenAI 兼容端点')).toBeVisible();
  const keyInput = page.getByPlaceholder('sk-…');
  await expect(keyInput).toBeVisible();
  await keyInput.fill('sk-e2e-test-2'); // 与 beforeEach 已存值不同,触发 dirty 才可保存
  await page.getByRole('button', { name: '保存 LLM 配置', exact: true }).click();
  await expect(page.getByText('LLM 配置已保存').first()).toBeVisible();
});

test('官方题题目列表:筛选(模块下拉 + 难度/状态芯片)', async ({ page }) => {
  await page.goto('/#/library?category=agent');
  await expect(page.getByRole('combobox', { name: '模块' })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部难度' })).toBeVisible();
  await expect(page.getByRole('button', { name: '全部状态' })).toBeVisible();
  await expect(page.getByText(/共 \d+ 题/)).toBeVisible();
  // 筛单个模块:出现该模块统计 + 进度条
  await page.getByRole('combobox', { name: '模块' }).click();
  await page.getByRole('option', { name: /· / }).first().click();
  await expect(page.getByText(/已学 \d+\/\d+/).first()).toBeVisible();
  // 叠加难度芯片,计数变化
  const totalText = await page.getByText(/共 \d+ 题/).innerText();
  await page.getByRole('button', { name: '高', exact: true }).click();
  await expect(page.getByText(/共 \d+ 题/)).not.toHaveText(totalText);
  // 重置回全部
  await page.getByRole('button', { name: '重置' }).click();
  await expect(page.getByRole('combobox', { name: '模块' })).toContainText('全部模块');
});
