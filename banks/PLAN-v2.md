# 题库结构化迁移 + 质量检测管线 - 实现方案 v2

> 经 5 轮 grilling 审视后的定稿。核心翻转:md 源 -> YAML 源,解析器退役。

## 决策汇总

| 维度 | 决定 |
|---|---|
| 数据源 | YAML 为源(每模块一个文件),前端直接消费 |
| 解析器 | parse-questions.mjs 退役,build.mjs 只做校验+合并 |
| 清洗管线 | 通用 AI prompt + clean.mjs,各源复用(输入任意格式原料->输出 YAML) |
| 质量检测 | 两步走审改分离:audit.mjs 生成报告,fix.mjs 高置信度自动改 |
| 格式门槛 | answer 总字数 < 50 判不合格,build.mjs 强制 |
| 覆盖度 | 不做 |

## 目录结构

```
banks/
├── agent/
│   ├── meta.yaml              # 分类元信息
│   ├── 01-agent-core.yaml     # 每模块一个 YAML
│   └── ... 15-*.yaml
├── fe/
│   ├── meta.yaml
│   ├── 01-ai.yaml
│   └── ... 19-*.yaml
├── clean/                     # 清洗管线
│   ├── PROMPT.md              # AI 清洗 prompt
│   ├── clean.mjs              # 清洗脚本
│   └── sources/               # 原料暂存
└── audit/                     # 质量检测管线
    ├── audit.mjs              # AI 批审 -> 报告
    ├── fix.mjs                # 自动修正
    └── reports/               # 审查报告
```

## YAML 题库格式

`banks/agent/01-agent-core.yaml`:

```yaml
module: 1
moduleName: Agent 核心机制
questions:
  - id: "01.1"
    difficulty: 中
    tags: []
    title: "讲讲 ReAct 和 Plan-and-Execute 的区别？"
    focus: "理解两种主流规划范式的本质差异。"
    answer:
      - "**ReAct**：边想边做。"
      - "适合：任务步数不定。"
      - "**Plan-and-Execute**：先一次性生成完整计划。"
    followups:
      - "为什么 ReAct 容易跑偏？"
  - id: "01.2"
    difficulty: 中
    tags: []
    title: "..."
    focus: "..."
    answer:
      - "..."
    followups: []
```

## build.mjs(替代 parse-questions.mjs)

职责:校验 + 合并,无文本切分。

1. 扫 `banks/*/meta.yaml` 收集分类
2. 读每个模块 YAML,校验字段完整性
3. 合并成 `quiz-app/public/questions.json`(前端格式不变)
4. 全局 id 唯一性校验

校验规则(严格,exit 1):
- 每题必须有 id/difficulty/title/focus/answer
- difficulty 只能是 初/中/高
- answer 是数组且总字数 ≥ 50
- id 全局唯一

## 清洗管线(clean/)

**PROMPT.md** - AI 清洗指令,输入任意格式原料,输出严格符合 schema 的 YAML。

**clean.mjs** - 读原料 -> 调 AI(带 PROMPT)-> YAML -> build.mjs 校验 -> 落盘。

新分类流程:原料丢 `clean/sources/` -> `node clean.mjs <原料> <slug>` -> AI 输出 YAML -> 校验落盘。

## 质量检测(audit/,两步走审改分离)

**Step 1 - audit.mjs**:
- 读所有 YAML 题目
- 格式检查:answer 总字数 < 50 标记
- AI 审查:每题答案喂 LLM,判硬错误+给修正建议+置信度
- 输出 `audit/reports/YYYY-MM-DD.md`

**Step 2 - fix.mjs**:
- 读报告,筛"置信度:高"
- 对每项调 AI 修正答案
- 修正后跑 build.mjs 校验,通过则写回 YAML
- 低置信度不动,留报告里人工看

## 迁移步骤

1. migrate.mjs:现有 md -> YAML(agent 15 + fe 19 文件)
2. build.mjs:YAML -> questions.json
3. 删除 parse-questions.mjs + convert-fe.mjs
4. clean/PROMPT.md + clean.mjs
5. audit/audit.mjs + audit/fix.mjs
6. 前端不动(questions.json 格式没变)
7. 跑一轮 audit,生成首份质量报告
