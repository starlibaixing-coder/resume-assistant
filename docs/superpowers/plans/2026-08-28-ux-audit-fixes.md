# UX 审计修复施工(批次 1 / 2 / 3 / 5)

> **依据**:`docs/superpowers/specs/2026-08-28-desktop-ux-ui-audit.md`(2026-08-28 审计)
> **范围**:审计 §5 排期中的批次 1(刷题工作台 B1–B8)、批次 2(生题合一 A4/A5 + E2)、批次 3(求职中枢一期 A1/A2,2026-08-31 用户确认后实施)、批次 5(反馈 C + 一致性 D + 视觉 E1/E3–E7)。
> **不在本轮**:批次 4(A3 简历优化/JD 匹配,阶段 3 范畴单独立项)。

## 完成状态(2026-08-31)

| 批次 | 分支 | 内容 | 状态 |
|---|---|---|---|
| 1 | `feat/quiz-workbench` | B1 宽度分级(非沉浸 3xl/沉浸 4xl/代码弹窗 5xl)、B2 键盘流(空格/回车翻答案,1/2/3 评分,kbd 提示,输入/编辑器/弹窗三重守卫)、B3 操作条 sticky 吸底、B4 跳过 + 撤销评分(storage 新增 `deleteCard`)、B5 代码草稿纸大弹窗(题上码下)、B6 笔记右侧抽屉(`ui/sheet.tsx`)、B7 Esc 层级(弹窗 > 沉浸)+ 进度条、B8 终态统一(全部刷完也给"再过一遍",forceAll 全量入队) | ✅ 已合入 main |
| 2 | `feat/generate-page-merge` | A4 生题页顶层 Tabs(AI/手动,`ui/tabs.tsx` + radix tabs;`?mode=manual` 深链;手动改页面级表单,保存后保留模块选择)、A5 四处手动加题入口收敛深链 + "＋ AI 生题"三种构成统一为「去生题」(Sparkles)、E2 图标清扫(✓/✗/▼/▶ → lucide;可展开行 button 化 + aria-expanded) | ✅ 已合入 main |
| 5 | `feat/feedback-consistency-visual` | C1 草稿审核 busy+toast / 编辑删除题 toast / LLM 保存 saving+toast、C2 拒绝确认弹窗、C3 useQuestions.retry + 四页失败重试、C4 `ui/skeleton.tsx` + 首页骨架/错误分支、C5 生题取消(AbortSignal)+ 计时 + 锁表单、D 回车提交/错误就近/保留旧结果/content-visibility/空态清除筛选/首页空卡常显按钮/再过一遍只跳有题分类/profile beforeunload、E1 font-mono 修栈 + 中文 mono 清扫、E3 术语出文案、E4 角标窄窗可见、E5 0% 轨道轮廓、E6 卡中卡改 divide-y | ✅ 已合入 main |
| 3 | `feat/job-hub-phase1` | 求职中枢一期(2026-08-31 用户确认推荐组合 1A/2A/3A):迁移 006 建 jds 表(存量 profile.jd 平移为首条 JD 后 DROP COLUMN,lib.rs 迁移注册+表断言)、`lib/jd.ts` 多 JD CRUD(最近使用置顶/touch/订阅)、profile 只剩公司+简历、`/profile` 原地升级「求职中枢」(Tabs:JD 管理/简历与公司;JD 行内 定向生题/编辑/删除 深链与确认)、生题页撤 JD 模式开关改 `?jd=<id>` 深链锁定上下文(失效参数给警示)、侧栏改名求职中枢 | ✅ 已合入 main |
| 跟进 | `fix/audit-followup` | 用户 2026-08-31 反馈三 bug:①生题页 Tabs 双渲染(radix forceMount 是"保持可见"而非"挂载但隐藏",两套表单同屏切 tab 无变化——补 data-[state=inactive]:hidden 自管显隐 + e2e 回归断言);②代码草稿纸编辑器塌成一行(flex-1 依赖 Dialog 定高而 max-h 是上限;改 h-[46vh] 固定 + 撑满 @uiw 的 .cm-theme-none 包装层,36px→393px);③评分条去掉 kbd 数字徽章(快捷键保留,提示挪按钮 title)、bottom-4 悬空 16px 改 bottom-0 真吸底去浮空卡片、三键降为描边式语义色、看答案按钮并入操作条 | ✅ 已合入 main |

## 批次 3 补充决策(实施时定)

- **简历多版本不加占位表**:提案原文"数据模型占位"落地为零 schema——建死表无写入方是死结构,二期加表成本与现在相同;在 profile.ts 头注释与提案状态里注明。
- **`generateJdQuestions` 改吃 `JdContext`**(company/content/resume?)而非整个 profile:生题不再依赖档案单例,JD 条目自带上下文。
- **JD 深链进入生题页即 `touchJd` 置顶**:中枢列表"最近使用在前"的排序信号与使用行为闭环。
- **Rust 侧 `test:rust` 先行**:DROP COLUMN 依赖 SQLite ≥3.35,内嵌 SQLite 的迁移测试(6/6)在写页面前先验证了可行性。

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
- **简历文件导入未做**:简历仍是粘贴文本一份;`.md` 文件导入是小项,可与简历多版本二期合并做。

## 下一步(2026-08-31,按优先级)

1. **阶段 3 立项:简历生成/优化 + JD 匹配度**(审计批次 4 / 用户四点指示的落点)。依赖求职中枢一期已就位;**动手前先出带选项方案**——关键决策点:简历多版本数据模型(resumes 表 vs profile JSON)、生成链路与 `skill/` 六阶段工作流的关系(复用渲染 vs 桌面端独立管线)、JD 匹配度的产物形态(报告/分数/改题建议)。
2. **简历多版本 + 文件导入**(二期小批):resumes 表 + 版本切换 UI + `.md` 导入,服务阶段 3。
3. **技术债:站内路由未保存拦截**:迁移 data router(`createHashRouter`),顺手可把 C4 骨架屏的真机表现一起看。
4. **阶段 4:模拟面试**(更远,依赖阶段 3 的档案/中枢成熟度)。

## 验证矩阵(每批次均全绿后才合入)

`npm run test`(207 单测)/ `npm run typecheck` / `npm run build` / `npm run e2e`(28 用例,web 层 mock IPC+LLM)+ 临时 playwright 脚本截图与 DOM 取证目检。**覆盖层说明**:e2e 为 web 层回归,真 SQLite/真 LLM/系统全屏/子窗口行为属真机层,由 `npm run smoke` 与人工 `npm run tauri dev` 验证(见施工记录)。
