// 新前端截图目检:dev server 内播种演示数据,主要页面 × 双主题各截一张 → desktop/shots/
// 内存降级模式下,整页刷新会清空数据,所以每次导航后都重新 seed。
// 用法:node scripts/rebuild-shots.mjs(dev server 需已在 5174 运行)

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function questionSeed(id, over = {}) {
  const now = Date.now();
  return {
    id,
    origin: 'my',
    category: 'my',
    module: 1,
    moduleName: '浏览器原理',
    index: 1,
    difficulty: '中',
    title: `测试题 ${id}`,
    focus: '考察演示数据链路',
    answer: [
      '**主流答案**:这是一条演示用的答案要点,内容覆盖足够长度,用于展示排版与阅读列宽,**重点**以粗体呈现。',
      '第二个要点:辅助说明,让答案区看起来接近真实使用状态;行内代码如 `event.loop` 也有样式。',
    ],
    followups: ['追问一:如果微任务里再产生微任务会怎样?'],
    tags: ['必问', '演示'],
    status: 'approved',
    source: 'manual',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

const day = 24 * 60 * 60 * 1000;
const now = Date.now();
const today = new Date(now);
const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

const SEED = () => ({
  my: [
    questionSeed('my.1.1', { title: '什么是事件循环?浏览器和 Node 里有什么差异?' }),
    questionSeed('my.1.2', { title: '手写 Promise.all,并说明错误处理策略' }),
    questionSeed('my.1.3', { title: 'requestAnimationFrame 的执行时机' }),
    questionSeed('gen.1', { status: 'pending', source: 'ai', sourceRef: 'AI 生成 · 知识点「闭包」', title: '闭包在循环里捕获变量的行为', moduleName: '闭包' }),
    questionSeed('gen.2', { status: 'pending', source: 'jd', sourceRef: '按 JD 生成 · 前端工程师', title: '虚拟 DOM 的 diff 策略与 key 的作用', moduleName: '框架' }),
  ],
  cards: {
    'my.1.2': { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: now - day, dueAt: now - 1 },
    'my.1.3': { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: now - day, dueAt: now + day },
  },
  ratingLog: [
    { question_id: 'my.1.2', day: dayKey, rating: 'no', rated_at: now - 3600_000 },
    { question_id: 'my.1.3', day: dayKey, rating: 'ok', rated_at: now - 3500_000 },
  ],
});

const PAGES = [
  ['today', '/'],
  ['library', '/#/library?cat=fe'],
  ['library-my', '/#/library?cat=my&qid=my.1.1'],
  ['review', '/#/review'],
  ['add', '/#/add'],
  ['jd', '/#/jd'],
  ['resume', '/#/resume'],
  ['settings', '/#/settings'],
];

async function gotoAndSeed(page, path, { reload = false } = {}) {
  await page.goto(`http://localhost:5174/${path}`);
  if (reload) await page.reload(); // hash 导航不重跑 index.html 主题内联脚本,切主题时需强制刷新
  await page.waitForFunction(() => !!window.__cc);
  await page.evaluate((seed) => {
    window.__cc._seedForTest(seed);
  }, SEED());
  await page.waitForTimeout(350);
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: { categories: [], questions: [], total: 0 } }));

  // ── 浅色「暖纸」 ──
  for (const [name, path] of PAGES) {
    await gotoAndSeed(page, path);
    await page.screenshot({ path: `${OUT}${name}-light.png` });
  }

  // session:开会话 → 揭示 → 截评分态
  await gotoAndSeed(page, '/');
  await page.evaluate(() => {
    const cards = new Map([['my.1.2', { dueAt: Date.now() - 1 }]]);
    window.__cc.startSession({ type: 'review', questions: [{ id: 'my.1.2' }], cards, batchSize: 'all' });
    window.location.hash = '#/session';
  });
  await page.waitForTimeout(300);
  await page.getByTestId('reveal-btn').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}session-light.png` });

  // ── 深色「夜读」 ──
  await page.addInitScript(() => localStorage.setItem('cc-theme', 'dark'));
  for (const [name, path] of [['today', '/'], ['library-my', '/#/library?cat=my&qid=my.1.1'], ['session-review', '/'], ['review', '/#/review'], ['settings', '/#/settings']]) {
    await gotoAndSeed(page, path, { reload: true });
    await page.evaluate(() => {
      localStorage.setItem('cc-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    if (name === 'session-review') {
      await page.evaluate(() => {
        const cards = new Map([['my.1.2', { dueAt: Date.now() - 1 }]]);
        window.__cc.startSession({ type: 'review', questions: [{ id: 'my.1.2' }], cards, batchSize: 'all' });
        window.location.hash = '#/session';
      });
      await page.waitForTimeout(300);
      await page.getByTestId('reveal-btn').click();
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({ path: `${OUT}${name}-dark.png` });
  }

  await browser.close();
  console.log('shots done →', OUT);
};

run();
