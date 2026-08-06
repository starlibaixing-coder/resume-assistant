# 求职准备资源库

技术岗求职的两件套:**刷题 + 弄简历**。题库为源,刷题站和简历 skill 各管一头。

> 🚀 **在线刷题**:https://starlibaixing-coder.github.io/resume-assistant/

三个核心交付物:

- **刷题站**([`quiz-app/`](./quiz-app))- React + Vite 纯前端,Anki 式间隔重复 + markdown 笔记,自动部署到 GitHub Pages。↑ 上面就是在线地址。
- **面试题库**([`banks/`](./banks))- 刷题站的数据源。多分类结构化题库,YAML 为源,覆盖 AI Agent(147题)和前端(135题)。
- **简历生成 skill**([`skill/`](./skill))- ZCode agent skill,六阶段工作流从项目材料 + JD 生成 JD 定向、扛得住面试的 PDF 简历。

## 目录结构

```
├── banks/                       # 题库(YAML 源)
│   ├── ai-agent/                # AI Agent 题库(15模块/147题)
│   │   ├── meta.yaml            # 分类元信息(slug/name/modules)
│   │   └── 01-*.yaml … 15-*.yaml
│   ├── fe/                      # 前端题库(19模块/135题)
│   │   ├── meta.yaml
│   │   └── 01-*.yaml … 19-*.yaml
│   ├── clean/                   # 清洗管线(AI prompt + clean.mjs)
│   ├── audit/                   # 质量审计(audit.mjs + fix.mjs + QUALITY.md)
│   │   └── reports/             # 审查报告
│   └── PLAN-v2.md               # 题库架构设计文档
├── quiz-app/                    # 刷题站(React + Vite)
│   ├── src/                     # 前端源码
│   ├── scripts/build.mjs        # YAML -> questions.json(校验+合并)
│   ├── public/questions.json    # 构建产物(前端数据源)
│   └── PLAN.md                  # 刷题站设计文档
├── skill/                       # 简历生成 skill(配套工具)
│   ├── SKILL.md                 # Skill 指令:三道红线 + 六阶段工作流
│   ├── scripts/render-pdf.mjs   # Markdown -> HTML -> PDF 渲染器
│   └── assets/print.css         # 打印样式
├── docs/                        # 题库清洗原料(fe.md 等)
├── .github/workflows/deploy.yml # GitHub Pages 自动部署
└── AGENTS.md                    # 给 ZCode agent 的工作区说明
```

## 面试题库

题库以 YAML 为源,按分类组织。每个分类下按模块拆分,每模块一个 YAML 文件。

**当前分类:**

| 分类 | slug | 模块数 | 题数 | 覆盖范围 |
|---|---|---|---|---|
| AI Agent 工程师 | `agent` | 15 | 147 | 模型原理 / Agent 机制 / RAG / 工程化 / 产品架构 / 认知行为面 |
| 前端工程师 | `fe` | 19 | 135 | JS 原理 / React / Vue / 浏览器 / CSS / 工程化 / 安全 / Node.js |

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

- **build.mjs** 严格校验:字段完整 / difficulty 初中高 / answer ≥ 50 字 / id 全局唯一
- **audit.mjs** 设计质量检查(5 条原则,见 `banks/audit/QUALITY.md`):
  - 答案泄漏进题干 / 追问隐含答案 / 多问一题 / 概念混乱 / focus 泄漏答案
- **clean.mjs** 清洗管线:任意格式原料 -> AI 清洗 -> 标准 YAML

### 添加新分类

新建 `banks/<slug>/` + `meta.yaml` + 模块 YAML 文件,跑 `node quiz-app/scripts/build.mjs` 校验,前端自动出现新分类卡片,零代码改动。

## 刷题站

Anki 式间隔重复刷题,纯前端,无后端。

- **SM-2 算法**:三档评分(不会/模糊/掌握),自动安排复习间隔
- **强制思考**:答案默认折叠,点"我想好了,看答案"才解锁
- **进度存储**:localStorage,按分类隔离
- **在线访问**:https://starlibaixing-coder.github.io/resume-assistant/

```bash
cd quiz-app
npm install
npm run build:bank    # YAML -> questions.json
npm run dev           # 本地开发
npm run build         # 构建生产版本
```

## 简历生成 skill

把 JD 定向、可面试的简历生成作为配套工具。

### 三道红线(R1 / R2 / R3)

约束每一条进入简历的文字,保证简历诚实、扛得住面试:

- **R1 动词锁定** - 润色语气,不升级责任。`参与` 可变 `协助完成`,绝不变 `负责`/`主导`。
- **R2 不编造数据** - 数字必须来自用户。含糊指标必须追问精确值,不杜撰 QPS/百分比。
- **R3 亮点锚定事实** - 代码复杂度/复用/库使用只是候选线索,需用户确认后才能进简历。

### 使用

```bash
cd skill
npm install                                                          # Node.js 18+ + 系统 Chrome
node scripts/render-pdf.mjs <input.md> <output.pdf>                  # 渲染 Markdown 简历为 PDF
```

作为 ZCode skill 使用时,把 `skill/` 目录复制或软链到 `~/.agents/skills/resume-assistant/`。

## 贡献与约定

- 题库以 YAML 为源,改题改 YAML,不要手改 questions.json(它是 build 产物)。
- 题库技术准确性是第一优先级。修订以**就地修复硬错误**为主,不重写。
- 题目设计遵循 `banks/audit/QUALITY.md` 5 条原则。
- 简历输出语言跟随 JD:中文 JD 写中文,英文 JD 写英文。
- Git commit 使用 conventional-commits 前缀 + 中文描述(如 `feat(banks): 新增前端题库`)。
