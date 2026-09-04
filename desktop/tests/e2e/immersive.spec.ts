import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 沉浸式刷题 + 问 AI 入口:纯 web 层(不 mock Tauri,走浏览器降级路径)。
// v2 顶部导航:chrome = [data-app-nav] 导航条。
// Tauri 的系统全屏与子 webview 窗口属真机层(tauri dev / smoke 验证);
// 这里覆盖 CSS 沉浸(侧栏/返回条隐藏)、Esc 与路由守卫退出、问 AI 浏览器降级外链。

const BUNDLED_BANK = JSON.parse(readFileSync(new URL('../../public/questions.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('**/resume-assistant/questions.json', (r) => r.fulfill({ json: BUNDLED_BANK }));
});

test('沉浸式:隐藏侧栏与返回条,Esc 退出恢复', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await expect(page.locator('[data-app-nav]')).toBeVisible();
  await expect(page.getByRole('link', { name: /回到/ })).toBeVisible();

  await page.getByRole('button', { name: '沉浸模式' }).click();
  await expect(page.locator('[data-app-nav]')).toBeHidden();
  await expect(page.getByRole('link', { name: /回到/ })).toBeHidden();
  // 题目仍在刷,退出按钮出现(aria-label 已切换,兼作 Esc 之外的退出入口)
  await expect(page.getByRole('button', { name: '退出沉浸模式' })).toBeVisible();
  await expect(page.getByRole('button', { name: /看答案/ })).toBeVisible();

  // Esc 退出:chrome 恢复
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-nav]')).toBeVisible();
  await expect(page.getByRole('link', { name: /回到/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '沉浸模式' })).toBeVisible();
});

test('沉浸式:离开刷题路由自动退出(含后退场景)', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: '沉浸模式' }).click();
  await expect(page.locator('[data-app-nav]')).toBeHidden();

  // 客户端 hash 导航(等价 Cmd+← / 点链接):不整页刷新,验证路由守卫本身
  await page.evaluate(() => {
    location.hash = '#/agent/browse';
  });
  await expect(page.locator('[data-app-nav]')).toBeVisible();
});

test('沉浸式:弹窗打开时 Esc 只关弹窗,不退沉浸', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: '沉浸模式' }).click();
  await expect(page.locator('[data-app-nav]')).toBeHidden();

  // 打开代码草稿纸弹窗
  await page.getByRole('button', { name: /代码草稿纸/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // 第一次 Esc:弹窗关,沉浸保持
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('[data-app-nav]')).toBeHidden();

  // 第二次 Esc:退出沉浸,chrome 恢复
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-nav]')).toBeVisible();
});

test('问 AI:web 层降级为外部链接', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  const link = page.getByRole('link', { name: '问 AI(浏览器打开)' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', 'https://chat.qwen.ai/');
  await expect(link).toHaveAttribute('target', '_blank');
});
