import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 刷题工作台:键盘流(空格翻答案 / 1-2-3 评分)、跳过、撤销、sticky 操作条、进度条。
// 纯 web 层(Tauri invoke 走 init mock,SQLite 降级内存);进度真实写内存缓存可验证撤销。
// 终态(再过一遍/轮次完成)与沉浸宽度由人工截图目检 + immersive.spec 覆盖。

const BUNDLED_BANK = JSON.parse(readFileSync(new URL('../../public/questions.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd.includes('|select')) return [];
        if (cmd.includes('|execute')) return [0, 0];
        if (cmd.includes('|load')) return ':memory:';
        return null;
      },
      transformCallback: () => 0,
      metadata: { currentWindow: { label: 'main' } },
    };
  });
});

// meta 行进度计数(如「1 / 50」);v6 计数用显示字体,限定 main 内容区首个
function counter(page: import('@playwright/test').Page) {
  return page.locator('main span.font-display').first();
}

test('键盘流:空格翻答案,数字键评分推进', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  await expect(counter(page)).toHaveText(/^1 \/ \d+$/);

  // 空格翻答案(不是点击)
  await page.keyboard.press('Space');
  await expect(page.getByText('参考答案要点')).toBeVisible();

  // 3 = 掌握 → 推进到第 2 题,答案收起
  await page.keyboard.press('3');
  await expect(counter(page)).toHaveText(/^2 \/ \d+$/);
  await expect(page.getByText('参考答案要点')).toBeHidden();
});

test('撤销评分:回退一题重评', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  await expect(counter(page)).toHaveText(/^1 \/ \d+$/); // 等数据就绪
  await page.keyboard.press('Space');
  await page.keyboard.press('3'); // 掌握
  await expect(counter(page)).toHaveText(/^2 \/ \d+$/);

  await page.getByRole('button', { name: '撤销上一题' }).click();
  await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
  // 回到那题:可重新翻答案
  await page.keyboard.press('Space');
  await expect(page.getByText('参考答案要点')).toBeVisible();
});

test('跳过本题:不评分直接前进,无撤销入口', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  await page.getByRole('button', { name: '跳过本题' }).click();
  await expect(counter(page)).toHaveText(/^2 \/ \d+$/);
  await expect(page.getByRole('button', { name: '撤销上一题' })).toBeHidden();
});

test('操作条 sticky 吸底 + 进度条渲染', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  // 评分/跳过所在操作条 sticky(长答案滚动时仍可达)
  await expect(page.locator('div.sticky').filter({ has: page.getByRole('button', { name: '跳过本题' }) })).toBeVisible();
  // radix progress
  await expect(page.getByRole('progressbar')).toBeVisible();
});

test('键盘守卫:弹窗打开时数字键/空格不触发翻答案与评分', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  await page.getByRole('button', { name: /代码草稿纸/ }).click();
  // 焦点放弹窗标题(非编辑器,隔离「弹窗开着」这条守卫)
  await page.getByRole('dialog').getByText('代码草稿纸 · JavaScript').click();
  await page.keyboard.press('Space');
  await page.keyboard.press('3');
  await expect(page.getByText('参考答案要点')).toBeHidden();
  await expect(counter(page)).toHaveText(/^1 \/ \d+$/);
});

test('键盘守卫:笔记抽屉编辑器聚焦时空格不翻答案', async ({ page }) => {
  await page.goto('/#/session?category=agent');
  await page.getByRole('button', { name: /写笔记/ }).click();
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type(' ');
  await expect(page.getByText('参考答案要点')).toBeHidden();
});

test('不会即时重排:评不会的题进入会话尾部,重练模糊后放行', async ({ page }) => {
  // limit=1:基础队列只有 1 题,评「不会」后重排副本立即成为下一题
  await page.goto('/#/session?category=agent&limit=1');
  await expect(counter(page)).toHaveText(/^1 \/ 1$/);
  await page.keyboard.press('Space');
  await page.keyboard.press('1'); // 不会 → 重排副本入队,总数 1 → 2
  await expect(counter(page)).toHaveText(/^2 \/ 2/); // 含重练标记文本
  await expect(page.getByText(/含 1 题重练/)).toBeVisible();
  // 重练副本评模糊 → 放行,进入会话小结(两道都计入:原评 + 重练评)
  await page.keyboard.press('Space');
  await page.keyboard.press('2');
  await expect(page.getByText('本轮完成,学了 2 道题')).toBeVisible();
  await expect(page.getByText(/含 1 题重练/)).toHaveCount(0);
});

test('会话小结:完成后逐题回顾(评分 + 下次复习日期)', async ({ page }) => {
  await page.goto('/#/session?category=agent&limit=1');
  await expect(counter(page)).toHaveText(/^1 \/ 1$/);
  await page.keyboard.press('Space');
  await page.keyboard.press('3'); // 掌握
  await expect(page.getByText('本轮完成,学了 1 道题')).toBeVisible();
  await expect(page.getByText('逐题回顾')).toBeVisible();
  await expect(page.getByText(/\d+ 月 \d+ 日/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '回到今日' })).toBeVisible();
});
