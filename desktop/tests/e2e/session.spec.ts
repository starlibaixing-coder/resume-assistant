// M3 会话流:今日页 CTA 开复习 → 揭示 → 评分 → 结果条 → 小结;重练副本入队;草稿纸可用

import { expect, test } from '@playwright/test';

import { questionSeed, seedData, stubRemote } from './helpers';

test.beforeEach(async ({ page }) => {
  await stubRemote(page);
});

test('复习全流程:揭示 → 掌握 → 下一题 → 小结统计', async ({ page }) => {
  await page.goto('/');
  const now = Date.now();
  await seedData(
    page,
    [questionSeed('my.3.1', { title: '到期题甲' }), questionSeed('my.3.2', { title: '到期题乙' })],
    {
      'my.3.1': { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: now - 86400000, dueAt: now - 1 },
      'my.3.2': { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: now - 86400000, dueAt: now - 2 },
    },
  );
  await page.getByRole('button', { name: /开始复习/ }).first().click();
  await expect(page.getByTestId('question-title')).toContainText('到期题乙'); // due 更早的在前
  await page.getByTestId('reveal-btn').click();
  await expect(page.getByTestId('revealed-area')).toBeVisible();
  await page.getByTestId('rating-bar').getByRole('button', { name: /掌握/ }).click();
  await expect(page.getByTestId('result-flash')).toBeVisible();
  // 结果条播完自动推进
  await expect(page.getByTestId('question-title')).toContainText('到期题甲', { timeout: 4000 });
  await page.getByTestId('reveal-btn').click();
  await page.getByTestId('rating-bar').getByRole('button', { name: /不会/ }).click();
  // 评 no → 重练副本排在队尾(第 3 题),重练评掌握后才进小结
  await expect(page.getByTestId('question-title')).toContainText('到期题甲', { timeout: 4000 });
  await page.getByTestId('reveal-btn').click();
  await page.getByTestId('rating-bar').getByRole('button', { name: /掌握/ }).click();
  await expect(page.getByTestId('session-summary')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('session-summary')).toContainText('学习了 2 道题');
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByTestId('today-page')).toBeVisible();
});

test('空会话空态与总复习入口', async ({ page }) => {
  await page.goto('/#/session');
  await expect(page.getByRole('main').getByText('学习队列')).toBeVisible();
  await expect(page.getByText(/总复习\(全部 \d+ 题\)/)).toBeVisible();
});

test('草稿纸:写入代码并运行,输出可见', async ({ page }) => {
  await page.goto('/');
  await seedData(page, [questionSeed('my.3.9')]);
  await page.getByRole('button', { name: /开始学习/ }).first().click();
  await page.getByRole('button', { name: /草稿纸/ }).click();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type('console.log(1+1)');
  await page.getByRole('button', { name: /运行/ }).click();
  await expect(page.getByRole('log')).toContainText('2');
});
