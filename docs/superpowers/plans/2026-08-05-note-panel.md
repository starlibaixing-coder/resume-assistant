# 刷题站笔记功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在刷题站的复习流和浏览模式中,为每道题新增一个 markdown 笔记区,让用户在看参考答案前先用自己的话写答案,笔记存本地 localStorage。

**Architecture:** 新增单一职责的 `NotePanel` 组件(输入+实时预览+防抖自动保存),复用现有 `renderMarkdown`/`marked`。localStorage 用独立 key `quiz-notes:{category}` 存,与 SM-2 进度数据隔离。CardView 和 ModuleNav 两处消费,各加一行。

**Tech Stack:** React 18 + Vite 5,marked 18(已装),localStorage。零新依赖。

**测试说明:** 本项目无测试框架(package.json 无 test 脚本,无 vitest/jest 依赖,src 下零测试文件)。遵循"跟随既有模式"原则,不擅自引入测试框架。验证手段:storage 函数逻辑自洽 + 浏览器手动验证清单 + 构建校验通过。

**设计依据:** `docs/superpowers/specs/2026-08-05-note-panel-design.md`

---

## 文件结构

新增:
- `quiz-app/src/components/NotePanel.jsx` — 笔记组件(props: `category`, `questionId`;自管编辑/预览/保存)

修改:
- `quiz-app/src/lib/storage.js` — 新增 4 个 notes 函数(append 到文件末尾,不动现有代码)
- `quiz-app/src/components/CardView.jsx` — 在 `q-focus` 后、`revealed` 分支前加一行 `<NotePanel>`(约 88 行处)
- `quiz-app/src/components/ModuleNav.jsx` — 在 AnswerPanel 后加一行 `<NotePanel>`(149 行处)
- `quiz-app/src/index.css` — append 笔记相关样式

---

## Task 1: storage.js 新增 notes 存取函数

**Files:**
- Modify: `quiz-app/src/lib/storage.js`(append 到文件末尾)

这是地基,后续组件依赖它。纯函数,逻辑自洽可直接审查。

- [ ] **Step 1: 在 storage.js 末尾追加 notes 存取函数**

在 `quiz-app/src/lib/storage.js` 文件**末尾**(第 30 行 `clearProgress` 函数闭合后)追加:

```javascript

// ===== 笔记存储 =====
// key: quiz-notes:{category} -> { "{id}": "markdown字符串" }
// 与 SM-2 进度数据隔离,清进度不影响笔记

export function loadNotes(category) {
  const key = `quiz-notes:${category}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

export function saveNote(category, id, markdown) {
  const key = `quiz-notes:${category}`;
  try {
    const all = loadNotes(category);
    if (markdown && markdown.trim()) {
      all[id] = markdown;
    } else {
      delete all[id]; // 空内容不留 key
    }
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // 隐私模式/配额满,静默降级
  }
}

export function getNote(category, id) {
  return loadNotes(category)[id] || '';
}

export function clearNotes(category) {
  const key = `quiz-notes:${category}`;
  try {
    localStorage.removeItem(key);
  } catch {
    // 静默
  }
}
```

注意:
- `saveNote` 空内容时 `delete all[id]`,避免存一堆空字符串(与 spec §4 "空笔记不写入"一致)
- try/catch 包裹写操作,与现有 `loadProgress` 的容错风格一致
- 4 个函数与现有 `loadProgress/saveCard/getCard/clearProgress` 一一对应,风格对称

- [ ] **Step 2: 启动 dev server 确认无语法错误**

Run: `cd quiz-app && npm run dev`
Expected: Vite 正常启动(若 storage.js 有语法错误,Vite 热更新会报红)。确认浏览器 console 无报错。

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add src/lib/storage.js
git commit -m "feat(quiz-app): storage 新增笔记存取函数

独立 key quiz-notes:{category} 存 markdown 笔记,与 SM-2 进度隔离。
4 个函数与现有 progress 系列对称,空内容不写入。"
```

---

## Task 2: 创建 NotePanel 组件

**Files:**
- Create: `quiz-app/src/components/NotePanel.jsx`

单一职责组件:props 只要 `category` + `questionId`,自管编辑/预览/保存状态。

- [ ] **Step 1: 创建 NotePanel.jsx**

创建 `quiz-app/src/components/NotePanel.jsx`:

```jsx
import { useState, useEffect, useRef } from 'react';
import { getNote, saveNote } from '../lib/storage.js';
import { renderMarkdown } from '../lib/markdown.js';

// 笔记区:输入 markdown + 实时预览 + 防抖自动保存
// props: category, questionId
// 内部自洽,切题时自动加载对应笔记并保存残留输入
export default function NotePanel({ category, questionId }) {
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(true);
  const debounceRef = useRef(null);
  const latestRef = useRef('');

  // 切题时:加载笔记,决定展开/收起
  useEffect(() => {
    const existing = getNote(category, questionId);
    setText(existing);
    setExpanded(!!existing);
    setSaved(true);
    latestRef.current = existing;

    // 清理函数:切题/卸载前 flush 残留输入,不丢字
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current !== existing) {
        saveNote(category, questionId, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, questionId]);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    latestRef.current = val;
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNote(category, questionId, val);
      setSaved(true);
    }, 500);
  };

  // 空且未展开:收起态,显示入口按钮
  if (!expanded && !text) {
    return (
      <div className="note-panel note-collapsed">
        <button className="note-entry-btn" onClick={() => setExpanded(true)}>
          ➕ 写笔记
        </button>
      </div>
    );
  }

  return (
    <div className="note-panel">
      <div className="note-header">
        <span className="note-label">📝 我的笔记</span>
        <span className={`note-save-status${saved ? ' saved' : ''}`}>
          {saved ? '已保存 ✓' : '编辑中…'}
        </span>
      </div>
      <div className="note-editor">
        <textarea
          className="note-textarea"
          value={text}
          onChange={handleChange}
          placeholder="用自己的话写答案,支持 markdown (**加粗** `代码` 列表等)"
          rows={6}
        />
        <div className="note-preview md-body">
          {text.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
          ) : (
            <span className="note-preview-empty">预览区(在左边写下你的答案)</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

关键点:
- `latestRef` 持有最新值,useEffect 清理函数在切题/卸载时立即 flush,防止防抖未触发丢字
- `expanded` 状态由是否已有笔记决定(有笔记自动展开,空笔记收起为入口)
- 预览区复用 `md-body` class,与参考答案样式一致
- `renderMarkdown` 已有缓存,但缓存 key 是全文本;笔记频繁输入会产生大量缓存条目——可接受,单用户本地编辑,内存增长有限。若担心,Task 4 验证后如发现性能问题再优化(非本计划范围)。

- [ ] **Step 2: 启动 dev server,确认模块加载无错**

Run: `cd quiz-app && npm run dev`
Expected: Vite 正常启动。此时 NotePanel 还未被引用,但创建文件后 Vite 应无报错。浏览器 console 干净。

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add src/components/NotePanel.jsx
git commit -m "feat(quiz-app): 新增 NotePanel 笔记组件

输入 markdown + 实时预览 + 500ms 防抖自动保存。
空笔记收起为入口按钮,切题时 flush 残留输入不丢字。
props 极简(category + questionId),内部自洽。"
```

---

## Task 3: CardView 接入 NotePanel(复习流)

**Files:**
- Modify: `quiz-app/src/components/CardView.jsx`(第 6 行加 import,第 87 行后加一行)

笔记区放在 `revealed` 分支外,无条件渲染(始终可见)。

- [ ] **Step 1: 在 CardView.jsx 第 6 行后加 import**

`quiz-app/src/components/CardView.jsx` 现有第 6 行是:
```jsx
import AnswerPanel from './AnswerPanel.jsx';
```

在其后加一行:
```jsx
import NotePanel from './NotePanel.jsx';
```

- [ ] **Step 2: 在 q-focus 之后、revealed 分支之前插入 NotePanel**

现有第 86-88 行:
```jsx
        <div className="q-title">{current.title}</div>
        <div className="q-focus">{current.focus}</div>

        {!revealed ? (
```

改为:
```jsx
        <div className="q-title">{current.title}</div>
        <div className="q-focus">{current.focus}</div>

        <NotePanel category={category} questionId={current.id} />

        {!revealed ? (
```

只加一行 `<NotePanel>`,位置在 focus 和 answer-locked 之间,确保看答案前就能写、展开答案后笔记仍可见。

- [ ] **Step 3: 浏览器手测复习流**

Run: `cd quiz-app && npm run dev`,打开 `http://localhost:5173/resume-assistant/#/agent`

验证清单:
1. 进入任一分类复习流 → 题目下方出现"➕ 写笔记"入口(空笔记收起态)
2. 点入口 → 展开双栏编辑器(左输入右预览)
3. 输入 `**测试加粗**` → 右侧预览实时渲染为加粗
4. 输入后停顿 500ms → 显示"已保存 ✓"
5. 点"我想好了,看答案" → 参考答案展开,**笔记区仍在,内容保留**
6. 点评分切题 → 新题目笔记区是空的(或显示该题已有笔记)
7. 返回上一题(刷新或重新进入复习)→ 之前写的笔记还在
8. DevTools → Application → Local Storage → 看到 `quiz-notes:agent` key,值是 `{"agent.01.x": "..."}` 结构

全部通过才算 OK。

- [ ] **Step 4: Commit**

```bash
cd quiz-app && git add src/components/CardView.jsx
git commit -m "feat(quiz-app): 复习流接入 NotePanel

在题目下方、答案按钮前插入笔记区,始终可见。
看答案前可写,展开后保留对照。"
```

---

## Task 4: ModuleNav 接入 NotePanel(浏览模式)

**Files:**
- Modify: `quiz-app/src/components/ModuleNav.jsx`(第 4 行加 import,第 149 行后加一行)

- [ ] **Step 1: 在 ModuleNav.jsx 第 4 行后加 import**

现有第 4 行:
```jsx
import AnswerPanel from './AnswerPanel.jsx';
```

在其后加:
```jsx
import NotePanel from './NotePanel.jsx';
```

- [ ] **Step 2: 在 AnswerPanel 之后插入 NotePanel**

现有第 149 行(展开答案块内):
```jsx
                          <AnswerPanel answer={q.answer} followups={q.followups} />
```

改为:
```jsx
                          <AnswerPanel answer={q.answer} followups={q.followups} />
                          <NotePanel category={category} questionId={q.id} />
```

注意:ModuleNav 里 `category` 是组件 prop(第 13 行 `export default function ModuleNav({ category })`),`q.id` 是当前题 id,直接可用。

- [ ] **Step 3: 浏览器手测浏览模式**

Run: dev server 已启动,打开 `http://localhost:5173/resume-assistant/#/agent/browse`

验证清单:
1. 展开任一题 → focus 下方先是参考答案,再是笔记区
2. 笔记区与复习流行为一致(输入/预览/保存/刷新保留)
3. **同一题在复习流写的笔记,浏览模式能看到**(共享同一 localStorage key)
4. 反向也成立:浏览模式写的笔记,进复习流能看到
5. 同时展开多题(理论上 UI 每次只展开一题,`expandedId === q.id`),各题笔记独立

全部通过才算 OK。

- [ ] **Step 4: Commit**

```bash
cd quiz-app && git add src/components/ModuleNav.jsx
git commit -m "feat(quiz-app): 浏览模式接入 NotePanel

每题展开后显示笔记区,与复习流共享 localStorage 数据。"
```

---

## Task 5: 笔记区样式

**Files:**
- Modify: `quiz-app/src/index.css`(append 到文件末尾,第 600 行后)

- [ ] **Step 1: 在 index.css 末尾追加笔记样式**

在 `quiz-app/src/index.css` 文件**末尾**追加:

```css

/* ===== 笔记区 NotePanel ===== */
.note-panel {
  margin-top: 16px;
  padding: 14px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.note-collapsed {
  padding: 0;
  background: transparent;
  border: none;
}
.note-entry-btn {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-mute);
  font-family: var(--font-sans);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.note-entry-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.note-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-mute);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.note-save-status {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-mute);
}
.note-save-status.saved {
  color: var(--good);
}
.note-editor {
  display: flex;
  gap: 12px;
}
.note-textarea {
  flex: 1;
  min-height: 120px;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.note-textarea:focus {
  border-color: var(--accent);
}
.note-textarea::placeholder {
  color: var(--text-mute);
}
.note-preview {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.7;
  overflow-wrap: break-word;
}
.note-preview-empty {
  color: var(--text-mute);
  font-size: 12px;
}

/* 窄屏:编辑器和预览上下排列 */
@media (max-width: 640px) {
  .note-editor {
    flex-direction: column;
  }
}
```

样式要点:
- 全部复用现有 CSS 变量(`--bg-elev`/`--border`/`--accent`/`--good` 等),深色主题一致
- 收起态用虚线边框 ghost 按钮,与展开态视觉区分
- textarea 用 `--font-mono`(写 markdown 代码对齐舒服),预览用 `md-body` 继承正文字体
- `@media max-width: 640px` 改上下排列,移动端友好

- [ ] **Step 2: 浏览器确认样式**

Run: dev server 已启动,刷新页面

验证清单:
1. 收起态:"➕ 写笔记"是虚线边框 ghost 按钮,hover 变橙色边框
2. 展开态:双栏布局,左 textarea 右预览,gap 12px
3. textarea 聚焦时边框变橙色
4. "已保存 ✓"是绿色(--good),"编辑中…"是灰色(--text-mute)
5. 窄化浏览器宽度 < 640px → 编辑器和预览变上下排列
6. 笔记区背景/边框/圆角与卡片视觉协调

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add src/index.css
git commit -m "style(quiz-app): 笔记区样式

复用 CSS 变量,深色主题一致。左右分栏,窄屏上下。
收起态 ghost 按钮,展开态双栏编辑+预览。"
```

---

## Task 6: 最终构建校验与全流程验证

**Files:** 无修改,仅校验

- [ ] **Step 1: 跑题库构建校验(确认没碰坏数据管线)**

Run: `cd quiz-app && npm run build:bank`
Expected: 构建成功,输出 `public/questions.json` 已是最新。本功能不涉及 YAML/questions.json,此步应无变化通过。

- [ ] **Step 2: 跑生产构建(确认无编译错误)**

Run: `cd quiz-app && npm run build`
Expected: `vite build` 成功,无报错,输出 `dist/`。

- [ ] **Step 3: 全流程端到端手测**

Run: `cd quiz-app && npm run dev`,完整走一遍:

**复习流**(`#/agent`):
1. 进题 → "➕ 写笔记"入口
2. 展开 → 写 markdown → 预览实时 → 自动保存
3. 看答案 → 笔记保留
4. 评分切题 → 笔记保存到新题位
5. 刷新 → 笔记持久
6. localStorage 有 `quiz-notes:agent`,**没有**误存到 `quiz-progress:agent`

**浏览模式**(`#/agent/browse`):
7. 展开题 → 笔记区在答案下方
8. 与复习流数据互通(同题笔记一致)

**边界**:
9. 清空 textarea → 不留空 key(localStorage 里该 id 被删除)
10. 窄屏 → 上下布局
11. DevTools 清 localStorage → 笔记清空,刷题主流程仍正常

全部通过 = 功能完成。

- [ ] **Step 4: 最终 Commit(如有零散改动)**

```bash
cd quiz-app
git status  # 若有未提交改动则提交,无则跳过
```

---

## Self-Review(计划自审)

**1. Spec 覆盖:**
- §1 布局/始终可见/自动保存/空笔记收起 → Task 2(组件逻辑)+ Task 3(位置)+ Task 5(样式)✅
- §2 独立 key + 4 个 storage 函数 + 存 markdown 原文 + 空内容不写入 → Task 1 ✅
- §3 NotePanel 单一职责 + props 极简 + CardView 分支外渲染 + ModuleNav 并列 → Task 2/3/4 ✅
- §4 防抖 500ms + 切题 flush + 空笔记不写入 + localStorage try/catch + XSS(复用 renderMarkdown) → Task 1(saveNote 容错)+ Task 2(debounce + latestRef flush)✅
- "不做的事"(YAGNI)→ 计划未引入任何超出范围的功能 ✅

**2. Placeholder 扫描:** 无 TBD/TODO,所有代码块完整,命令含预期输出。✅

**3. 类型/命名一致性:**
- storage 函数:`loadNotes`/`saveNote`/`getNote`/`clearNotes` — Task 1 定义,Task 2 NotePanel 用 `getNote`/`saveNote`,一致 ✅
- NotePanel props:`category`/`questionId` — Task 2 定义,Task 3 `<NotePanel category={category} questionId={current.id} />`,Task 4 `<NotePanel category={category} questionId={q.id} />`,一致 ✅
- CSS class:`.note-panel`/`.note-collapsed`/`.note-entry-btn`/`.note-header`/`.note-label`/`.note-save-status`/`.note-editor`/`.note-textarea`/`.note-preview` — Task 2 组件用,Task 5 定义,逐一对应 ✅
- localStorage key:`quiz-notes:${category}` — Task 1 定义,无其他地方硬编码 ✅
