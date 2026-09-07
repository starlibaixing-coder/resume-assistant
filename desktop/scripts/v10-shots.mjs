// v10 交互重做截图:驱动真实 UI 造出有数据的场景,再截取关键状态(深浅双主题)。
// 用法:cd desktop && node scripts/v10-shots.mjs
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const OUT = '/tmp/v10-shots';
mkdirSync(OUT, { recursive: true });
const BUNDLED_BANK = JSON.parse(readFileSync(new URL('../public/questions.json', import.meta.url), 'utf8'));

const browser = await chromium.launch();

async function shoot(theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
  await page.addInitScript((t) => {
    localStorage.setItem('quiz-theme', t);
    localStorage.setItem('llm-config', JSON.stringify({ baseURL: 'http://mock.local/v1', model: 'mock-model' }));
    // eslint-disable-next-line no-undef
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd) => {
        if (cmd.includes('|select')) return [];
        if (cmd.includes('|execute')) return [0, 0];
        if (cmd.includes('|load')) return ':memory:';
        return null;
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' } },
    };
  }, theme);
  await page.route('**/chat/completions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              {
                difficulty: '中', title: '什么是虚拟列表？它与分页加载如何取舍？', focus: '长列表渲染优化',
                answer: ['虚拟列表只渲染可视区与缓冲区的行,滚动时复用 DOM,总高度用占位撑起', '取舍:要随机跳转或检索用分页;要无限流畅滚动且数据量大时用虚拟列表', '实现要点:行绝对定位、二分查找起始索引、动态行高要测量并缓存'],
                followups: ['动态行高怎么处理?'], tags: ['性能'],
              },
              {
                difficulty: '高', title: '如何设计一个支持取消的异步任务队列？', focus: '并发控制与生命周期管理',
                answer: ['每个任务持有 AbortController;队列并发上限 N,完成后自动补位', '取消 = abort 信号传给 fetch,任务标记 cancelled 不再执行回调', '取消后要清理副作用;重试与取消互斥'],
                followups: [], tags: [],
              },
            ]),
          },
        }],
      }),
    }),
  );

  const tag = theme;
  // LLM key:真实保存入口种下
  await page.goto('http://localhost:5174/#/settings');
  await page.getByPlaceholder('sk-…').fill('sk-shot');
  await page.getByRole('button', { name: '保存 LLM 配置', exact: true }).click();
  await page.getByText('LLM 配置已保存').first().waitFor();

  // 造数据:练 2 题(1 掌握 1 不会→重排)+ AI 生成 2 题进待审 + 建 1 份 JD
  await page.goto('http://localhost:5174/#/session');
  await page.getByRole('button', { name: /我想好了,看答案/ }).click();
  await page.getByRole('button', { name: /掌握/ }).click();
  await page.getByRole('button', { name: /我想好了,看答案/ }).waitFor();
  await page.getByRole('button', { name: /我想好了,看答案/ }).click();
  await page.getByRole('button', { name: /不会/ }).click();

  // 造待审核:AI 生成 → 提交审核(不通过,保留待审场景)
  await page.goto('http://localhost:5174/#/add');
  await page.locator('[data-add-mode="ai"]').click();
  await page.locator('[data-add-section="ai"]').getByPlaceholder(/React Hooks/).fill('长列表优化');
  await page.locator('[data-add-section="ai"]').getByRole('button', { name: '生成题目', exact: true }).click();
  await page.getByText('AI 判断出 2 道题').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: /提交审核/ }).click();
  await page.getByText(/2 题待审/).waitFor();

  // 造 JD:内联创建
  await page.goto('http://localhost:5174/#/profile');
  await page.getByRole('button', { name: '新增 JD' }).first().click();
  await page.getByLabel('标题(可空)').fill('AI 应用工程师');
  await page.getByLabel('公司').fill('示例公司');
  await page.getByLabel('职位描述(JD)').fill('负责 AI Agent 产品的前端与编排层建设,深入理解 Function Calling、RAG 等应用模式;TypeScript 熟练,对模型能力边界有体感,能独立完成从原型到上线的完整链路。');
  await page.getByRole('button', { name: '添加 JD', exact: true }).click();
  await page.getByText('JD 已添加').waitFor();

  // ── 截图 ──
  const snap = async (name) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  };

  // 1 今日(交接卡:现在=复习 1,接下来=学习新题/审核 2/求职材料)
  await page.goto('http://localhost:5174/#/');
  await snap('01-today');

  // 2 练习:揭示态
  await page.goto('http://localhost:5174/#/session');
  await page.getByRole('button', { name: /我想好了,看答案/ }).click();
  await snap('02-quiz-revealed');

  // 3 评分反馈闪现
  await page.getByRole('button', { name: /掌握/ }).click();
  await page.waitForTimeout(250);
  await snap('03-quiz-flash');

  // 4 题库浏览工作台
  await page.goto('http://localhost:5174/#/library?category=fe');
  await page.locator('[data-workbench-list] [role="button"]').nth(2).click();
  await snap('04-library-workbench');

  // 5 审核工作台
  await page.goto('http://localhost:5174/#/library?tab=review');
  await snap('05-audit');

  // 6 通过一题 → 我的题库有题;截我的库工作台 + 就地编辑
  await page.getByRole('button', { name: /通过,进我的题库/ }).click();
  await page.getByText('已通过,进我的题库').waitFor();
  await page.goto('http://localhost:5174/#/library?category=my');
  await page.locator('[data-workbench-list] [role="button"]').first().click();
  await snap('06-my-workbench');
  await page.getByRole('button', { name: '编辑' }).click();
  await snap('07-my-inline-edit');

  // 7 JD 工作台
  await page.goto('http://localhost:5174/#/profile');
  await snap('08-jd');

  // 8 简历
  await page.goto('http://localhost:5174/#/profile?tab=resume');
  await snap('09-resume');

  // 9 添加题目
  await page.goto('http://localhost:5174/#/add');
  await snap('10-add');

  // 10 设置(RadioGroup)
  await page.goto('http://localhost:5174/#/settings');
  await snap('11-settings');

  // 11 ⌘K 面板
  await page.goto('http://localhost:5174/#/');
  await page.keyboard.press('Meta+k');
  await page.waitForTimeout(400);
  await snap('12-palette');

  await page.close();
}

await shoot('light');
await shoot('dark');
await browser.close();
console.log('done:', OUT);
