# 模块 02：LLM 三大应用范式

> **优先级：⚡ 高频**　**覆盖 JD：JD1/2/3/4（全员要求 Prompt / Context / Function Calling）**
> 这是 LLM 应用的基本功，几乎所有 JD 都列为必备。重点考察对三大范式的理解深度与实操经验。

## 知识地图

### ① Prompt Engineering（提示工程）
- 基础：Zero-shot、Few-shot、CoT、Self-Consistency
- 结构：角色设定、输出格式约束（JSON Schema）、负面指令
- 进阶：思维链变体（ToT、GoT）、自问自答、ReAct prompt 模板
- 工程：版本管理、A/B 测试、Prompt 模板化

### ② Context Engineering（上下文工程）
- 窗口管理：Token 预算分配、长文本截断、信息丢失（lost in the middle）
- 信息优先级：system > few-shot > retrieved > history
- 压缩：分段摘要、滑动上下文、上下文裁剪
- 加载策略：按需加载（RAG）、分级加载

### ③ Function / Tool Calling（函数调用）
- 原理：模型按 JSON Schema 输出结构化调用
- 工具描述：description、parameters schema 质量
- 多工具：歧义处理、参数缺失追问
- 并行：parallel function calling
- 错误：参数校验、自动纠错重试

---

## 题目

### Q02.1【中】讲讲 CoT、Self-Consistency、ToT 的区别和适用场景。

**考察点：** 推理范式的系统理解。

**参考答案要点：**
- **CoT**：单条思维链，逐步推理。适合多数常规推理任务。代价小。
  - 区分 **Zero-shot CoT**(直接加"Let's think step by step"触发)与 **Few-shot CoT**(给带推理过程的示例)。
- **Self-Consistency**：采样多条 CoT，投票取多数结果。提升准确性，但成本翻倍（多次采样）。适合有明确答案的任务（数学、逻辑）。
  - **关键前提**:需配合**较高 temperature / top-p**采样,否则多条推理路径趋同,投票无意义(这是落地常踩的坑)。
- **ToT**：树形探索，每步多分支 + 评估 + 剪枝。适合需要回溯的复杂问题（规划、创意）。成本最高。
  - 代价来源:分支因子 b、深度 d 下节点数 ~b^d,搜索算法(BFS/DFS)+ 状态评估器(LLM 打分/投票)成本远高于线性 CoT。
- **选型**：成本 CoT < Self-Consistency < ToT；复杂度反向递增。生产中绝大多数场景用 CoT 即可。

---

### Q02.2【高·必问】给你一个 8K context 的任务，但信息塞不下，怎么办？

**考察点：** Context Engineering 的实战能力。

**参考答案要点：**
- **优先做减法**：
  - 评估每段信息的必要性，砍无关内容；
  - 历史对话摘要压缩（rolling summary）；
  - 只保留最近 N 轮 + 关键信息常驻 system。
- **检索替代塞入**：
  - 把信息外置到向量库，按需检索（RAG 思路）；
  - 分级加载（先加载摘要，需要细节时再查）。
- **结构优化**：
  - 关键信息前置（避免 lost in the middle）；
  - 减少冗余的 few-shot，精选高价值示例。
- **换模型**：长上下文模型（128K / 200K），但要权衡成本和"大海捞针"衰减（长上下文单价更高，且中段召回率显著下降）。
- **复用(Prompt / 语义缓存)**:与前两步正交——能用缓存就别重算。
  - **Prompt Caching**:Anthropic/OpenAI 原生支持,稳定前缀(如 system prompt、长文档)的 KV Cache 复用,命中即降价降延迟;关键是**前缀必须逐 token 完全一致**(中间任何变化都会断开命中),所以稳定内容放最前、动态内容放最后;
  - **语义缓存**:相似 query 命中历史结果(embedding 相似度判断),适合容错场景,注意私有数据不能跨用户共享。

**追问方向：** 长上下文模型（如 1M context）是否就解决问题了？（不一定，长上下文有 needle-in-haystack 衰减、成本高、注意力分散）

---

### Q02.3【中】Few-shot 示例怎么选才有效？

**考察点：** Few-shot 的工程实践。

**参考答案要点：**
- **相关性**：选与当前 query 最相似的示例（可用 embedding 检索动态选）。
- **多样性**：覆盖不同子场景和边界 case，避免模型过拟合到单一模式。
- **质量**：示例必须正确、规范（错例会带坏模型）。
- **数量**：3~5 个通常够；过多占 context 且边际递减。
- **格式一致**：示例的输入输出格式要统一，引导模型对齐。
- **进阶**：动态 few-shot（按 query 实时检索示例）优于静态固定。

---

### Q02.4【高·必问】为什么模型调用了错误的工具？怎么排查？

**考察点：** 工具调用问题的诊断能力。

**参考答案要点：**
- **排查链路**：
  - 看 trace 中模型选择工具时的候选概率分布（是否多个工具分都接近）；
  - 检查 tool description 是否清晰、是否有歧义；
  - 检查 prompt 是否给了错误引导；
  - 检查工具数量是否过多（选择爆炸）。
- **常见根因**：
  - 工具描述模糊或重叠（两个工具都能干同一件事）；
  - description 缺少"什么时候不该用"的反例；
  - 工具太多（>20 个时选择准确率下降明显）。
- **改进**：
  - 重写 description（加 example、加 use-case、加边界）；
  - 工具分组 / 分层检索（先选类，再选具体工具）；
  - 适当降温度。

**追问方向：** 工具有 50 个，模型选不过来怎么办？（工具检索 / 路由：先用 embedding 检索 top-k 相关工具再选）

---

### Q02.5【中】Function Calling 和直接让模型输出 JSON，有什么区别？为什么用前者？

**考察点：** 对 function calling 价值的理解。

**参考答案要点：**
三种获取结构化输出的路径(常考辨析):
- **直接输出 JSON**:靠 prompt 约束 + 后处理解析,不稳定(模型可能加废话、格式错、漏字段)。
- **Function Calling**:模型经专门训练,按 JSON Schema 输出,可靠性高;还能并行调用、返回工具结果继续对话。
- **JSON Mode / 受约束解码(第三条路)**:
  - **JSON Mode**(OpenAI `response_format=json_schema`、strict mode):provider 在解码时强制输出合法 JSON;
  - **受约束解码(grammar-constrained decoding)**:Outlines / Guidance / xgrammar / llama.cpp grammar,在生成阶段用 schema/CFG 约束每一步可选 token,**可靠性最高**,但牺牲一定多样性;
  - **数据校验驱动重试**:`instructor` / pydantic,校验失败自动喂回重试;搭配**容错解析**(json-repair / partial JSON parser)处理不完整 JSON。
- **Function Calling 优势**:结构化保证、参数校验、原生支持多轮(工具结果回灌)、provider 优化过。
- **注意**:无论哪种方式仍要做参数校验(模型也可能出错),只是出错率显著降低。

---

### Q02.6【初】Prompt Engineering 和 Context Engineering 的区别是什么？

**考察点：** 概念辨析（JD1/2/3/4 都明确区分这两个词）。

**参考答案要点：**
- **Prompt Engineering**：关注"**怎么问**"——如何组织指令、示例、格式，让模型更好地理解任务。
- **Context Engineering**：关注"**塞什么、塞多少、什么时候清**"——管理进入上下文的信息流，解决窗口有限与信息爆炸的矛盾。
- **关系**：Context Engineering 是 Prompt Engineering 的升级概念，更强调动态信息管理，而非静态指令设计。Agent 场景下 Context Engineering 更关键（因为信息是动态流入的）。

---

### Q02.7【中】什么是 parallel function calling？有什么好处和坑？

**考察点：** 多工具并行的理解。

**参考答案要点：**
- **原理**：模型一次输出多个独立的工具调用，工程侧并行执行，结果一起返回。
- **好处**：降延迟（串行→并行）、提升效率。
- **坑**：
  - 只有**无依赖**的调用才能并行，有依赖的仍需串行；
  - 模型可能错误地并行有依赖的操作 → 工程侧需校验依赖；
  - 错误处理变复杂（部分成功部分失败）；
  - 并发会放大下游压力。

---

## 自查 Checklist

- [ ] 能说清 CoT / Self-Consistency / ToT 的区别与选型
- [ ] 能给出 8K context 塞不下信息的多套方案
- [ ] 知道 Few-shot 示例的选取原则
- [ ] 能诊断工具调用错误并给出改进方案
- [ ] 能区分 Prompt Engineering 和 Context Engineering
