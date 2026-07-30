# 模块 04：多 Agent 框架与编排

> **优先级：⚡ 高频**　**覆盖 JD：JD1/2/3（LangChain / LangGraph / AutoGen / Spring AI 均为明确要求）**
> 考察框架的实操经验和选型能力。面试官想看的是"你为什么选这个框架"而非"你用过什么"。

## 知识地图：主流框架对比

| 框架 | 特点 | 适用场景 |
|---|---|---|
| **LangChain** | 链式编排、LCEL、生态丰富 | 线性流程、快速原型 |
| **LangGraph** | 图结构、状态机、循环、human-in-loop | 复杂 Agent、需循环/断点/人工介入 |
| **AutoGen** | 0.2 为对话式多 Agent；**0.4（2025）已重写为 actor 模型**（事件驱动、可扩展、内置可观测） | 多 Agent 讨论/协作 |
| **Spring AI** | Java 生态、企业级 | Java 技术栈团队 |
| **CrewAI** | 角色化（crew + task）、简单 | 业务流程编排 |
| **MetaGPT** | SOP 驱动、软件公司模拟 | 软件开发流程模拟 |
| **Dify / Coze / n8n / FastGPT** | 低代码/可视化编排 | 国内业务快速搭建、非纯代码团队 |

---

## 题目

### Q04.1【高·必问】为什么用 LangGraph 而不是直接 LangChain？

**考察点：** 框架选型能力——这是 LangGraph 相关岗位的必问题。

**参考答案要点：**
- **LangChain 的局限**：本质是链式（DAG）调用，难以表达**循环（cycles）、显式状态管理、断点恢复、人工介入**。
  - 注意:LangChain 的 LCEL 其实也能做条件路由（`RunnableBranch`），所以"条件分支"不是 LangGraph 的独占优势,真正不可替代的是**循环 + 显式 state + checkpoint + HITL**。
- **LangGraph 的优势**：
  - **图结构**：节点 = 步骤，边 = 流转，天然支持复杂控制流；
  - **状态机**：显式 state，节点返回 state 更新；
  - **循环**：支持循环边（如 ReAct 的 thought-act-observe 循环、反思重试）；
  - **断点恢复**：checkpoint 持久化，长任务可续跑（对应 Q09.6）；
  - **human-in-the-loop**：可在某节点暂停等人工确认再继续（对应 Q10.8）。
- **结论**：纯线性简单流程用 LangChain；涉及循环/状态持久化/断点恢复/人工介入的复杂 Agent 用 LangGraph。

---

### Q04.2【中】LangGraph 的 state 怎么在节点间传递？

**考察点：** LangGraph 的核心机制理解。

**参考答案要点：**
- **State 定义**：用 TypedDict（或 dataclass）定义状态结构。
- **传递机制**：
  - 每个节点接收当前 state，执行后返回 state 的**部分更新**（dict）；
  - 框架自动 merge 到全局 state。
- **Reducer(合并策略,新手最常踩的坑)**:
  - LangGraph 用 `Annotated[list, operator.add]` 之类声明字段的合并方式;
  - **默认是覆盖**——若 list 字段不声明 reducer,节点返回新 list 会**直接覆盖**而非追加,这是新手最常踩的坑;
  - 需追加就显式声明 `add` reducer。
- **checkpoint**：state 可持久化到 checkpointer（内存 / SQLite / Postgres），支持断点恢复。
- **共享与隔离**：全局 state 共享；并行分支的中间结果可隔离。
- **并发写共享 state 的竞态**:多个 worker 并行写同一字段需注意一致性,可用 reducer 聚合或隔离各分支结果再汇总。

---

### Q04.3【高·系统设计】你的 Agent 是有状态的长任务，服务重启后怎么办？

**考察点：** 状态持久化与恢复（生产级核心）。

**参考答案要点：**
- **状态外置**：所有执行状态存外部存储（DB / 文件 / Redis），不靠进程内存。
- **checkpoint 机制**：
  - 每个关键节点执行后 checkpoint；
  - 记录已完成节点、当前进度、中间产物。
- **恢复流程**：
  - 重启后从存储加载最近 checkpoint；
  - 跳过已完成节点，从断点继续；
  - 子任务幂等设计，重试不会产生副作用。
- **超时与心跳**：长任务要有心跳机制，判断任务是否真死。
- **工具**：LangGraph checkpointer、Celery 任务队列、工作流引擎（Temporal / Airflow）。

---

### Q04.4【中】AutoGen 和 LangGraph 解决的问题有什么不同？

**考察点：** 多 Agent 框架的差异化理解。

**参考答案要点：**
- **AutoGen**：聚焦**多 Agent 对话协作**——定义不同角色（如 coder、critic、user_proxy），通过对话推进任务。适合"讨论型 / 迭代改进型"任务。
- **LangGraph**：聚焦**控制流编排**——用图定义精确的执行流程，多 Agent 只是其中一种节点组合。适合需要精确控制流转的场景。
- **选型**：
  - 任务流程清晰、要精确控制 → LangGraph；
  - 任务靠多角色自由讨论推进、流程不固定 → AutoGen；
  - 生产级稳定性要求高 → 倾向 LangGraph（可控性强）。

---

### Q04.5【中高】什么时候不该用多 Agent？单 Agent + 工具就够了？

**考察点：** 避免过度设计——这是 senior 的判断力体现。

**参考答案要点：**
- **单 Agent 够用的场景**：
  - 任务单一、流程短；
  - 不需要多角色视角；
  - 延迟 / 成本敏感（多 Agent 通信开销大）。
- **需要多 Agent 的场景**：
  - 任务复杂，需不同专业角色（如研究 + 写作 + 审核）；
  - 需要"分而治之"，子任务可并行；
  - 需要制衡（critic 角色防幻觉）；
  - 不同子任务用不同模型 / 工具集。
- **核心判断**：多 Agent 的复杂度、延迟、成本都更高，**不要为了多而多**。先单 Agent，证明不够再拆。
- **成本量化(硬论据)**:多 Agent 因角色 prompt 常驻 + Agent 间消息传递 + 各自维护独立上下文,**token 消耗通常是单 Agent 的 3~10 倍**,延迟也近似线性增长——这是"不该用多 Agent"最硬的论据。

---

### Q04.6【中】human-in-the-loop（HITL）在 Agent 框架里怎么实现？

**考察点：** 人机协作的工程实现。

**参考答案要点：**
- **场景**：高危操作前确认、模糊意图澄清、Agent 卡住时求助。
- **实现**：
  - **LangGraph**：在节点后加 interrupt / breakpoint，暂停执行，等待外部输入（approve / reject / 修改参数），再恢复；
  - **状态持久化**：暂停期间状态不丢；
  - **异步通知**：通过 webhook / 消息通知用户，用户响应后回调恢复。
- **超时处理**：等待超时要有默认策略（拒绝 / 转人工）。
- **审计**：所有人工干预记录留痕。

---

### Q04.7【高】你如何评估一个 Agent 框架是否适合生产？

**考察点：** 框架评估的工程视角。

**参考答案要点：**
- **稳定性**：错误处理、重试、超时机制是否完善；
- **可观测性**：是否原生支持 trace / metrics；
- **状态管理**：是否支持 checkpoint / 持久化 / 恢复；
- **性能**：并发支持、异步模型、资源占用；
- **可控性**：能否精确控制流程、注入人工干预；
- **生态与维护**：社区活跃度、文档、版本稳定性；
- **可扩展性**：自定义节点 / 工具 / 模型的成本；
- **成本**：框架自身开销（额外 LLM 调用、抽象损耗）；
- **抽象损耗 / debug 难度**:抽象越重报错越难定位(黑盒),senior 评估时常被追问。

---

### Q04.8【高·必问】MCP 和 A2A 是什么?有什么区别?

**考察点:** 2025-2026 多 Agent 领域两个事实级协议(必问趋势题)。

**参考答案要点:**
- **MCP(Model Context Protocol, Anthropic)**:标准化 **Agent ↔ 工具/数据源** 的连接。
  - 解决"工具接入"的 N×M 问题(见模块 08 Q08.4);
  - **连的是工具/资源**。
- **A2A(Agent-to-Agent Protocol, Google 2025)**:标准化 **Agent ↔ Agent** 的连接与协作。
  - 核心概念:**Agent Card**(声明 Agent 能力)、任务委派、跨厂商 Agent 互操作;
  - **连的是 Agent**。
- **区别(一句话)**:**MCP 连工具,A2A 连 Agent**——二者互补,不冲突。
  - 一个 Agent 可以既通过 MCP 调用工具,又通过 A2A 与其他 Agent 协作。
- **工程意义**:这是 Agent 从"单体内嵌"走向"开放生态"的关键基础设施,类似微服务时代的 API 标准。

---

### Q04.9【中】多 Agent 有哪些常见的拓扑(编排)结构?

**考察点:** 编排结构的系统分类(本模块作为"编排专题"应有)。

**参考答案要点:**
| 拓扑 | 结构 | 特点 | 对应框架/模式 |
|---|---|---|---|
| **Sequential(顺序)** | A→B→C | 简单、可预测 | CrewAI 默认 |
| **Hierarchical(层级)** | supervisor 调度多个 worker | 可控、收敛 | LangGraph supervisor |
| **Parallel / Fan-out-Fan-in** | 一任务拆多路并行,再汇总 | 提速、分治 | LangGraph 并行节点 |
| **Star(星型)** | 中心 Agent 与多个外围 | 中心化协调 | supervisor 变体 |
| **Mesh(网状)** | Agent 间自由通信 | 灵活但易混乱 | AutoGen 对话式 |

- **选型**:可控性要求高用 hierarchical;需并行用 fan-out-fan-in;mesh 仅用于探索性协作且必须有终止机制。

---

## 自查 Checklist

- [ ] 能说清 LangChain vs LangGraph 的本质差异和选型依据
- [ ] 理解 LangGraph 的 state 传递、reducer 机制与 checkpoint
- [ ] 能设计有状态长任务的恢复方案
- [ ] 能判断什么时候该用多 Agent、什么时候不该(含量化成本)
- [ ] 知道 HITL 的实现方式
- [ ] 能从生产视角评估一个 Agent 框架
- [ ] 能讲清 MCP 与 A2A 的区别(MCP 连工具,A2A 连 Agent)
- [ ] 能说出多 Agent 的常见拓扑结构
