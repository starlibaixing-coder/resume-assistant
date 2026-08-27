# 刷题代码草稿纸(JS 可运行)+ 手动加题 Implementation Plan

> **状态:✅ 已完工**(2026-08-26)。验证:196 单测 + 15 e2e(新增 4)+ typecheck/build 全绿;UI 三张截图目检通过(浅/暗 + 创建对话框);真 SQLite 持久化(migration 005)留 `npm run tauri dev` / `npm run smoke` 真机验证。
>
> **施工中新增的关键修正(供后人):**
> - **CodeMirror closeBrackets 必须关**:括号自动补全 + 回车拆行会与用户手输的闭括号叠加成语法错误(e2e 已固化真人花括号输入回归);主题全走 CSS 变量,`.dark` 自动跟随。
> - **表单 label 必须 htmlFor 关联**:既是对话框 a11y 要求,也是测试钩子(裸 label 兄弟节点选择器匹配不到)。
> - **输出区用 role="log"**:裸 `[aria-live]` 选择器会撞 CodeMirror 的 cm-announced 和 sonner 通知区。

**Goal:** 两个独立小功能,一次分支交付:
1. **代码草稿纸**:刷题卡片内可折叠代码区,代码按题保存(CodeMirror 6),JS 可在 Web Worker 沙箱运行(console 捕获 + 超时杀)。
2. **手动加题**:浏览页「我的题库」直接手写新题入库,直接 `approved`(人写即人审)。

**方案确认记录(用户三选三):** 题内草稿纸(非新题型)/ 仅 JS 运行(非系统运行时)/ 直接进正式库(非草稿区)。

---

## 本阶段新增决策

### D1 草稿纸形态 = 刷题卡片内可折叠面板(用户确认)

题内私有数据,按 (category, questionId) 保存,与笔记同级;**不改题库数据模型**(题仍是 qa 型,题目数据无代码字段)。放在「看答案」之前的工作区位置——写代码属于思考过程。

### D2 运行 = Web Worker 沙箱,仅 JS

- 每次运行新起 Worker(无状态残留),主线程超时(默认 3s)terminate + 报超时。
- worker 内劫持 console 捕获输出;同步执行完即回结果,但 worker 存活到超时窗,期间异步回调的 console 输出继续转发(`setTimeout`/Promise 题是 FE 面试核心,不能丢异步输出)。
- 纯 web 层,e2e(chromium)可真跑 Worker;不涉及 Tauri 权限。
- 系统运行时(node/python)明确不做(用户选"仅 JS"),将来要 Python 再立项。

### D3 编辑器 = CodeMirror 6(@uiw/react-codemirror)

- 主题用 `EditorView.theme` + `HighlightStyle` **直接引用仓库 CSS 变量**(`var(--popover)` 等),`.dark` 切换自动跟随,不引入魔法色值(Monaco 被否:重 + 自带主题体系对不齐 token)。
- 依赖装 desktop workspace:`npm install @uiw/react-codemirror @codemirror/lang-javascript -w desktop`。

### D4 草稿纸折叠交互沿用 note-panel 模式(仓库约定优先)

skill 建议 shadcn Collapsible/Accordion,但仓库同类面板(笔记区)是「状态 + 条件渲染」的收起/展开模式,两面板在刷题卡内必须行为一致——按 AGENTS.md「skill 结论与仓库现有约定冲突时以仓库约定为准」,沿用 note-panel 模式。图标用 Lucide(不用 emoji,新代码执行现行规则)。

### D5 手动加题直接 approved(用户确认)

ADR-10 草稿闸约束的是 *AI 产物*;人手写的题即已完成人工审核,与 `copyOfficial` 同待遇直接 `approved`,立即可刷题/进 SM-2。校验照跑共享 `validateQuestion`(题干非空、答案 ≥50 字等)。

### D6 手动加题入口 = 浏览页头部 + 空态

- 「我的题库」浏览页头部:「手动加题」(Plus icon)与「＋ AI 生题」并列。
- 空态(库里一题没有、`cat` 不存在时)也要能进——否则首题永远只能靠 AI 生题。
- 模块归属:现有模块下拉选择,或「新建模块」填名;id 走 `allocateIds` 进所选模块。

### D7 存储与级联

- 新表 `code_drafts(id, category, content, updated_at)`,migration 005,`CREATE TABLE IF NOT EXISTS` 保持幂等(冒烟模式全量迁移覆盖)。
- 数据层进 `storage.ts`(与 notes 完全同模式:内存缓存 + 同步读 + fire-and-forget 持久化)。
- 级联清理三处:`mylib.deleteQuestion`(删我的题)、`officialbank` 远端下架(官方题 id 作废)都要连带删 `code_drafts`,与 notes 同待遇。

---

## Task 1: 数据层(migration 005 + storage + mylib + 级联)

- `005_code_drafts.sql` + lib.rs 注册(version 5)+ Rust 测试表清单加 `code_drafts`
- `storage.ts`:`getCodeDraft` / `saveCodeDraft`(空串删行,同 notes)+ initStorage 加载 + 测试钩子
- `mylib.ts`:`addManualQuestion(draft, { moduleId? , moduleName })`(existing 模块 or 新模块;approved;无 sourceId)+ `deleteQuestion` 级联加 `code_drafts`
- `officialbank.ts`:远端下架级联加 `code_drafts`
- 单测:storage 往返/空删行/init 加载;mylib 新模块分配/进既有模块/校验拒绝/直接 approved/删除级联

## Task 2: JS 运行器(纯逻辑,e2e 覆盖真 Worker)

- `src/lib/js-runner.ts`:`serializeArg`(纯函数:循环引用/函数/Error/对象降级)+ `runJs(code, { timeoutMs, workerFactory?, onAsyncLog? })`(可注入 Worker 工厂,单测假 Worker)
- `src/workers/js-runner.worker.ts`:console 劫持 → 同步执行 → postMessage 结果 → 存活期内继续转发异步日志
- 单测:serializeArg 各类型;runJs 正常/抛错/超时 terminate/异步日志转发/工厂可注入

## Task 3: 草稿纸 UI

- 装 CodeMirror 依赖(`-w desktop`)
- `src/components/code-scratchpad.tsx`:收起入口(Lucide Code icon)→ 展开面板(编辑器 + 运行按钮 + 输出区);切题 flush 防抖保存、载入新题代码、清输出(沿 note-panel 模式)
- 主题:CSS 变量版 `EditorView.theme` + `HighlightStyle`(token:foreground/muted-foreground/primary/success/warning/destructive)
- `quiz.tsx` 卡内在 NotePanel 下接入

## Task 4: 手动加题 UI

- `question-edit-dialog.tsx`:抽共享表单字段组件;新增 `QuestionCreateDialog`(表单 + 模块 Select[现有模块/新建] + 新模块名 Input)
- `browse.tsx`:头部「手动加题」按钮(isMy);空态(isMy)加入口;接线 toast
- 校验失败显示沿用编辑对话框的错误区

## Task 5: e2e + 全量验证 + 文档

- e2e 新 spec:草稿纸(写代码→运行→见输出→切题→回来还在);手动加题(空态入口→填表→保存→列表出现)
- `npm run test:run` / `typecheck` / `build` / `npx playwright test` 全绿 + 截图目检
- AGENTS.md 桌面端原则补两行(草稿纸/手动加题约定);本 plan 状态收尾

---

## 硬约束对账

| 约束 | 落点 |
|---|---|
| ADR-3 官方库只读 | 手动加题只进「我的库」;浏览页空态入口仅 isMy |
| ADR-9 id 跨库唯一 | `addManualQuestion` 走 `allocateIds`(my slug 空间) |
| ADR-10 AI 产物必经草稿区 | 手动加题非 AI 产物,直接 approved(用户确认,见 D5) |
| token 体系内工作 | CodeMirror 主题全走 CSS 变量,无魔法值 |
| UI 照 shadcn/仓库惯例 | 表单组件复用 Input/Textarea/Select/Button;折叠模式沿 note-panel(D4) |
| 完成标准 | 单测 + typecheck + build + e2e 全绿;e2e 是 web 层,真 SQLite 留 tauri dev/smoke |
