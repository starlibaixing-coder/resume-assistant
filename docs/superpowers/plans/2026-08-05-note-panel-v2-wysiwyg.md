# 刷题站笔记功能 v2(WYSIWYG)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 v1 的 textarea+预览 笔记区,重写为 Tiptap WYSIWYG 编辑器(所见即所得、固定高度不可拖拽、去掉单独预览栏),存储格式从 markdown 改为 HTML。

**Architecture:** 引入 Tiptap(`@tiptap/react` + `@tiptap/starter-kit`),重写 `NotePanel.jsx`。用 `questionId` 作 React `key` 强制切题时重建 editor(避免 content/state 错位)。storage 升级 key 到 `quiz-notes-v2:` 以隔离不兼容的旧 markdown 数据。CardView/ModuleNav 接入点不变。

**Tech Stack:** React 18 + Tiptap 3.x(新依赖)。存储仍为 localStorage,内容从 markdown 字符串 → HTML 字符串。

**设计依据:** `docs/superpowers/specs/2026-08-05-note-panel-design.md` 的「修订 v2」章节。

**测试说明:** 项目无测试框架(沿用 v1 决策)。验证 = 生产构建通过 + 浏览器手测(主 agent 用 control-browser 执行)。

---

## 文件结构

修改:
- `quiz-app/package.json` — 新增 Tiptap 依赖
- `quiz-app/src/lib/storage.js` — key 升级到 v2(改 4 个函数的 key 字符串)
- `quiz-app/src/components/NotePanel.jsx` — 重写:textarea+预览 → Tiptap editor(核心改动)
- `quiz-app/src/index.css` — 去双栏布局,加 `.ProseMirror` 内容区样式,去 resize

不变:
- `quiz-app/src/components/CardView.jsx` — 仍是 `<NotePanel category={category} questionId={current.id} />`(已在分支里)
- `quiz-app/src/components/ModuleNav.jsx` — 仍是 `<NotePanel category={category} questionId={q.id} />`

---

## Task 1: 安装 Tiptap 依赖

**Files:**
- Modify: `quiz-app/package.json`(via `npm install`)

- [ ] **Step 1: 安装 Tiptap 核心包**

Run:
```bash
cd quiz-app && npm install @tiptap/react @tiptap/starter-kit
```

这两个包会自动带上 `@tiptap/core`、`@tiptap/pm`(ProseMirror)。StarterKit 包含:Paragraph, Bold, Italic, Strike, Code, Heading, BulletList, OrderedList, ListItem, Blockquote, CodeBlock, HardBreak, HorizontalRule, History(撤销/重做)——覆盖笔记场景全部需求。

Expected: 安装成功,`package.json` 的 dependencies 多出 `@tiptap/react`、`@tiptap/starter-kit`(及 node_modules 里的 `@tiptap/core`、`@tiptap/pm`)。

- [ ] **Step 2: 确认版本一致 + 构建无报错**

Run:
```bash
cd quiz-app && npm ls @tiptap/react @tiptap/starter-kit @tiptap/core @tiptap/pm 2>&1 | head -10
```
Expected: 所有 `@tiptap/*` 包主版本一致(都是 3.x),避免"multiple versions of extensions"问题。

Run:
```bash
cd quiz-app && npm run build
```
Expected: 构建成功(此时还没用 Tiptap,只是确认依赖装好不破坏构建)。bundle 会变大(Tiptap gzip 约 30-50KB),记下新体积作基线。

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add package.json package-lock.json
git commit -m "chore(quiz-app): 引入 Tiptap 依赖

@tiptap/react + @tiptap/starter-kit,用于笔记 WYSIWYG 编辑器。"
```

---

## Task 2: storage key 升级到 v2

**Files:**
- Modify: `quiz-app/src/lib/storage.js`(把 4 个函数里的 `quiz-notes:` 改成 `quiz-notes-v2:`)

旧数据是 markdown 字符串,与新 HTML 格式不兼容。升级 key 让旧数据自然废弃(不主动删,避免误伤)。

- [ ] **Step 1: 修改 4 个函数的 key 常量**

在 `quiz-app/src/lib/storage.js` 里,把笔记相关 4 个函数(`loadNotes`、`saveNote`、`getNote`、`clearNotes`)里的:
```javascript
const key = `quiz-notes:${category}`;
```
全部改为:
```javascript
const key = `quiz-notes-v2:${category}`;
```

共 3 处(`loadNotes`、`saveNote`、`clearNotes` 各一处;`getNote` 调用 `loadNotes` 不直接构造 key)。

同时更新那两行注释里的 key 说明:
```javascript
// key: quiz-notes-v2:{category} -> { "{id}": "HTML字符串" }
```

- [ ] **Step 2: 确认无其他地方硬编码旧 key**

Run:
```bash
cd quiz-app && grep -rn "quiz-notes:" src/
```
Expected: 无输出(所有引用都通过 storage.js 函数,且已改成 v2)。如果发现组件里硬编码了旧 key,改掉。

- [ ] **Step 3: 构建校验**

Run:
```bash
cd quiz-app && npm run build
```
Expected: 成功。

- [ ] **Step 4: Commit**

```bash
cd quiz-app && git add src/lib/storage.js
git commit -m "refactor(quiz-app): 笔记 storage key 升级到 v2

旧 markdown 数据与新 HTML 格式不兼容,升级 key quiz-notes-v2: 隔离。
函数签名不变,只改 key 常量。"
```

---

## Task 3: 重写 NotePanel 为 Tiptap WYSIWYG

**Files:**
- Modify: `quiz-app/src/components/NotePanel.jsx`(整体重写)

**核心设计决策**:
- 用 `questionId` 作外层 `key`,强制切题时整个 NotePanel 重建 → Tiptap editor 自动用新 content 初始化,无需手动 `setContent`(最干净,避开 Tiptap content 切换的坑)
- 保留 v1 的:收起态入口、500ms 防抖保存、切题 flush 残留输入、空笔记不写入
- 防抖保存改为:editor `onUpdate` 触发,把 `editor.getHTML()` 存到 ref + 防抖写 localStorage

- [ ] **Step 1: 整体重写 NotePanel.jsx**

把 `quiz-app/src/components/NotePanel.jsx` 整体替换为:

```jsx
import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getNote, saveNote } from '../lib/storage.js';

// 笔记区:Tiptap WYSIWYG 所见即所得 + 防抖自动保存
// 内层 NotePanelEditor 持有 editor;外层用 questionId 作 key 强制切题重建
export default function NotePanel({ category, questionId }) {
  // 用 questionId 作 key:切题时整体重建,editor 用新 content 初始化
  return <NotePanelEditor key={questionId} category={category} questionId={questionId} />;
}

function NotePanelEditor({ category, questionId }) {
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef(null);
  const latestRef = useRef('');
  const initialContent = useRef('');  // 挂载时读一次,作 editor content

  // 挂载时读已有笔记,决定展开/收起
  useEffect(() => {
    const existing = getNote(category, questionId);
    initialContent.current = existing;
    setExpanded(!!existing);
    latestRef.current = existing;

    // 卸载(切题)前 flush 残留输入
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (latestRef.current && latestRef.current !== initialContent.current) {
        saveNote(category, questionId, latestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent.current || '',
    // 空笔记时不立即渲染 editor(收起态),用 expanded 控制
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      latestRef.current = html;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveNote(category, questionId, html);
      }, 500);
    },
    editorProps: {
      attributes: {
        class: 'note-prose',
        'aria-label': '笔记编辑区',
      },
    },
  });

  // 空且未展开:收起态,显示入口按钮
  if (!expanded) {
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
        <span className="note-save-status">自动保存</span>
      </div>
      <EditorContent editor={editor} className="note-editor-wrap" />
    </div>
  );
}
```

关键点说明:
- **外层 `key={questionId}`**:切题时 React 卸载旧 NotePanelEditor、挂载新的,editor 用新 content 初始化,旧 editor 的 cleanup 触发 flush。这是处理 Tiptap content 切换最可靠的方式。
- **`initialContent` 用 ref**:挂载时读一次,传给 `useEditor` 的 `content`。避免 state 异步导致 editor 初始化为空。
- **去掉 `saved` 状态切换**:WYSIWYG 场景下"编辑中…/已保存 ✓"的实时状态意义减弱(用户在 editor 里直接看到内容),简化为静态"自动保存"提示。如后续需要,可加 onBlur 显示"已保存"。
- **`editorProps.attributes.class`**:给 ProseMirror 内容区加 `note-prose` class,用于 CSS 样式。
- **空内容判定**:`getNote` 返回 `''` → `expanded=false` → 收起态。

- [ ] **Step 2: 构建校验**

Run:
```bash
cd quiz-app && npm run build
```
Expected: 成功,无 Tiptap 相关报错。

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add src/components/NotePanel.jsx
git commit -m "feat(quiz-app): NotePanel 重写为 Tiptap WYSIWYG

所见即所得,去掉独立预览栏。用 questionId 作 key 切题重建,
500ms 防抖保存 HTML,卸载时 flush 残留输入。"
```

---

## Task 4: 调整样式(WYSIWYG 单栏 + ProseMirror)

**Files:**
- Modify: `quiz-app/src/index.css`(替换笔记区样式)

- [ ] **Step 1: 找到并替换笔记区样式段**

定位 `quiz-app/src/index.css` 末尾 v1 加的 `/* ===== 笔记区 NotePanel ===== */` 整段(从该注释到文件末尾,约 97 行)。

替换为:

```css

/* ===== 笔记区 NotePanel (v2 Tiptap WYSIWYG) ===== */
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

/* Tiptap 编辑器容器:固定高度,不可拖拽,占据全宽 */
.note-editor-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.note-editor-wrap:focus-within {
  border-color: var(--accent);
}
/* ProseMirror 内容区:固定高度 + 内部滚动 */
.note-editor-wrap .ProseMirror {
  min-height: 120px;
  max-height: 320px;
  overflow-y: auto;
  padding: 10px 12px;
  outline: none;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}
.note-editor-wrap .ProseMirror p {
  margin: 0 0 8px;
}
.note-editor-wrap .ProseMirror p:last-child {
  margin-bottom: 0;
}
.note-editor-wrap .ProseMirror strong {
  color: var(--text);
  font-weight: 600;
}
.note-editor-wrap .ProseMirror em {
  color: var(--text-dim);
}
.note-editor-wrap .ProseMirror code {
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
}
.note-editor-wrap .ProseMirror pre {
  background: var(--bg);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin: 8px 0;
  overflow-x: auto;
}
.note-editor-wrap .ProseMirror pre code {
  background: none;
  padding: 0;
  font-size: 12px;
  line-height: 1.5;
}
.note-editor-wrap .ProseMirror ul,
.note-editor-wrap .ProseMirror ol {
  padding-left: 22px;
  margin: 0 0 8px;
}
.note-editor-wrap .ProseMirror ul li,
.note-editor-wrap .ProseMirror ol li {
  margin-bottom: 4px;
}
.note-editor-wrap .ProseMirror blockquote {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--text-dim);
}
.note-editor-wrap .ProseMirror:empty::before {
  content: "用自己的话写答案…";
  color: var(--text-mute);
  pointer-events: none;
}
```

样式要点:
- **去掉 v1 的 `.note-editor`(flex 双栏)、`.note-textarea`、`.note-preview`、`.note-preview-empty`、`@media` 窄屏**(单栏不需要)
- **新增 `.note-editor-wrap`**:固定高度容器,max-height 320px 内部滚动,替代 textarea 的 resize
- **`.ProseMirror` 内容区样式**:复用 CSS 变量,与参考答案 `md-body` 视觉一致(加粗/代码/列表/引用)
- **`:empty::before` placeholder**:空内容时显示提示(替代 textarea placeholder)
- **`:focus-within`**:聚焦时边框变橙

- [ ] **Step 2: 构建校验**

Run:
```bash
cd quiz-app && npm run build
```
Expected: 成功,CSS 体积变化(应比 v1 双栏略小)。

- [ ] **Step 3: Commit**

```bash
cd quiz-app && git add src/index.css
git commit -m "style(quiz-app): 笔记区改 WYSIWYG 单栏样式

去双栏布局,新增 Tiptap ProseMirror 内容区样式。
固定高度 max 320px 内部滚动,不可拖拽 resize。"
```

---

## Task 5: 浏览器全流程验证

**Files:** 无修改,仅验证(主 agent 用 control-browser 执行)

- [ ] **Step 1: 启动 dev server**

Run: `cd quiz-app && npm run dev`
确认端口(5173 或回退端口)。

- [ ] **Step 2: 复习流验证(`#/<category>/quiz`)**

打开 `http://localhost:<port>/resume-assistant/#/agent/quiz`,验证:
1. 空笔记 → 显示"➕ 写笔记"入口(收起态)
2. 点入口 → 展开 Tiptap 编辑器(单栏,无右侧预览)
3. 输入文字,选中或用快捷键/语法 → **所见即所得**(加粗、斜体、代码、列表立即渲染)
4. 编辑器固定高度,内容多了内部滚动,**无右下角拖拽手柄**
5. 停顿 500ms → 笔记自动保存(localStorage 写入)
6. 点"我想好了,看答案" → 参考答案展开,笔记区仍在,内容保留
7. 点评分切题 → 新题笔记独立(空或该题已有笔记)
8. 刷新页面 → 笔记持久(HTML 内容原样恢复,格式保留)

- [ ] **Step 3: 浏览模式验证(`#/<category>/browse`)**

打开 `http://localhost:<port>/resume-assistant/#/agent/browse`:
1. 展开任一题 → 参考答案下方是 Tiptaw 笔记区
2. 写笔记 → 与复习流行为一致
3. **跨流程互通**:复习流写的笔记,浏览模式同题能看到(共享 `quiz-notes-v2:` key),反之亦然

- [ ] **Step 4: 数据格式确认**

DevTools → Application → Local Storage → `quiz-notes-v2:agent`:
- 值是 `{"agent.01.1": "<p>...</p>"}` 结构,**内容是 HTML**(`<p>`、`<strong>`、`<ul>` 等)
- 旧 `quiz-notes:agent` key 仍在(未删,自然废弃),新 key 是 v2

- [ ] **Step 5: 旧数据隔离确认**

确认旧 `quiz-notes:` 数据不会被读取(组件只读 v2)。如果浏览器里有旧 markdown 笔记,应表现为空(收起态),不会显示原始 markdown 源码。

全部通过 = v2 完成。记录验证结果,无需 commit(无代码改动)。

---

## Self-Review(计划自审)

**1. Spec 覆盖(对照 spec 修订 v2):**
- 去掉预览栏 → Task 3(单栏 EditorContent)+ Task 4(去 `.note-editor` flex)✅
- 固定高度不可拖拽 → Task 4(`.ProseMirror` max-height + overflow,无 resize)✅
- 真 WYSIWYG → Task 1(Tiptap)+ Task 3(useEditor/StarterKit)✅
- 引入 Tiptap → Task 1 ✅
- 存 HTML → Task 3(`editor.getHTML()`)+ Task 2(key v2 隔离旧 markdown)✅
- 旧数据清掉 → Task 2(升级 key,旧 markdown 自然废弃)✅
- 不变的部分(出现时机/存储位置/覆盖范围/隔离/接入点)→ 设计保持,CardView/ModuleNav 无改动 ✅

**2. Placeholder 扫描:** 无 TBD,代码完整,命令含预期输出。Tiptap API(useEditor/EditorContent/getHTML/onUpdate)经文档核实。✅

**3. 命名一致性:**
- CSS class:`note-panel`/`note-collapsed`/`note-entry-btn`/`note-header`/`note-label`/`note-save-status`(沿用 v1)+ `note-editor-wrap`/`.ProseMirror`(新)✅
- storage key:`quiz-notes-v2:${category}`(Task 2 定义,无其他硬编码)✅
- props:`category`/`questionId`(沿用 v1,接入点不变)✅

**4. 风险点:**
- Tiptap `useEditor` 首次渲染返回 null → EditorContent 接受 null editor(渲染空容器),收起态时不渲染 editor(条件分支在 EditorContent 之前 return),已规避 ✅
- `onUpdate` 闭包 staleness → v3 自动 re-bind;且用 ref 存值而非闭包变量,规避 ✅
- 切题 content 错位 → 外层 `key={questionId}` 强制重建,最可靠 ✅
