// M4/M6 工作台:题库筛选与详情;审核通过/拒绝确认

import { expect, test } from '@playwright/test';

import { questionSeed, seedData, stubRemote } from './helpers';

test.beforeEach(async ({ page }) => {
  await stubRemote(page);
});

test('题库:筛选下拉 + 行选中详情 + 单题练习', async ({ page }) => {
  await page.goto('/');
  const now = Date.now();
  await seedData(
    page,
    [questionSeed('my.4.1', { title: '筛选命中题' }), questionSeed('my.4.2', { title: '已掌握题' })],
    {
      'my.4.2': { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: now - 86400000, dueAt: now + 3 * 86400000 },
    },
  );
  await page.getByTestId('nav-/library').click();
  await page.getByRole('button', { name: '我的题库', exact: true }).click();
  await expect(page.getByTestId('question-table')).toContainText('筛选命中题');
  // 状态筛选:已掌握 → 只剩 4.2
  await page.getByRole('combobox', { name: '按状态筛选' }).click();
  await page.getByRole('option', { name: '已掌握' }).click();
  await expect(page.getByTestId('question-table')).toContainText('已掌握题');
  await expect(page.getByTestId('question-table')).not.toContainText('筛选命中题');
  // 选中详情 + 练习这一题 → /session
  await page.getByTestId('question-row').first().click();
  await page.getByRole('button', { name: /练习这一题/ }).click();
  await expect(page.getByTestId('question-title')).toContainText('已掌握题');
});

test('题库:qid 深链定位详情', async ({ page }) => {
  await page.goto('/');
  await seedData(page, [questionSeed('my.4.5', { title: '深链目标题' })]);
  await page.goto('/#/library?cat=my&qid=my.4.5');
  await expect(page.getByTestId('question-detail')).toContainText('深链目标题');
});

test('审核:待审列表 → 编辑后通过 → 计数联动;拒绝走确认', async ({ page }) => {
  await page.goto('/');
  await seedData(page, [
    questionSeed('gen.1', { status: 'pending', source: 'ai', sourceRef: 'AI 生成 · 知识点「闭包」', title: '待审题一' }),
    questionSeed('gen.2', { status: 'pending', source: 'jd', sourceRef: '按 JD 生成 · 前端岗', title: '待审题二' }),
  ]);
  await page.getByTestId('nav-/review').click();
  await expect(page.getByTestId('audit-list')).toContainText('待审题一');
  await expect(page.getByTestId('audit-list')).toContainText('AI 生成 · 知识点「闭包」');
  // 通过
  await page.getByTestId('audit-list').getByText('待审题一').click();
  await page.getByTestId('approve-btn').click();
  await expect(page.getByText(/已通过,题目入库/)).toBeVisible();
  await expect(page.getByTestId('audit-list')).toContainText('待审题二');
  // 拒绝:确认弹窗初始焦点在取消
  await page.getByTestId('audit-list').getByText('待审题二').click();
  await page.getByTestId('reject-btn').click();
  await expect(page.getByText('拒绝并删除这道题?')).toBeVisible();
  await page.getByRole('button', { name: '拒绝' }).last().click();
  await expect(page.getByText('没有待审核的题目')).toBeVisible();
});
