# AGENTS.md

Workspace instructions for ZCode agents working in this repo.

## 这个仓库是什么

求职准备资源库:刷题 + 弄简历。题库(`banks/`)是源;桌面端(`desktop/`,主开发线)和 web 刷题站(`quiz-app/`,已冻结的只读快照)消费它;简历 skill(`skill/`)管另一头。自用为主。

## 文档地图(在哪找什么)

| 想知道 | 去哪 |
|---|---|
| 桌面端定位与全部设计决策(ADR) | `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md` |
| 各阶段施工计划与完成状态 | `docs/superpowers/plans/` |
| 出题质量 5 原则(改题/生题必读) | `banks/audit/QUALITY.md` |
| 简历红线 R1/R2/R3 与六阶段工作流 | `skill/SKILL.md` |
| 功能总览、题库格式、使用方式 | `README.md` |
| 题库清洗管线 | `banks/clean/PROMPT.md` |

## 工作流程(硬性)

1. **方案先行**:设计 / UI / 架构类改动,先出方案(多选项带对比)让用户确认再动手;明确的具体指令直接执行。控件摆放位置、样式、命名也算设计决策,不在"直接执行"豁免范围内。
2. **UI 决策先查 skill**:做界面设计前调 `ui-ux-pro-max` 查 UX 准则/反模式;**使用/新增 shadcn 组件前调 `tailwind-v4-shadcn`**(组件官方用法、Tailwind v4 主题/CSS 变量/token)。不凭通用惯例或直觉拍板;skill 结论与仓库现有约定冲突时以仓库约定为准并说明。(教训:行内文本按钮、展开抽屉装动作、文字冒充图标,都是没查 skill 直接动手的产物。)
3. **完成标准**:单测 + typecheck + build 全绿才算完;UI 改动加截图目检;涉及 e2e 的行为变更同步更新用例。
4. **提交**:conventional-commits 前缀 + 中文描述;feature 从 `main` 拉分支,完成后 `--no-ff` 合回;**不 push 远端**,除非用户明确要求。
5. **文档同步**:行为或约定变了,当轮 commit 里同步更新 AGENTS.md / plan 文档,不让文档欠账。

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

- **UI 组件照 shadcn 官方用法**:不写原生标签,不自创结构变体;缺组件按官方方式补源码进 `src/components/ui/`;有公共组件(PageHeader 等)就复用,不各写各的;布局类放 CardContent 等内容层,不堆在 Card 上。
- **行内重复动作用 ghost icon 按钮**:列表行内的操作(添加/编辑/删除)用 Lucide 图标 + shadcn Tooltip + `aria-label`,不放常驻文本按钮,不用展开抽屉装动作,不写"可改可删"类说明文案;图标不用 emoji/文本字符。
- **路由用 react-router**:页面组件放 `src/pages/`,路由表在 `App.tsx`(HashRouter);站内导航一律 `Link`/`useNavigate`,不写 `<a href="#/…">`(外部链接除外)。
- **在 token 体系内工作**:颜色、边框、间距只用现有 CSS token 与既有层级,不引入魔法值和新色调。
- **AI 产物必经人工审核**(ADR-10):生成内容一律先进草稿区,approve 后才入正式库与 SM-2 队列。

### web 刷题站(quiz-app/)

- **已冻结**(ADR-6):只修 bug 不加功能;官方库更新时重建 questions.json 重新部署;新功能一律进 desktop/。

## 命令

```bash
# 桌面端(主开发线)
cd desktop
npm run tauri dev        # 完整桌面壳(Rust 编译,首次较慢;真 LLM/SQLite 手测入口)
npm run dev              # 仅前端(浏览器,SQLite 降级内存)
npm run test:run         # vitest 单测
npm run typecheck        # tsc --noEmit
npx playwright test      # e2e(web 层)
npm run build:bank       # YAML -> questions.json(desktop 侧)

# web 刷题站(冻结)
cd quiz-app && npm run build:bank   # 同款校验(quiz-app 侧)
cd quiz-app && npm run audit        # 题库质量审计

# 简历渲染
cd skill && node scripts/render-pdf.mjs <input.md> <output.pdf>
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
