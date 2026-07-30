# AGENTS.md

Workspace instructions for ZCode agents working in this repo.

## What this repo is

AI Agent 工程师求职准备资源库,两个独立交付物:

1. **`interview-bank/`** - 主体。结构化 AI Agent 工程师面试题库,15 个模块 / 5 大能力层,中文。见 `interview-bank/README.md` 的层/模块图和按岗位刷题路径。
2. **`skill/`** - 配套工具。ZCode agent skill,从用户的项目材料(本地代码、README、文档或代码片段)+ JD + 业务背景,生成 JD 定向、可面试的 PDF 简历。六阶段工作流:Intake -> Material extraction -> Endorsement -> JD-tailored rewrite -> Review -> Render。

题库是项目主线,简历 skill 是附属配套工具。编辑时优先理解题库结构。

**无构建步骤、无测试套件、无 linter。** 唯一运行时是 `skill/` 下的 PDF 渲染器。

## 目录结构

```
├── interview-bank/              # 面试题库(主体)
│   ├── README.md                # 题库总览
│   └── 01-*.md … 15-*.md        # 各模块题目
├── skill/                       # 简历生成 skill(配套工具)
│   ├── SKILL.md                 # Skill 指令:三道红线 + 六阶段工作流
│   ├── scripts/render-pdf.mjs   # Markdown -> HTML -> PDF 渲染器
│   ├── assets/print.css         # 打印样式
│   └── package.json             # 渲染依赖
└── AGENTS.md                    # 本文件
```

## Commands

```bash
cd skill
npm install                                          # install deps (marked, puppeteer-core, github-markdown-css)
node scripts/render-pdf.mjs <input.md> <output.pdf>  # render a resume Markdown to PDF
```

Requirements: Node.js 18+, and a system Google Chrome / Chromium / Microsoft Edge installed on macOS.

## The Three Lines (R1 / R2 / R3) - non-negotiable

这些是**每一条进入简历的文字**的硬约束。编辑简历内容或 skill 工作流前,先重读 `skill/SKILL.md`。它们用来对抗 LLM 夸大候选人画像的系统性偏差。

- **R1 动词锁定** - 润色语气,不升级责任。`参与` 停在 contribute 层级,绝不升 `负责`/`主导`。`了解` 停在 worked-with,绝不 `精通`。中英文皆适用。
- **R2 不编造数据** - 每个数字必须来自用户。含糊指标("降低了很多")必须先追问精确值再继续。若无真实指标,写定性结果;绝不编造百分比/QPS。
- **R3 亮点锚定事实,不锚材料属性** - 代码复杂度、复用、库使用(或文档里对这些的描述)只是*候选线索*,绝不是简历 bullet。每个候选点必须经用户确认("这是你做的吗?")才能进简历。显著性是事实的副产物,不是目标。

不要合并 Phase 2(extraction)和 Phase 3(endorsement)- R3 就是在这里被违反的。

## Architecture & path rules

- **ESM only.** `skill/package.json` 有 `"type": "module"`。用 `import`,不用 `require`。
- **渲染器用系统 Chrome,不用 bundled Chromium。** `skill/scripts/render-pdf.mjs` 用 `puppeteer-core` 并通过 `findChrome()` 扫描 macOS app 路径(`/Applications/Google Chrome.app/...`、Chromium、Edge)。这是有意为之 - 避免 ~300MB Chromium 下载。不要切回完整 `puppeteer` 或加 Chromium 下载步骤。
- **路径解析以 skill 目录为根。** 渲染器计算 `SKILL_ROOT = resolve(__dirname, '..')`(即 `skill/`),从该根找 `node_modules/github-markdown-css/github-markdown-light.css` 和 `assets/print.css`。保持这些位置稳定。
- **样式** 在 `skill/assets/print.css`(叠加在 github-markdown-css 之上)。A4 / 15mm 边距;页数随内容长度,**不要**强制单页。
- 渲染器还会在输出 `.pdf` 旁写一份调试用 `.html`。

## Skill install location

skill 通过把 `skill/` 目录软链/复制到 `~/.agents/skills/resume-assistant/` 来被 ZCode 消费。`SKILL.md` 内的渲染命令引用该路径(`~/.agents/skills/resume-assistant/scripts/render-pdf.mjs`、`.../assets/print.css`),相对 skill 根仍正确。保持 `SKILL.md`、`scripts/`、`assets/` 自包含可移植。

## Interview bank conventions

- 15 个模块(`01-*.md` … `15-*.md`)+ `README.md`。编号映射 README 里的 5 层结构;不要重编号文件。
- 题目格式固定:
  ```
  ### Q[模块号.序号]【难度】题目标题
  **考察点:** ...
  **参考答案要点:** ...
  **追问方向:** (optional)
  ```
- 难度标签:`【初】` 概念 / `【中】` 场景 / `【高】` 系统设计或深度推理。
- 审查题库内容正确性时,优先就地修复硬错误,不重写。最近一次审查提交(`6263cb3`)修复了事实错误 - 技术准确性是第一优先级。

## Conventions

- 简历输出语言跟随 JD:中文 JD 写中文,英文 JD 写英文。
- Git commit 使用 conventional-commits 前缀 + 中文描述(如 `docs: 题库深度审查修订`)。匹配此风格。
- 默认分支 `main`。feature 工作(如 `feat/interview-bank`)从 `main` 拉分支。
