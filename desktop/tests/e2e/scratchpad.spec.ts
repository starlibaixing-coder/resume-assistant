import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 代码草稿纸 + 手动加题(web 层)。
// Worker 是浏览器原生能力,chromium 真跑(非 mock);Tauri invoke 走 init mock(SQLite 降级内存)。
// 真 SQLite 持久化由 tauri dev / smoke 验证。

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

// ===== 代码草稿纸 =====

test('刷题页:写代码 → 运行出输出(含异步)→ 报错可见', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: /代码草稿纸/ }).click();

  // CodeMirror 是 contenteditable:点进去键盘输入(带花括号的函数——closeBrackets 已关,所敲即所得)
  const editor = page.locator('.cm-content');
  const output = page.getByRole('log', { name: '运行输出' }); // 断言只看输出区,不撞编辑器里的代码文本
  await editor.click();
  await page.keyboard.type('function add(a, b) {\n  return a + b;\n}\nconsole.log(add(1, 2));');
  await page.getByRole('button', { name: '运行', exact: true }).click();
  await expect(output.getByText('3', { exact: true })).toBeVisible({ timeout: 5_000 });

  // 异步输出:超时窗内持续追加(真 Worker 行为)
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.type("setTimeout(() => console.log('async-out'), 30);");
  await page.getByRole('button', { name: '运行', exact: true }).click();
  await expect(output.getByText('async-out', { exact: true })).toBeVisible({ timeout: 5_000 });

  // 运行抛错:error 行可见(颜色 + [error] 标签双指示)
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.type("throw new Error('boom')");
  await page.getByRole('button', { name: '运行', exact: true }).click();
  await expect(output.getByText(/Error: boom/)).toBeVisible({ timeout: 5_000 });
});

test('代码按题保存:离开再回来草稿还在,新题不串', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: /代码草稿纸/ }).click();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type("let draft = 'kept-code';");
  // 等防抖(500ms)落内存缓存
  await page.waitForTimeout(700);

  // 离开 → 回来:同题(无进度,队列确定)入口带「有草稿」标记,打开后草稿恢复
  await page.goto('/#/agent/browse');
  await page.goto('/#/agent/quiz');
  const padBtn = page.getByRole('button', { name: '代码草稿纸(有草稿)' });
  await expect(padBtn).toBeVisible();
  await padBtn.click();
  await expect(page.locator('.cm-content')).toContainText('kept-code');
  await page.keyboard.press('Escape'); // 关弹窗(顺带覆盖 Esc 关闭)
  await expect(page.getByRole('dialog')).toBeHidden();

  // 评掉本题进下一题:新题无草稿,入口回到无标记态
  await page.getByRole('button', { name: /看答案/ }).click();
  await page.getByRole('button', { name: /掌握/ }).click();
  await expect(page.getByRole('button', { name: '代码草稿纸', exact: true })).toBeVisible();
});

// 回归:basicSetup/onChange 引用不稳时,@uiw 每次按键都 reconfigure,
// 补全提示刚弹出就被拆掉(修复前本用例红)
test('编辑器补全:console 全局对象与成员有提示', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: /代码草稿纸/ }).click();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type('cons');
  const tooltip = page.locator('.cm-tooltip-autocomplete');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('console');

  // 成员级:补全 console 后接 ".",提示 log/warn
  await page.keyboard.press('Escape'); // 关掉当前补全
  await page.keyboard.press('End');
  await page.keyboard.type('ole.');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('log');
  await expect(tooltip).toContainText('warn');
});

// 回归:跨行选中必须绘制 drawSelection 选中层(修复前选中层随 reconfigure 抖动丢失)
test('编辑器选中:跨行选中绘制选中层', async ({ page }) => {
  await page.goto('/#/agent/quiz');
  await page.getByRole('button', { name: /代码草稿纸/ }).click();
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type('let a = 1;\nlet b = 2;\nlet c = 3;');
  // 光标回文件头,Shift+↓×2 跨行选中:drawSelection 应绘制出选中背景层
  await page.keyboard.press('Meta+ArrowUp');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.locator('.cm-selectionBackground').first()).toBeVisible();
  await expect(page.locator('.cm-selectionBackground')).not.toHaveCount(0);
});

// ===== 手动加题 =====

// 表单 label 均经 htmlFor 关联输入,直接 getByLabel 定位
const ANSWER_50 = '闭包是函数与其词法环境的组合;每次触发前先 clearTimeout 上一次的定时器;immediate 模式要记录是否已立即执行过;this 用参数或箭头函数保留。';

async function fillQuestionForm(page: Page, title: string, focus: string, answer: string) {
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('题干').fill(title);
  await dlg.getByLabel('考察点(focus)').fill(focus);
  await dlg.getByLabel('答案要点(一行一条,合计 ≥50 字)').fill(answer);
}

test('空态手动加题 → 直接进我的题库(不经草稿区)', async ({ page }) => {
  await page.goto('/#/my/browse');
  await expect(page.getByText('我的题库还没有题')).toBeVisible();

  await page.getByRole('button', { name: '手动加题' }).click();
  await page.getByLabel('新模块名').fill('面试手写');
  await fillQuestionForm(page, '手写一个防抖函数要注意什么?', '闭包与定时器清理', ANSWER_50);
  await page.getByRole('dialog').getByLabel('标签(逗号分隔)').fill('js, 手写');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();

  // toast + 直接出现在浏览列表(无草稿区步骤)
  await expect(page.getByText('已加入我的题库')).toBeVisible();
  await expect(page.getByText('手写一个防抖函数要注意什么?')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('面试手写').first()).toBeVisible();
});

test('侧栏「我的题库」落地队列页即有手动加题入口', async ({ page }) => {
  await page.goto('/#/my');
  // 空库:队列页(侧栏落地页)直接给出双入口,不用先找到题目浏览页
  await expect(page.getByText('我的题库还没有题')).toBeVisible();
  await page.getByRole('button', { name: '手动加题' }).click();
  await page.getByLabel('新模块名').fill('面试手写');
  await fillQuestionForm(page, '落地页加的题?', '基础', ANSWER_50);
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已加入我的题库')).toBeVisible();

  // 加完即入队:队列页出现题量统计,头部入口仍在(非空态)
  await expect(page.getByText(/已学 0 \/ 1/)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: '手动加题' })).toBeVisible();
});

test('手动加题可进既有模块;校验失败拦截保存', async ({ page }) => {
  await page.goto('/#/my/browse');
  await page.getByRole('button', { name: '手动加题' }).click();
  await page.getByLabel('新模块名').fill('面试手写');
  await fillQuestionForm(page, '第一题?', '基础', ANSWER_50);
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已加入我的题库')).toBeVisible();
  await page.waitForTimeout(300);

  // 第二题:选既有模块(下拉里出现「01 · 面试手写」)
  await page.getByRole('button', { name: '手动加题' }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: '归属模块' }).click();
  await page.getByRole('option', { name: /01 · 面试手写/ }).click();

  // 答案过短 → 共享校验拦截,报错可见、对话框不关
  await fillQuestionForm(page, '第二题?', '基础', '太短');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/过短/)).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();

  // 补长重存:成功,同模块两题
  await page.getByRole('dialog').getByLabel('答案要点(一行一条,合计 ≥50 字)').fill(ANSWER_50);
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('第二题?')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/共 2 题/)).toBeVisible();
});
