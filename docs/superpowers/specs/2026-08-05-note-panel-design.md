# 刷题站笔记功能设计

- **日期**:2026-08-05
- **范围**:`quiz-app/` 刷题站,复习流(CardView)和浏览模式(ModuleNav)两处
- **目标**:让用户在看参考答案之前,能用自己的话写下答案(markdown 格式),强化"强制思考"

## 背景与动机

刷题站现有交互核心是"强制思考":题目下方有个"我想好了,看答案"按钮,点了才展开参考答案。但用户脑子里想的内容无处记录,看完参考答案就过去了,缺乏主动输出环节。

加一个笔记区,让用户在看答案前先用自己的话写,能显著提升记忆效果(主动回忆 > 被动阅读)。笔记在看参考答案后仍保留可见,方便对照补充。

## 需求(已与用户确认)

1. **出现时机**:看参考答案之前就能写(与强制思考流程契合)
2. **富文本程度**:纯 markdown 输入,复用现有 `marked`,零新依赖
3. **存储**:只存本地 localStorage,无后端,不跨设备
4. **覆盖范围**:CardView(复习流)和 ModuleNav(浏览模式)两处都要

## 设计

### 布局与交互(§1)

在现有卡片流的题目下方、参考答案之上,插入笔记区:

```
┌─────────────────────────────────────┐
│ [tag] 难度  [tag] 标签               │
│ 题目标题                              │
│ focus 提示                            │
├─────────────────────────────────────┤
│ 📝 我的笔记                          │  ← 新增,始终可见
│ ┌─────────────┬─────────────┐       │
│ │ textarea     │ markdown 预览 │       │  左右分栏(窄屏上下)
│ │ 输入 markdown │ 实时渲染      │       │
│ └─────────────┴─────────────┘       │
│              [自动保存 ✓]            │
├─────────────────────────────────────┤
│ [我想好了，看答案] ← 现有按钮         │  笔记保留,不消失
├─────────────────────────────────────┤
│ 参考答案要点(展开后)                  │
│ 追问方向                              │
│ [不会] [模糊] [掌握]                  │
└─────────────────────────────────────┘
```

交互规则:

- 笔记区**始终可见**(展开参考答案后不消失,方便对照)
- **自动保存**:输入时防抖 500ms 写入 localStorage,显示"已保存 ✓"指示
- **空笔记收起**:内容为空时收起为"➕ 写笔记"小入口,点击展开,减少视觉干扰
- **预览实时**:textarea 输入即渲染到右侧预览面板

### 数据存储与隔离(§2)

复用现有 localStorage 模式,新增独立 key,不污染 SM-2 进度数据:

```
现有: quiz-progress:{category}      → { "{id}": sm2CardState }   // 不动
新增: quiz-notes:{category}         → { "{id}": "markdown字符串" } // 纯文本值
```

设计要点:

- **独立 key 隔离**:笔记和复习进度是两件事,分两个 key。清进度不会误删笔记,反之亦然
- **按题 id 作 key**:id 三段式全局唯一(`agent.01.1`),跨分类天然隔离
- **存原始 markdown 字符串**:不存 HTML。① 安全(无 XSS,渲染时走 `renderMarkdown`);② 数据可移植
- **容量**:localStorage ~5MB,纯文本笔记假设单题 1KB、全题库 ~280 题全填满约 280KB,远低于上限,无需特殊处理

`src/lib/storage.js` 新增 4 个函数(与现有 `loadProgress/saveCard/getCard/clearProgress` 风格对称):

- `loadNotes(category)` → `{ [id]: string }` 全量读取
- `saveNote(category, id, markdown)` → 写单条
- `getNote(category, id)` → 读单条(组件初始化用)
- `clearNotes(category)` → 清空(对称 `clearProgress`)

### 组件结构(§3)

```
src/components/
├── CardView.jsx          # 复习流,引入 NotePanel
├── ModuleNav.jsx         # 浏览模式,引入 NotePanel
└── NotePanel.jsx         # 新增:笔记输入+预览+自动保存
```

**`NotePanel` 组件契约**(单一职责,接口极简):

```jsx
// 输入:只需 category + questionId
<NotePanel category={category} questionId={current.id} />

// 内部自洽:自己管 textarea 值、预览、保存状态
// 切题时 questionId 变,useEffect 重新加载对应笔记
```

**CardView.jsx 改动**:笔记区放在 `revealed` 分支外,**无条件渲染一次**(它本来就要始终可见):

```jsx
<div className="q-focus">{current.focus}</div>

<NotePanel category={category} questionId={current.id} />  {/* 始终在,一行搞定 */}

{!revealed ? (
  <div className="answer-locked">...</div>
) : (
  <AnswerPanel ... />
)}
```

**ModuleNav.jsx 改动**:在每题展开答案处加一行 `<NotePanel>`,与 `<AnswerPanel>` 并列。

### 边界与样式(§4)

**边界处理**:

- **防抖保存**:输入 debounce 500ms 写入;组件卸载或切题时立即 flush 残留输入(useRef 持有最新值 + 卸载 effect 里 save)
- **切题未保存**:用户正在打字时点评分切题,useEffect 清理函数立即保存当前内容,不丢字
- **空笔记**:trim 后为空不写入(避免存一堆空 key);展示态收起为"➕ 写笔记"小入口
- **localStorage 异常**:隐私模式/配额满会抛错,try/catch 静默降级(与现有 `loadProgress` 一致),不影响刷题主流程
- **XSS**:用户笔记内容经 `renderMarkdown` 渲染到自己的本地页面,风险可控;复用现有 `md-body` 样式隔离

**样式**(复用现有 CSS 变量,深色主题一致):

- 笔记区:`--bg-elev` 背景、`--border` 边框、`--radius` 圆角
- textarea:`--bg-card`、文字 `--text`、placeholder `--text-mute`
- 左右分栏:`display: flex; gap: 12px`,窄屏(`@media max-width: 640px`)改上下
- 保存指示:`--good` 色 + `--font-mono` 字体的小字"已保存 ✓"
- 收起态入口:ghost 风格按钮,hover 时 `--accent` 边框

## 不做的事(YAGNI)

- **不做工具栏**:已确认纯 markdown 输入,不加 B/I/代码 等工具栏按钮
- **不做云同步/账号**:只存本地,保持纯前端无后端架构
- **不做笔记导出**:首版不做,后续如需可在设置页加 dump 功能
- **不做所见即所得**:不引入 TipTap/Lexical 等重库

## 涉及文件清单

新增:
- `quiz-app/src/components/NotePanel.jsx` — 笔记组件
- `quiz-app/src/index.css` 追加笔记相关样式

修改:
- `quiz-app/src/lib/storage.js` — 新增 4 个 notes 函数
- `quiz-app/src/components/CardView.jsx` — 加一行 `<NotePanel>`(revealed 分支外)
- `quiz-app/src/components/ModuleNav.jsx` — 在答案处加一行 `<NotePanel>`

## 验证方式

1. `npm run build:bank` 通过(不涉及 questions.json,应无影响)
2. `npm run dev` 启动,手测:
   - 复习流:看答案前能写、展开后笔记保留、切题自动保存、刷新笔记还在
   - 浏览模式:每题都能写笔记
   - 空笔记收起、有内容展开
   - 窄屏布局正常
3. localStorage 检查:`quiz-notes:{category}` key 存在,值结构正确
