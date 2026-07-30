# AI Agent 面试题库刷题站 - 实现方案

> 经 6 轮 grilling 审视后的定稿。多题库刷题平台:Anki 式间隔重复 + 强制思考 + 纯前端 + CI 解析。

## 决策汇总

| 维度 | 决定 |
|---|---|
| 形态 | 开源只读刷题站,不接贡献 |
| 交互 | Anki 式抽卡 + 自评掌握度 + SM-2 间隔重复 |
| 评分 | 三档:不会 / 模糊 / 掌握 |
| 思考模式 | 轻量强制(点"我想好了"才解锁答案) |
| 数据源 | `banks/` 下各分类的 Markdown,CI 严格解析成 JSON |
| 框架 | React + Vite |
| 存储 | localStorage,按分类隔离 |
| 扩展性 | 多分类(`banks/` 扁平),meta.yaml 元信息,三段式 id |

## 目录结构

```
resume-assistant/
├── banks/                        # 所有题库分类的根
│   └── ai-agent/                 # 现有 interview-bank 迁移过来
│       ├── meta.yaml             # 分类元信息
│       ├── README.md             # 题库总览
│       └── 01-*.md … 15-*.md     # 15 个模块
├── quiz-app/
│   ├── public/
│   │   └── questions.json        # CI 生成,聚合所有分类
│   ├── src/
│   │   ├── components/
│   │   │   ├── CategoryList.tsx      # 分类选择(首页)
│   │   │   ├── ReviewQueue.tsx       # 今日复习队列
│   │   │   ├── CardView.tsx          # 抽卡答题
│   │   │   ├── AnswerPanel.tsx       # 答案区(默认折叠)
│   │   │   ├── RatingButtons.tsx     # 三档评分
│   │   │   └── ModuleNav.tsx         # 模块浏览
│   │   ├── lib/
│   │   │   ├── sm2.ts                # SM-2 算法(三档版)
│   │   │   ├── storage.ts            # localStorage 读写(按分类隔离)
│   │   │   └── schedule.ts           # 算今日待复习队列
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── scripts/
│   │   └── parse-questions.mjs       # 解析器(扫 banks/*/meta.yaml)
│   ├── package.json
│   └── vite.config.ts
├── .github/workflows/
│   └── build-questions.yml           # CI:校验+生成 JSON
├── skill/                            # 简历 skill(已存在,不动)
└── README.md
```

## meta.yaml 规范(每个分类一个)

`banks/ai-agent/meta.yaml`:

```yaml
slug: agent              # 分类唯一标识,用于 id 前缀和 URL
name: AI Agent 工程师     # 显示名
description: 面向生产级 Agent 开发岗位的结构化面试题库
modules:                 # 模块清单(解析器校验用)
  - id: 01
    name: Agent 核心机制
  - id: 02
    name: LLM 三大范式
  # ... 03-15
```

meta.yaml 让解析器能校验"声明的模块"和"实际 md 文件"是否一致--少一个、多一个都报错。

## id 策略(三段式)

```
{分类slug}.{模块号}.{题号}
   agent   .  01  .  1
```

- `agent.01.1` = Agent 分类 / 模块 01 / 第 1 题
- 全局唯一,分类间不冲突
- localStorage key、URL、内部索引全用它
- 迁移影响:现有 15 个 md 里的 `### Q01.1` 标题不用改--解析器读 meta.yaml 的 slug 自动拼接。**147 道题零改动。**

## questions.json schema

```jsonc
{
  "categories": [
    {
      "slug": "agent",
      "name": "AI Agent 工程师",
      "description": "...",
      "modules": [
        { "id": 1, "name": "Agent 核心机制", "count": 10 }
        // ...
      ]
    }
  ],
  "questions": [
    {
      "id": "agent.01.1",
      "category": "agent",
      "module": 1,
      "moduleName": "Agent 核心机制",
      "index": 1,
      "type": "qa",                 // 占位:未来支持 choice/code
      "difficulty": "中",           // 归一后:初/中/高
      "tags": ["必问"],             // 原始标签修饰词(可空数组)
      "title": "讲讲 ReAct 和 Plan-and-Execute 的区别...",
      "focus": "理解两种主流规划范式的本质差异...",
      "answer": ["ReAct:边想边做...", "..."],
      "followups": ["为什么 ReAct 容易跑偏?"]
    }
  ]
}
```

## 解析器(严格校验)

`parse-questions.mjs` 逻辑:

1. 扫 `banks/*/meta.yaml`,收集所有分类
2. 对每个分类:
   - meta.yaml 的 modules 清单 vs 实际 md 文件名,必须一一对应
   - 解析每个 md,提取题目
   - 校验每题格式
3. 全局校验所有 id 唯一(跨分类也不许重复)
4. 输出 questions.json

校验规则(任一不满足 = exit 1,CI 红):

1. `banks/` 下每个子目录必须有 `meta.yaml`
2. meta.yaml 的 modules 与实际 md 文件名严格匹配
3. 题目标题格式 `### Q模块号.序号【难度】标题` 完整
4. 难度归一:标签按 `·` 分段,首段为主难度。`初`->初,`中`->中,`高`/`中高`->高;`必问`/`建议准备`等无难度词的归中。原始完整标签存入 `tags` 数组(如 `["必问"]`、`["系统设计"]`)
5. 必须有 `**考察点:**` 和 `**参考答案要点:**`
6. id(分类slug.模块号.题号)全局唯一
7. 模块号无上限(支持 01-99+),不硬编码 15

## 页面路由

```
路由                        页面             作用
/                          CategoryList    分类选择(首页)
/:category                 ReviewQueue     该分类的今日复习队列
/:category/quiz            CardView        抽卡答题
/:category/browse          ModuleNav       该分类的模块浏览
```

CategoryList(首页)显示每个分类卡片:名称 + 模块数 + 题数 + 今日待复习数。

## CardView 交互(强制思考,轻量版)

```
┌─────────────────────────────────┐
│  Q01.1【中】ReAct vs Plan-Exec   │  ← 题干立即可见
│  考察点:理解两种规划范式...       │
├─────────────────────────────────┤
│   [ 答案区:默认折叠 ]            │  ← 看不到答案
│      ┌───────────────┐         │
│      │  我想好了,看答案 │         │  ← 唯一入口
│      └───────────────┘         │
└─────────────────────────────────┘

         ↓ 点"我想好了"

┌─────────────────────────────────┐
│  参考答案要点:                   │  ← 答案展开
│  • ReAct:边想边做...             │
│  追问:为什么 ReAct 容易跑偏?     │
├─────────────────────────────────┤
│  自评掌握度:                     │
│  [不会]  [模糊]  [掌握]          │  ← 三档,点了写入进度
└─────────────────────────────────┘
```

ReviewQueue(分类首页)逻辑:
- 读 localStorage,筛出 `due <= now` 的题,按到期排序
- 显示"今日待复习 N 题",点"开始"进 `/quiz` 走队列
- 队列空显示"今天复习完了"+ 提示去 `/browse` 学新题

## SM-2 算法(三档版)

三档映射到 SM-2 的 quality:
- **不会** -> quality = 0(失败:重置 reps=0,interval=1 天)
- **模糊** -> quality = 3(勉强:interval × ease,ease 略降)
- **掌握** -> quality = 5(轻松:interval × ease,ease 略升)

```js
function sm2(card, rating) {
  const qMap = { "不会": 0, "模糊": 3, "掌握": 5 };
  const q = qMap[rating];
  let { reps, interval, ease } = card;
  const now = Date.now();

  if (q < 3) {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    ease = Math.max(1.3, ease);
  }

  const due = now + interval * 86400000;
  return { reps, interval, ease, due, lastReview: now };
}
```

## localStorage(按分类隔离)

```
key: quiz-progress:agent      -> { "agent.01.1": {...}, "agent.01.2": {...} }
key: quiz-progress:algorithm  -> { "algo.01.1": {...} }
```

清空某分类进度不影响其他;每题几十字节,localStorage 绰绰有余。

```js
function loadProgress(category) {
  const key = `quiz-progress:${category}`;
  return JSON.parse(localStorage.getItem(key) || '{}');
}
function saveProgress(category, id, card) {
  const key = `quiz-progress:${category}`;
  const all = loadProgress(category);
  all[id] = card;
  localStorage.setItem(key, JSON.stringify(all));
}
```

## CI 配置

`.github/workflows/build-questions.yml`:

```yaml
name: build-questions
on:
  push:
    paths:
      - 'banks/**'
      - 'quiz-app/scripts/parse-questions.mjs'
  pull_request:
jobs:
  parse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: node quiz-app/scripts/parse-questions.mjs
      - name: commit json
        run: |
          git config user.name "github-actions"
          git add quiz-app/public/questions.json
          git diff --staged --quiet || git commit -m "chore: rebuild questions.json"
          git push
```

## 迁移步骤

1. `git mv interview-bank banks/ai-agent`(15 文件 + README)
2. 新建 `banks/ai-agent/meta.yaml`,从 README 提取 15 个模块清单
3. 写 `quiz-app/scripts/parse-questions.mjs`,跑通生成 `questions.json`
4. 配 CI,验证现有 147 题能通过严格校验
5. 搭 React+Vite 骨架,实现四个页面
6. 实现 SM-2 + storage,接通答题流

## 扩展性(设计核心)

加新分类 = 新建 `banks/xxx/` + meta.yaml + md 文件,解析器自动发现,前端自动出现新卡片,**零代码改动**。这是整个设计最值钱的地方。
