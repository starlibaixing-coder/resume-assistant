# 求职准备资源库

**前端工程师求职,或前端背景想转 AI Agent 方向。** 两件套:**刷题 + 弄简历**。

四个交付物:

- **刷题桌面端 CommitCareer**([`desktop/`](./desktop),主开发线)- Tauri 桌面应用。在刷题核心之上加了 AI 能力:**知识点生题**(LLM 按知识点广度自主定量)→ **草稿区人工审核** → 通过后进"我的题库"一起刷(SM-2 间隔重复)。进度/笔记/我的题存本地 SQLite,LLM key 存系统钥匙串,零上传。
- **web 刷题站**([`quiz-app/`](./quiz-app))- 上述刷题核心的纯前端只读快照,无需安装即可体验。🚀 在线:https://starlibaixing-coder.github.io/resume-assistant/ (已冻结,新功能只进桌面端)
- **面试题库**([`banks/`](./banks))- 桌面端与 web 站的共同数据源。两个分类:**前端工程师**(135题)和 **AI Agent 工程师**(147题,适合前端转方向)。
- **简历生成 skill**([`skill/`](./skill))- ZCode agent skill,六阶段工作流从项目材料 + JD 生成 JD 定向、扛得住面试的 PDF 简历。

## 桌面端(desktop/)

刷题 + AI 生题一体的本地应用:

- **SM-2 间隔重复刷题**:三档评分(不会/模糊/掌握),待复习优先、新题补位;强制思考(先想后看答案)
- **AI 生题**:输入知识点,LLM 出一批不同角度的题(数量由它按知识点广度判断);prompt 内嵌题库质量红线,预检不过自动修正重试
- **求职**:JD 管理(多 JD、最近使用置顶)+ 简历管理;从任意 JD 一键「按 JD 生成题目」(结合简历可出深挖题)
- **出题即按钮**:各页面直接「添加题目 / AI 生成题目 / 按 JD 生成」,产物都进我的题库并标注来源;AI 出的先进待审核,你逐题通过/拒绝,通过才进复习队列——库永远干净
- **我的题库**:与官方题库并列,独立分类;官方题只读,复制副本后可编辑删除
- **本地优先**:SQLite 存进度/笔记/我的题,API key 进 OS 钥匙串,数据不上传

```bash
cd desktop
npm install
npm run tauri dev    # 运行桌面应用(Rust 编译,首次较慢)
```

首次使用:设置页填 LLM 服务商 + API key(智谱/DeepSeek/本地 Ollama 均可)。

## 面试题库(banks/)

题库以 YAML 为源,按分类组织,每分类下按模块拆分。

| 分类 | slug | 模块数 | 题数 | 覆盖范围 |
|---|---|---|---|---|
| 前端工程师 | `fe` | 19 | 135 | JS 原理 / React / Vue / 浏览器 / CSS / 工程化 / 安全 / Node.js |
| AI Agent 工程师 | `agent` | 15 | 147 | 模型原理 / Agent 机制 / RAG / 工程化 / 产品架构 / 认知行为面 |

AI Agent 题库按能力层级分为 5 大层,详见 [`banks/ai-agent/README.md`](./banks/ai-agent/README.md)。

### 题目格式(YAML)

```yaml
module: 1
moduleName: Agent 核心机制
questions:
  - id: "01.1"
    difficulty: 中          # 初/中/高
    tags: []                # 修饰标签(高频/手写等)
    title: "什么是 Function Calling？"
    focus: "理解 Function Calling 的本质"   # 考察方向,不是答案摘要
    answer:
      - "**Function Calling 工作流程**：..."
      - "适合：任务步数不定。"
    followups:
      - "为什么 ReAct 容易跑偏？"
```

### 质量保障

- **build.mjs** 严格校验:字段完整 / difficulty 初中高 / answer ≥ 50 字 / id 全局唯一且发布后不可变
- **audit.mjs** 设计质量检查(5 条原则,见 `banks/audit/QUALITY.md`):答案泄漏 / 追问提示 / 多问一题 / 概念混乱 / focus 泄漏

### 添加新分类

新建 `banks/<slug>/` + meta.yaml + 模块 YAML,跑 build.mjs 校验,前端自动出现新分类,零代码改动。

## 简历生成 skill(skill/)

### 三道红线(R1 / R2 / R3)

约束每一条进入简历的文字,保证简历诚实、扛得住面试:

- **R1 动词锁定** - 润色语气,不升级责任。`参与` 可变 `协助完成`,绝不变 `负责`/`主导`。
- **R2 不编造数据** - 数字必须来自用户。含糊指标必须追问精确值,不杜撰 QPS/百分比。
- **R3 亮点锚定事实** - 代码复杂度/复用/库使用只是候选线索,需用户确认后才能进简历。

```bash
cd skill
npm install                                            # Node.js 18+ + 系统 Chrome
node scripts/render-pdf.mjs <input.md> <output.pdf>    # Markdown 简历 -> PDF
```

作为 ZCode skill 使用时,把 `skill/` 目录复制或软链到 `~/.agents/skills/resume-assistant/`。

## 开发

技术栈:desktop = Tauri 2 + React 19 + Tailwind v4 + shadcn/ui + SQLite;quiz-app = React + Vite(冻结);skill = Node + puppeteer-core。

```bash
cd desktop
npm run test:run       # 单测
npm run typecheck
npx playwright test    # e2e
npm run build:bank     # 题库 YAML -> questions.json
```

开发约定(分支/提交/设计决策流程/各模块红线)见 [`AGENTS.md`](./AGENTS.md);桌面端全部设计决策(ADR)见 `docs/superpowers/specs/`。
