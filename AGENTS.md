# AGENTS.md

Workspace instructions for ZCode agents working in this repo.

## 这个仓库是什么

求职准备资源库:刷题 + 弄简历。题库(`banks/`)是源;桌面端(`desktop/`,主开发线)和 web 刷题站(`quiz-app/`,已冻结的只读快照)消费它;简历 skill(`skill/`)管另一头。自用为主。

## 文档地图(在哪找什么)

| 想知道 | 去哪 |
|---|---|
| 桌面端定位与全部设计决策(ADR) | `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md` |
| 桌面端 UI 重构设计交付物(IA/页面规格/组件与文案规范) | `docs/superpowers/specs/2026-09-04-ui-redesign.md` |
| 各阶段施工计划与完成状态 | `docs/superpowers/plans/` |
| 出题质量 5 原则(改题/生题必读) | `banks/audit/QUALITY.md` |
| 简历红线 R1/R2/R3 与六阶段工作流 | `skill/SKILL.md` |
| 功能总览、题库格式、使用方式 | `README.md` |
| 题库清洗管线 | `banks/clean/PROMPT.md` |

## 工作流程(硬性)

1. **方案先行**:设计 / UI / 架构类改动,先出方案(多选项带对比)让用户确认再动手;明确的具体指令直接执行。控件摆放位置、样式、命名也算设计决策,不在"直接执行"豁免范围内。
2. **UI 决策先查 skill**:做界面设计前调 `ui-ux-pro-max` 查 UX 准则/反模式;**使用/新增 shadcn 组件前调 `tailwind-v4-shadcn`**(组件官方用法、Tailwind v4 主题/CSS 变量/token)。不凭通用惯例或直觉拍板;skill 结论与仓库现有约定冲突时以仓库约定为准并说明。(教训:行内文本按钮、展开抽屉装动作、文字冒充图标,都是没查 skill 直接动手的产物。)
3. **完成标准**:单测 + typecheck + build 全绿才算完;UI 改动加截图目检。**e2e 只在大 feature 开发时运行**(新页面/新交互链路),文案/样式/纯删除类小改动不跑全量 e2e;但改到 e2e 已覆盖的行为时,必须同步更新用例并在当轮跑通——用例与实现不一致比不跑更糟。**e2e 是 web 层回归**(mock Tauri IPC 与 LLM 端点,测 React 交互逻辑),Tauri 壳/真 SQLite/真 LLM 只有 `npm run tauri dev` 真机能验证——报告"全绿"必须注明覆盖层,不得暗示桌面端已验证(sqlite feature/写权限缺失两案都在 e2e 盲区,却一路全绿)。
4. **提交**:conventional-commits 前缀 + 中文描述;feature 从 `main` 拉分支,完成后 `--no-ff` 合回;**不 push 远端**,除非用户明确要求。
5. **文档同步**:行为或约定变了,当轮 commit 里同步更新 AGENTS.md / plan 文档,不让文档欠账。
6. **目录纪律**:npm/cargo 命令一律从仓库根执行(根脚本 / `-w <包>` / `--manifest-path`),或显式 `cd` 绝对路径;禁止依赖上一次调用的目录残留。给子包装依赖必须 `npm install <pkg> -w <包>`,禁止在无 package.json 的目录裸跑 install(教训:目录漂移把依赖装到仓库根,desktop 缺依赖,新环境直接构建失败)。

## 不可违反的原则

### 题库(banks/)

- **YAML 是源**,`questions.json` 是 build 产物,不要手改产物。
- **官方 id 一旦发布不可变**(build.mjs 对比历史 questions.json 校验);我的库 id 用 `my.<模块>.<题号>` 避开官方 slug。
- **技术准确性第一**;修订以就地修复硬错误为主,不重写。
- 出题 / 改题前先读 `banks/audit/QUALITY.md`(答案泄漏 / 追问提示 / 多问一题 / 概念混乱 / focus 泄漏)。

### 简历(skill/)

- **R1 动词锁定**(不升级责任)/ **R2 不编造数据** / **R3 亮点锚定事实**——动手前重读 `skill/SKILL.md`。
- 输出语言跟随 JD。
- ESM only;渲染用系统 Chrome(`puppeteer-core`);路径以 skill 目录为根。

### 桌面端(desktop/,主开发线)

- **品牌与命名 = CommitCareer**(2026-08-31 规范,详见 `docs/superpowers/specs/2026-08-31-brand-naming.md`):窗口标题/productName/侧栏/document.title 四处统一;侧栏分【刷题】【求职】两组;**UI 术语以 `specs/2026-09-02-terminology.md` 为准**(待学习/待复习/待审核/学习队列,一词一义;代码与 ADR 文档仍用 drafts/pending/草稿区),子页标题 `{分类名} · 页面`。
- **UI 组件照 shadcn 官方用法**:不写原生标签,不自创结构变体;缺组件按官方方式补源码进 `src/components/ui/`;有公共组件(PageHeader、SectionHead、EmptyState、ErrorState)就复用,不各写各的。**设计语言 v3「桌面工作台」(2026-09-04,`specs/2026-09-04-ui-redesign.md` §v3)**:按桌面应用操作习惯组织——源列表侧栏(Cmd+1..8 切换)+ 工具栏(历史 ‹ ›/面包屑/⌘K 命令面板,`data-app-nav`)+ 状态栏;中性配色、紧凑密度、品牌橙仅点缀;题目列表主从分栏,行内动作 + 右键菜单;表单 Label+必填星号,多选一用 RadioGroup,错误用 Alert,**不可逆操作一律 AlertDialog**。学习页吸底操作条按 `--page-pad-y`(壳层页容器定义)对齐,改壳层内边距必须联动。沉浸切换不重挂 main(只藏 chrome)。
- **行内重复动作用 ghost icon 按钮**:列表行内的操作(添加/编辑/删除)用 Lucide 图标 + shadcn Tooltip + `aria-label`,不放常驻文本按钮,不用展开抽屉装动作,不写"可改可删"类说明文案;图标不用 emoji/文本字符。
- **路由用 react-router**:页面组件放 `src/pages/`,路由表在 `App.tsx`(HashRouter);站内导航一律 `Link`/`useNavigate`,不写 `<a href="#/…">`(外部链接除外)。
- **在 token 体系内工作**:颜色、边框、间距只用现有 CSS token 与既有层级,不引入魔法值和新色调。
- **AI 产物必经人工审核**(ADR-10):生成内容一律先进草稿区,approve 后才入正式库与 SM-2 队列。手动加题例外:人写即人审,`addManualQuestion` 直接 approved(2026-08-26 用户确认)。
- **官方题库走 DB 物化**(`officialbank.ts`):首次启动播种包内 questions.json,之后启动自动 + 设置页手动同步 GitHub Pages 远端;远端下架的题连带清进度/笔记/代码草稿(id 作废不复用,ADR-9);YAML 仍是唯一真相源。
- **刷题卡片有代码草稿纸**(`code-scratchpad.tsx`):按题存代码(code_drafts 表,与 notes 同模式),JS 走 Web Worker 沙箱运行(`js-runner.ts` + worker,超时强杀,异步输出转发);CodeMirror 的 closeBrackets 必须保持关闭(补全与手输闭括号叠加会出语法错误),编辑器主题只吃 CSS token;**basicSetup/onChange 必须稳定引用**(内联对象/未 memo 的函数会让 @uiw 每次按键都 reconfigure,补全提示刚弹出就被拆掉、选中层异常,2026-08-27 教训)。
- **沉浸式刷题**(`lib/immersive.tsx`,2026-08-27):刷题页 meta 行入口进入,AppShell 不渲染侧栏/返回条,Tauri 壳内联动系统全屏;Esc/按钮/离开 quiz 路由三通道退出。Esc **不加**输入框/编辑器守卫——刷题时焦点常驻 CodeMirror/tiptap,守卫会让 Esc 永远够不到。学习页吸底操作条注意:壳层滚动容器有纵向内边距,sticky 约束在 content-box,`bottom-0` 会悬空露出底下滚动内容(2026-09-04 目检实锤),须按 `--page-pad-y` 变量负偏移 + 自身 paddingBottom 盖住内边距区(quiz.tsx `stickyBarStyle`)。
- **问 AI 走子 webview 窗口**(`lib/ai-assistant.ts`,2026-08-27):chat.qwen.ai 开独立 `WebviewWindow`(已开聚焦,登录态存应用数据);`ai-chat` 窗口不进 capabilities windows 列表——远端页面零 IPC,默认安全;浏览器层降级新标签页;不用 iframe(X-Frame-Options 拦截 + 第三方 iframe 登录态不可用)。
- **功能 = 题库 + 求职两大块**(2026-09-02 IA 重构,命名规范 `specs/2026-08-31-brand-naming.md` §修订):菜单【题库】官方分类+我的题库(待审 badge)/【求职】JD 管理+简历管理(`/profile?tab=`,jds 表见 `lib/jd.ts`);**出题统一走「添加题目」页**(`/add`,2026-09-03 弃弹窗改页面;三段平铺:手动 approved / AI 生成 / 按 JD 生成,来源 ai/jd 落 questions.source 迁移 007;JD 行内「按 JD 生成」为深链 `/add?jd=<id>` 捷径);题库分类页「开始复习/学习新题」双入口(`quiz?focus=due|new`,全清态 `?force=all`),「是哪些题」深链 `browse?status=`;AI 产物仍必经待审核(ADR-10,/drafts 无菜单,总览指标「待审核>0」与快捷入口可达 + 我的题库 badge 可达);总览为工作台式(2026-09-03 用户确认,对照 Ant Design Pro Workplace):问候区(时段问候+日期+累计学习/右侧三指标 待复习·待学习·待审核)+ 左主栏「学习中」(learned>0)与「未开始」(learned=0)两组分类卡及「最近动态」(lib/activity.ts 本地推导,不落新表)+ 右侧栏「快捷入口」(零计数不出现)与「求职」(空态一个动词:添加/填写);简历多版本/简历优化/JD 匹配留后续阶段。

### web 刷题站(quiz-app/)

- **已冻结**(ADR-6):只修 bug 不加功能;官方库更新时重建 questions.json 重新部署;新功能一律进 desktop/。

## 命令

```bash
# 根工作区(npm workspaces = desktop + skill;quiz-app 冻结独立不入)——所有日常命令从根目录跑
npm run tauri:dev        # 完整桌面壳(Rust 编译,首次较慢;真 LLM/SQLite 手测入口)
npm run dev              # 仅前端(浏览器,SQLite 降级内存)
npm run test             # vitest 单测(desktop)
npm run typecheck        # tsc --noEmit
npm run e2e              # e2e(web 层,IPC/LLM 均 mock)
npm run smoke            # 真机冒烟(真 SQLite/权限;改 Rust 侧/迁移后必跑)
npm run test:rust        # cargo 测试(迁移等 Rust 侧)
npm run build            # vite build
npm run build:bank       # YAML -> questions.json(desktop 侧)
npm run resume:render -- <input.md> <output.pdf>   # 简历渲染(skill,需系统 Chrome)
# 运行日志:~/Library/Logs/com.resume-assistant.desktop/app.log(存储失败/关键事件都落这里,用户报障先查)

# web 刷题站(冻结,不入工作区,命令仍在它自己目录)
cd quiz-app && npm run build:bank   # 同款校验(quiz-app 侧)
cd quiz-app && npm run audit        # 题库质量审计
```

Node 18+(简历渲染需系统 Chrome);CI 用 Node 20+。

## 目录速览

```
├── banks/            # 题库 YAML 源(fe / ai-agent)+ audit 质量审计 + clean 清洗管线
├── desktop/          # Tauri 桌面端(主开发线):React + SQLite + LLM agent
├── quiz-app/         # web 刷题站(已冻结,只读快照,GitHub Pages)
├── skill/            # 简历生成 skill(六阶段工作流 -> PDF)
├── docs/             # 设计稿 specs/ + 施工计划 plans/ + 原料
└── .github/          # Pages 自动部署(quiz-app)
```
