// 批次3 截图目检(临时):中枢 JD 管理/新增弹窗/定向生题上下文
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';

const BUNDLED_BANK = JSON.parse(readFileSync(new URL('../../public/questions.json', import.meta.url), 'utf8'));
const OUT = '/tmp/ux-shots4';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await ctx.newPage();
await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
await page.route('**/chat/completions', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '[]' } }] }) }));
await page.addInitScript(() => {
  localStorage.setItem('quiz-theme', 'dark');
  window.__TAURI_INTERNALS__ = {
    invoke: async (c) => c.includes('|select') ? [] : c.includes('|execute') ? [0, 0] : c.includes('|load') ? ':memory:' : null,
    transformCallback: () => 0,
    metadata: { currentWindow: { label: 'main' } },
  };
});

// 1. 中枢空态
await page.goto('http://localhost:5174/#/profile');
await page.getByRole('heading', { name: '求职中枢' }).waitFor();
await page.screenshot({ path: `${OUT}/hub-empty.png` });

// 2. 新增 JD 弹窗(填内容)
await page.getByRole('button', { name: '新增 JD' }).first().click();
await page.getByRole('dialog').getByLabel('标题(可空)').fill('AI 应用工程师');
await page.getByRole('dialog').getByLabel('公司').fill('示例公司');
await page.getByRole('dialog').getByLabel('职位描述(JD)').fill('负责 RAG 检索系统的设计与优化,熟悉向量数据库与 embedding 调优,有 LLM 应用落地经验,懂 TypeScript 与 React。');
await page.screenshot({ path: `${OUT}/hub-jd-dialog.png` });
await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
await page.getByText('AI 应用工程师').first().waitFor();

// 3. JD 列表(行内动作)
await page.screenshot({ path: `${OUT}/hub-jd-list.png` });

// 4. 定向生题上下文页
await page.getByRole('link', { name: /定向生题/ }).click();
await page.getByText('定向上下文').waitFor();
await page.screenshot({ path: `${OUT}/generate-jd-context.png` });

await ctx.close();
await browser.close();
console.log('done:', OUT);
