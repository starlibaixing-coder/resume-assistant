// M1 冒烟 + 热键:壳渲染 / ⌘1–8 切页 / ⌘K 面板 / ⌘, 设置 / 状态栏计数联动

import { expect, test } from '@playwright/test';

import { questionSeed, seedData, stubRemote } from './helpers';

test.beforeEach(async ({ page }) => {
  await stubRemote(page);
});

test('首页渲染:品牌、导航八项、今日页驾驶舱,存储初始化不失败', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('CommitCareer')).toBeVisible();
  for (const p of ['nav-/', 'nav-/session', 'nav-/library', 'nav-/review', 'nav-/add', 'nav-/jd', 'nav-/resume', 'nav-/settings']) {
    await expect(page.getByTestId(p)).toBeVisible();
  }
  await expect(page.getByTestId('today-page')).toBeVisible();
  await expect(page.getByText('存储初始化失败')).toHaveCount(0);
  await expect(page).toHaveTitle(/CommitCareer/);
});

test('⌘1–8 / ⌘, 切换路由并更新标题', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('today-page')).toBeVisible(); // 热键在 AppInner 挂载后才生效
  await page.keyboard.press('Meta+3');
  await expect(page.getByTestId('question-table')).toBeVisible();
  await expect(page).toHaveTitle(/题库 · CommitCareer/);
  await page.keyboard.press('Meta+,');
  await expect(page.getByText('AI 服务')).toBeVisible();
  await expect(page).toHaveTitle(/设置 · CommitCareer/);
  await page.keyboard.press('Meta+1');
  await expect(page.getByTestId('today-page')).toBeVisible();
});

test('⌘K 面板:动作/前往/题目三组,可搜索题目并落库详情', async ({ page }) => {
  await page.goto('/');
  await seedData(page, [questionSeed('my.1.1', { title: '什么是事件循环' }), questionSeed('my.1.2', { title: '手写防抖' })]);
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('前往 今日')).toBeVisible();
  await page.keyboard.type('事件循环');
  await page.getByText('什么是事件循环').click();
  await expect(page.getByTestId('question-detail')).toBeVisible();
  await expect(page.getByTestId('question-detail')).toContainText('什么是事件循环');
});

test('状态栏计数:播种后待复习/连续天数与 hero 联动', async ({ page }) => {
  await page.goto('/');
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const d = new Date(now);
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await seedData(
    page,
    [questionSeed('my.2.1'), questionSeed('my.2.2'), questionSeed('my.2.3')],
    {
      'my.2.2': { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: now - day, dueAt: now - 1 },
      'my.2.3': { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: now - day, dueAt: now + day },
    },
    [{ question_id: 'my.2.2', day: today, rating: 'no', rated_at: now - 3600_000 }],
  );
  await expect(page.getByTestId('today-page')).toBeVisible();
  // 状态栏:待复习 1(my.2.2)/ 连续 1 天(来自 rating_log;官方 282 题并入待学习计数)
  const bar = page.locator('footer');
  await expect(bar.getByRole('button', { name: /待复习/ })).toHaveText(/待复习1/);
  await expect(bar).toContainText('连续 1 天');
  // 今日页 hero:有到期 → 复习优先
  await expect(page.getByTestId('plan-review')).toContainText('复习 1 题');
});
