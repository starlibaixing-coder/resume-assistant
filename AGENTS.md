# AGENTS.md

Workspace instructions for ZCode agents working in this repo.

## What this repo is

求职准备资源库,目标:刷题 + 弄简历。题库为源,桌面端和 web 站各管一头。

1. **`desktop/`** - Tauri 桌面端(**主开发线**)。React 前端复用刷题核心 + JS agent 编排(Vercel AI SDK),Rust 侧提供系统能力(SQLite、keyring、文件)。LLM 生题、我的库、求职档案等 AI 能力都在这里。
2. **`quiz-app/`** - web 刷题站。React + Vite 纯前端,SM-2 间隔重复 + markdown 笔记,部署到 GitHub Pages。在线:https://starlibaixing-coder.github.io/resume-assistant/ **已冻结为只读刷题快照**(负责传播,不再演进,见设计稿 ADR-6)。
3. **`banks/`** - 面试题库(两端共享数据源)。YAML 为源。当前两个分类:
   - `banks/ai-agent/` - AI Agent 工程师题库(15 模块 / 147 题)
   - `banks/fe/` - 前端工程师题库(19 模块 / 135 题)
   - `banks/clean/` - 清洗管线(任意格式原料 -> AI -> 标准 YAML)
   - `banks/audit/` - 质量审计(audit.mjs 格式+设计检查,fix.mjs 自动修正)
4. **`skill/`** - 简历生成 skill。ZCode agent skill,六阶段工作流生成 JD 定向 PDF 简历。

桌面端是主交付物,web 站是传播入口,题库是它们的数据源。

## 目录结构

```
├── banks/                       # 题库(YAML 源)
│   ├── ai-agent/                # AI Agent 题库
│   │   ├── meta.yaml            # 分类元信息(slug/name/modules)
│   │   └── 01-*.yaml … 15-*.yaml
│   ├── fe/                      # 前端题库
│   │   ├── meta.yaml
│   │   └── 01-*.yaml … 19-*.yaml
│   ├── clean/                   # 清洗管线(PROMPT.md + clean.mjs)
│   └── audit/                   # 质量审计(audit.mjs + fix.mjs + QUALITY.md)
├── desktop/                     # Tauri 桌面端(主开发线)
│   ├── src/                     # React + TS 前端(lib/ 含存储/SM-2/agent/provider)
│   ├── src-tauri/               # Rust 壳(SQLite migration + keyring command)
│   ├── scripts/build.mjs        # YAML -> questions.json(同 quiz-app)
│   ├── tests/                   # Playwright e2e
│   └── public/questions.json    # 官方库只读快照(不要手改)
├── quiz-app/                    # web 刷题站(已冻结,只读快照)
│   ├── src/                     # React 前端源码
│   ├── scripts/build.mjs        # YAML -> questions.json(校验+合并)
│   └── public/questions.json    # 构建产物(前端数据源,不要手改)
├── skill/                       # 简历生成 skill
│   ├── SKILL.md
│   ├── scripts/render-pdf.mjs
│   └── assets/print.css
├── docs/                        # 原料 + specs/plans 设计文档
└── .github/workflows/deploy.yml # GitHub Pages 自动部署(quiz-app)
```

## Commands

```bash
# 题库构建(YAML -> questions.json,严格校验,含 id 不可变校验;quiz-app 与 desktop 各有一份)
cd quiz-app && npm run build:bank    # = tsx scripts/build.mjs
cd desktop && npm run build:bank     # 同上(desktop 用同一套校验)

# 质量审计(格式 + 设计检查)
cd quiz-app && npm run audit         # = tsx ../banks/audit/audit.mjs --format-only

# 刷题站(web,已冻结)
cd quiz-app
npm install
npm run dev           # 本地开发
npm run build         # 构建生产版本(vite build,CI 用)

# 桌面端(主开发线)
cd desktop
npm install
npm run dev           # vite 前端开发(浏览器,无 Tauri 壳)
npm run tauri dev     # 完整 Tauri 桌面壳(Rust 编译,首次较慢)
npm run typecheck     # tsc --noEmit

# 测试
npm run test:run      # vitest 单测(desktop: 78+ 测)
npm run test:coverage # 带覆盖率
npx playwright test   # desktop e2e 冒烟(需先 npm run dev 或按 config 起服务)

# 简历渲染
cd skill
npm install
node scripts/render-pdf.mjs <input.md> <output.pdf>
```

Requirements: Node.js 18+,系统 Chrome(简历渲染用),Node 20+(CI 用)。

## 题库架构(YAML 为源)

- **YAML 是源,questions.json 是 build 产物。** 改题改 YAML,不要手改 questions.json。
- **build.mjs** 只做校验+合并,无文本切分。严格校验:字段完整 / difficulty 初中高 / answer ≥ 50 字 / id 全局唯一 / id 段与文件模块号一致。校验规则抽到 `quiz-app/src/lib/validate.ts`(build/audit/运行时共用,详见 `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md` ADR-9/10)。
- **id 三段式**:`{分类slug}.{模块号}.{题号}`,如 `agent.01.1`、`fe.03.21`。全局唯一,分类间不冲突。**id 一旦发布不可变**(不可删除/改名):build.mjs 对比历史 questions.json,发现 id 消失即报错。
- **meta.yaml** 每个分类一个,声明 slug/name/modules 清单。build.mjs 校验 modules 与实际 YAML 文件严格匹配。
- **加新分类** = 新建 `banks/<slug>/` + meta.yaml + 模块 YAML,跑 build.mjs 校验,前端自动出现新卡片,零代码改动。

## 题目设计质量(QUALITY.md 5 条原则)

编辑题目前,先读 `banks/audit/QUALITY.md`。audit.mjs 自动检查其中 3 条:

1. **答案泄漏进题干** - 后半句回答前半句(≥2 问号 + 后半句关键词在答案中重叠 ≥3)
2. **追问隐含答案** - 追问括号内 >10 字且非交叉引用
3. **focus 泄漏答案** - focus >40 字且与答案关键词重叠 ≥5(focus 应写"考察什么",不是答案摘要)
4. **多问一题** - ≥3 个问号,需确认子问题是否有递进关系
5. **概念层次混乱** - AI 审查,无法自动化

## 清洗管线(banks/clean/)

- **PROMPT.md** - AI 清洗指令(任意格式原料 -> 标准 YAML)
- **clean.mjs** - 读原料拼 prompt,供 LLM 清洗后落盘
- 新题库流程:原料丢 `clean/sources/` -> clean.mjs -> AI 输出 YAML -> build.mjs 校验落盘

## 刷题站架构(quiz-app/,已冻结)

- **React + Vite**,hash 路由(纯前端,无需服务器配置)
- **SM-2 间隔重复**:三档评分(不会/模糊/掌握),`src/lib/sm2.js`
- **进度存储**:localStorage,按分类隔离(`quiz-progress:<slug>`),`src/lib/storage.js`
- **强制思考**:答案默认折叠,点"我想好了"才解锁
- **base 路径**:`/resume-assistant/`(GitHub Pages 子路径部署),fetch 用 `import.meta.env.BASE_URL` 联动
- **CI**:`.github/workflows/deploy.yml`,push main 时自动 build + 部署 Pages
- **冻结纪律**(ADR-6):只修 bug 不加功能;官方库更新时重建 questions.json 重新部署;新功能一律进 `desktop/`

## 桌面端架构(desktop/,主开发线)

设计稿:`docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md`(10 个 ADR,施工前重读 §7 硬约束)。

- **双库模型**(ADR-3):官方 YAML 库只读(`public/questions.json`),我的库存本地 SQLite,刷题界面聚合两者。官方题不可原地改删,只能"复制成副本再改"。
- **我的库**(阶段 1):独立分类 `my`,生题批次即模块(模块名=知识点),官方副本统一进模块 0。id 三段式 `my.<module>.<idx>`。数据层 `src/lib/mylib.ts`(内存缓存 + await 持久化 + pub-sub),聚合在 `src/lib/questions.ts`(`mergeQuestionData`,pending 永不进刷题)。
- **生题管线**(阶段 1):`src/lib/generate.ts` —— system prompt 内嵌 QUALITY.md 设计红线,输出 JSON,预检共享 `validateQuestion`,不过则喂错误自修正重试 ≤2 次;产物只进草稿区,approve 后才进 SM-2 队列。LLM 配置 `src/lib/llm-config.ts`(预设:智谱/DeepSeek/Ollama/自定义;key 只进 keyring,非 Tauri 环境内存降级)。页面路由:`#/generate`(生题)、`#/drafts`(草稿区)、`#/settings`(LLM 设置)、`#/my`(我的题库)。
- **JS 大脑 + Rust 工具**(ADR-5):agent 编排/LLM 调用在前端 JS(Vercel AI SDK,`src/lib/agent.ts` + `provider.ts`);Rust 只暴露系统能力(keyring 的 `get_api_key`/`set_api_key`)。
- **SQLite 四表**(ADR-7):questions / review_state / notes / profile,migration 在 `src-tauri/src/lib.rs`,经 `@tauri-apps/plugin-sql` 访问。存储层抽象在 `src/lib/storage.ts`(B 方案:内存缓存 + 持久化)。
- **key 安全**(ADR-8):API key 存 OS 钥匙串,provider 走 OpenAI 兼容抽象(智谱优先)。
- **id 跨库唯一**(ADR-9):进度统一进 `review_state` 表;我的库 id 用 `my-` 前缀避开官方 slug;官方 id 一旦发布不可变。
- **质量闸**(ADR-10):AI 生成题一律先进草稿区,用户 approve 后才入正式库 + SM-2 队列;prompt 内嵌 QUALITY.md 规则,预检用共享校验(`src/lib/validate.ts`)。
- **备份**(ADR-7/§5 教训):运行时数据走 app 导出/导入,不走 git。

## 简历 skill 架构(skill/)

- **ESM only.** `skill/package.json` 有 `"type": "module"`。
- **渲染器用系统 Chrome**,不用 bundled Chromium(`puppeteer-core` + `findChrome()`)。
- **路径解析以 skill 目录为根**(`SKILL_ROOT = resolve(__dirname, '..')`)。

## The Three Lines (R1 / R2 / R3) - non-negotiable

编辑简历内容或 skill 工作流前,先重读 `skill/SKILL.md`。

- **R1 动词锁定** - 润色语气,不升级责任。`参与` 绝不升 `负责`。
- **R2 不编造数据** - 数字必须来自用户,不杜撰 QPS/百分比。
- **R3 亮点锚定事实** - 候选线索必须经用户确认才能进简历。

## Conventions

- 题库以 YAML 为源,改题改 YAML,不手改 questions.json。
- 题库技术准确性是第一优先级。修订以就地修复硬错误为主,不重写。
- 简历输出语言跟随 JD:中文 JD 写中文,英文 JD 写英文。
- Git commit 使用 conventional-commits 前缀 + 中文描述(如 `feat(banks): 新增前端题库`)。
- 默认分支 `main`。feature 工作(如 `feat/quiz-app`)从 `main` 拉分支。
