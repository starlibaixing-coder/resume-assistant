# UX 审计修复施工(批次 1 / 2 / 5)

> **依据**:`docs/superpowers/specs/2026-08-28-desktop-ux-ui-audit.md`(2026-08-28 审计)
> **范围**:审计 §5 排期中的批次 1(刷题工作台 B1–B8)、批次 2(生题合一 A4/A5 + E2)、批次 5(反馈 C + 一致性 D + 视觉 E1/E3–E7)。
> **不在本轮**:批次 3(求职中枢一期 A1/A2——已产出带选项提案 `specs/2026-08-28-job-hub-phase1-proposal.md`,待确认后立项);批次 4(A3 简历优化/JD 匹配,阶段 3 范畴)。

## 完成状态(2026-08-31)

| 批次 | 分支 | 内容 | 状态 |
|---|---|---|---|
| 1 | `feat/quiz-workbench` | B1 宽度分级(非沉浸 3xl/沉浸 4xl/代码弹窗 5xl)、B2 键盘流(空格/回车翻答案,1/2/3 评分,kbd 提示,输入/编辑器/弹窗三重守卫)、B3 操作条 sticky 吸底、B4 跳过 + 撤销评分(storage 新增 `deleteCard`)、B5 代码草稿纸大弹窗(题上码下)、B6 笔记右侧抽屉(`ui/sheet.tsx`)、B7 Esc 层级(弹窗 > 沉浸)+ 进度条、B8 终态统一(全部刷完也给"再过一遍",forceAll 全量入队) | ✅ 已合入 main |
| 2 | `feat/generate-page-merge` | A4 生题页顶层 Tabs(AI/手动,`ui/tabs.tsx` + radix tabs;`?mode=manual` 深链;手动改页面级表单,保存后保留模块选择)、A5 四处手动加题入口收敛深链 + "＋ AI 生题"三种构成统一为「去生题」(Sparkles)、E2 图标清扫(✓/✗/▼/▶ → lucide;可展开行 button 化 + aria-expanded) | ✅ 已合入 main |
| 5 | `feat/feedback-consistency-visual` | C1 草稿审核 busy+toast / 编辑删除题 toast / LLM 保存 saving+toast、C2 拒绝确认弹窗、C3 useQuestions.retry + 四页失败重试、C4 `ui/skeleton.tsx` + 首页骨架/错误分支、C5 生题取消(AbortSignal)+ 计时 + 锁表单、D 回车提交/错误就近/保留旧结果/content-visibility/空态清除筛选/首页空卡常显按钮/再过一遍只跳有题分类/profile beforeunload、E1 font-mono 修栈 + 中文 mono 清扫、E3 术语出文案、E4 角标窄窗可见、E5 0% 轨道轮廓、E6 卡中卡改 divide-y | ✅ 已合入 main |

## 实施中的关键决策与发现

- **Esc 层级的实现**(B7):radix DismissableLayer 的 Esc 监听在 **document 捕获阶段**且关闭时会 `preventDefault()`。沉浸退出的守卫因此做成双保险:`e.defaultPrevented`(radix 先跑时)或 DOM 查 `[role="dialog"][data-state="open"]`(自方先跑时),与监听顺序无关。CodeMirror 内 Esc 归补全:草稿纸弹窗 `onEscapeKeyDown` 在焦点位于 `.cm-editor` 时阻止关闭。
- **键盘流的时序坑**(B2):effect 重订阅是 passive 的,空格翻开后紧邻的数字键可能落在旧闭包(revealed 仍 false)——`revealedRef`(latest-ref)读最新值修复。
- **@uiw/react-codemirror 白底回归**(B5 顺带修复):其 `theme` prop 默认 `'light'`,内置浅色主题盖掉 token 主题的 `var(--popover)` 背景;传 `theme="none"` 关闭内置主题。这其实是存量问题(旧内嵌版同病),搬进弹窗后截图才暴露。
- **tabs 安装引发的类型雪崩**(批次 2):`@radix-ui/react-tabs` 安装把 radix 共享包从 `desktop/node_modules` 提升到根,而根缺 `@types/react` → 110 个 radix 组件类型错误。修复:根工作区补装 `@types/react` + 清 `desktop/node_modules/.vite` 预构建缓存。**教训:workspace 新依赖装完先跑 typecheck + e2e 再继续。**
- **tiptap v3 的 EditorContent 卸载语义**(B6):卸载只把视图 DOM 挪到游离节点(不 destroy),抽屉重开原样搬回——笔记搬进 Sheet 不丢内容、不重建编辑器。
- **浏览页虚拟化改道**(D):不做 react-virtual,用 CSS `content-visibility: auto`(行级)——零依赖、DOM 全保留(e2e/查询稳定),282 题规模渲染开销已足够降低。
- **C5 取消零改 lib**:`ChatOptions` 本就带 `signal`,页面层构造 AbortController 透传即可;AbortError 静默复位。

## 已知限制 / 后续

- **profile 站内路由拦截未做**:需迁移 data router(`createHashRouter` + `useBlocker`),影响面大,本轮只做 beforeunload(关窗/刷新)。排期时单独处理。
- **C4 骨架屏的加载窗口在 web mock 层难复现**(官方题种子静态打包、秒到),分支逻辑靠代码审查 + 真机冒烟覆盖;已确认加载期不再出现"全部学完"假完成态。
- **审计 3.2d 为误报**:profile「未填」实为 muted 灰小字非 warning 橙(已在审计文档 §0 勘误),代码未改。
- **E1 字体修栈的真机确认**:WKWebView 的字体回退链与 Chromium 不完全一致,`npm run tauri dev` 真机过一眼(审计 §7 建议)。

## 验证矩阵(每批次均全绿后才合入)

`npm run test`(199 单测)/ `npm run typecheck` / `npm run build` / `npm run e2e`(28 用例,web 层 mock IPC+LLM)+ 临时 playwright 脚本截图与 DOM 取证目检。**覆盖层说明**:e2e 为 web 层回归,真 SQLite/真 LLM/系统全屏/子窗口行为属真机层,由 `npm run smoke` 与人工 `npm run tauri dev` 验证(见施工记录)。
