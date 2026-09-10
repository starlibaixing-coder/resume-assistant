# AGENTS.md

Workspace instructions for ZCode agents working in this repo.

## 这个仓库是什么

求职准备资源库:刷题 + 弄简历。题库(`banks/`)是源;桌面端(`desktop/`,主开发线)和 web 刷题站(`quiz-app/`,已冻结的只读快照)消费它;简历 skill(`skill/`)管另一头。自用为主。

## 文档地图(在哪找什么)

| 想知道 | 去哪 |
|---|---|
| 桌面端定位与全部设计决策(ADR) | `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md` |
| 桌面端功能全景(应然清单,PRD 的功能输入) | `docs/product/desktop-features.md` |
| 桌面端 PRD(各模块布局与交互,验收基准) | `docs/product/desktop-prd.md` |
| 桌面端技术设计约束(存储/调用/页面拆分/UI 与开发约束,照此开发) | `docs/product/desktop-tech-design.md` |
| 产品决策 ADR(grilling/评审会话逐条落档) | `docs/adr/` |
| 桌面端 UI 重构设计交付物(v1–v11 历史版本,已被 v12 取代) | `docs/superpowers/specs/2026-09-04-ui-redesign.md` |
| **桌面端前端现状:从零重建设计 v12「纸面工作台」(2026-09-10 实施,当前以此为准)** | `docs/superpowers/specs/2026-09-10-frontend-rebuild.md` |
| **桌面端后端 TODO(前端已做 UI、后端待补的插件/命令/迁移)** | `docs/product/desktop-backend-todo.md` |
| 从 0 重设计提案 v3 · 桌面工作台范式(未实施;可操作原型在仓库根 `from-zero-prototype.html`) | `docs/superpowers/specs/2026-09-08-from-zero-redesign.md` |
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

> 2026-09-10 前端按 `desktop-tech-design.md` v1.1 **从零重写**(`src/` 全量替换),设计现状见 `specs/2026-09-10-frontend-rebuild.md`;旧 IA(v4–v11,`specs/2026-09-04-ui-redesign.md`)已整体废弃,本节只描述现状。

- **品牌与命名 = CommitCareer**(窗口标题/productName/侧栏/document.title 四处统一);**UI 术语以 `specs/2026-09-02-terminology.md` 为准**(待学习/待复习/待审核/学习队列,一词一义);提交前跑禁词 grep(tech-design §7.5:`新题|草稿区|生题|定向生题|没学过|未学|档案|训练|求职中枢|待确认` 用户可见字符串零命中)。
- **IA:八路由 = 侧栏八项,⌘1–8 顺序一致**:今日 `/` · 学习队列 `/session` · 题库 `/library` · 审核 `/review`(带待审数)· 添加题目 `/add` · JD `/jd` · 简历 `/resume` · 设置 `/settings`(⌘,)。路由表在 `app/App.tsx`(HashRouter);站内导航一律 `useNavigate` + 守卫(`guard.ts requestNavigation`),不写 `<a href="#/…">`;`document.title = {页面名} · CommitCareer`。
- **视觉 v12「纸面工作台」**:暖纸浅色(纸 #f5f0e6/卡 #fbf8f1/墨 #2b2318/朱砂 #bc3f2c)+ 夜读暖黑(`html.dark`,#191411/#ece2cf/朱砂提亮 #e06a4b)双主题,语义 token 全覆盖、禁魔法色值;宋体 `--font-display` 用于页头/题干(22px,专注 27px)/小结标题;无边框分层;药丸徽章;答案列宽 ≤38rem。壳 = 216px 文字侧栏(【学习】【求职】两组,组名用平实词勿生造)+ 无顶栏 + 底部状态栏(五档计数可点击 + 连续天数 + 主题快切);专注模式 `html.cc-focus` 隐 `[data-chrome]` + Tauri 系统全屏(F/Esc)。
- **布局语法**:管理面(题库/审核/JD)= 列表+详情双栏工作台,编辑一律就地表单,**编辑弹窗禁用**;今日=驾驶舱纵排(hero 主计划卡=第一件未完成事唯一主 CTA);练习=居中单列;添加题目=三段平铺(禁 Tabs);设置=分组卡。**组件白名单**(tech-design §7.3):Button/Dialog/AlertDialog/Input/Textarea/Select/RadioGroup/Checkbox/Command/Tooltip/Badge/Table/Separator/sonner;**禁用 Tabs/Drawer/Sheet/DropdownMenu**(筛选用按钮组);缺组件按 shadcn 官方方式补源码进 `components/ui/`。表单规范(design spec §7.1,全站强制):标签在字段上方、输入统一 h-9、字段间距 space-y-4、短字段两列、动作按钮底部右对齐且不换行;筛选工具栏=每维度一个 Select(「全部…」默认项)+搜索+激活时「重置」。表单 Label+必填星号,多选一 RadioGroup,**不可逆操作一律 AlertDialog**(Esc=取消,初始焦点取消钮)。
- **会话引擎**(`lib/session.ts`,状态仅内存,重启即结束):评分锁定——`rateCurrent()` 写入后 locked,UI 结果条(语义色 1s + 220ms 淡出)播完调 `confirmAdvance()` 推进,勿恢复"评分即推进";评 no 自动追加重练副本(每题一次);消失题(ADR-0004)渲染前拦截、跳过不计小结;小结按题去重取最终评分。队列:复习=到期不限量 / 学习=待学习截断 batch_size / 练习全部题目=全库(引擎名:全库练习;弃「总复习」——含未学题目不能叫复习) / 单题直练 `/session?` 无——单题从详情按钮进;无「混合」类型(⌘K 与今日页按钮同名同义)。
- **全局热键**(`lib/hotkeys.ts` 单文件):可编辑焦点(input/textarea/select/contenteditable/.cm-content)只放行 ⌘K;Esc 层级 Confirm/Guard→Palette→Focus;`/session` ␣/Enter 揭示、1/2/3 评分、F 专注;`/resume` ⌘S;列表 ↑/↓ 经 `lib/page-hooks` 注册回调——页面勿再手写 window keydown。⌘K 面板(cmdk):动作/前往/题目三组;搜索语义曾踩坑(cmdk 根 value 是选中项语义),现在 `CommandInput` 直挂。
- **状态管理**:不引入 redux/zustand;`lib/storage.ts` 内存缓存(唯一读源)→ fire-and-forget SQL → notify → `useSyncExternalStore`(全局版本号)。**缓存 getter 必须返回副本**(返回活数组/Map 引用会让 useMemo 永不失效——2026-09-10 踩过,种子数据/审核通过后 UI 不刷新)。
- **后端冻结与补列**:后端(Tauri Rust/tauri.conf/capabilities)未随重建改动;`review_state.last_rating`、`questions.source_ref/jd_id/is_code`、`meta`、`rating_log` 由前端启动幂等 DDL(`storage.ensureSchema`)垫住——**正式化进 Rust 迁移与剩余能力缺口(dialog/fs 插件、外链、ai-chat 随主窗关闭、导入原子事务)见 `docs/product/desktop-backend-todo.md`,做后端改动前先读它**。真机注意:库文件是 `sqlite:resume.db`(非文档的 app.db);due 存毫秒(非文档的秒);SM-2 fuzzy 样例 EF 值文档有误,以公式为准(EF 不变)。
- **AI 产物必经人工审核**(ADR-10):生成内容一律 pending,`approvePending` 原位转正式 id `my.<模块>.<序号>`(source_ref/jd_id 保留);拒绝=级联删除。手动加题例外:人写即人审直接 approved(ADR 确认)。出题统一走「添加题目」三段(手动/AI 知识点/按 JD),`?jd=` 深链预选。
- **官方题库走 DB 物化**(`lib/sync.ts` + official_* 表):首启播种包内 questions.json,启动 2s 后台静默同步 + 设置页手动;三态反馈(已是最新/更新 N(新增 a 下架 d)/失败可重试);远端下架连带清进度/笔记/草稿/评分日志(id 作废不复用,ADR-9);YAML 仍是唯一真相源。
- **代码草稿纸**(`components/biz/code-scratchpad.tsx`):按题存 code_drafts;JS 走 Web Worker 沙箱(`lib/js-runner.ts`,3s 强杀,异步输出转发);CodeMirror 的 closeBrackets 必须保持关闭,basicSetup/onChange 必须稳定引用(2026-08-27 教训);编辑器主题只吃 CSS token。
- **问 AI 走子 webview 窗口**(`lib/ai-window.ts`):题目文本先写剪贴板,chat.qwen.ai 开独立 `WebviewWindow`(已开则 setFocus);`ai-chat` 不进 capabilities windows 列表(零 IPC);浏览器降级新标签页;不用 iframe。
- **完成标准(桌面端)**:单测 + typecheck + build 全绿;UI 改动加截图目检(`desktop/scripts/rebuild-shots.mjs` 双主题);e2e(web 层,内存降级+mock 远端)只在大 feature 时跑,改到已覆盖行为必须同步用例;真 SQLite/全屏/ai-chat/真 LLM 只有 `npm run tauri dev` + `npm run smoke` 能验——报告"全绿"必须注明覆盖层。

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
