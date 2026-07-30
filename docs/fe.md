# ⚛️ 前端工程师 面试题库

_共 135 题。前端知识体系大纲清洗。按知识板块分组，板块内按 ⭐ 难度升序——循序渐进。_

## 目录

- [ai](#ai) — 4 题
- [algorithm](#algorithm) — 14 题
- [browser](#browser) — 16 题
- [cross-platform](#cross-platform) — 5 题
- [css](#css) — 11 题
- [design-pattern](#design-pattern) — 4 题
- [engineering](#engineering) — 7 题
- [js-principles](#js-principles) — 15 题
- [methodology](#methodology) — 3 题
- [micro-frontend](#micro-frontend) — 4 题
- [miniprogram](#miniprogram) — 3 题
- [nodejs](#nodejs) — 10 题
- [react](#react) — 20 题
- [scenario](#scenario) — 6 题
- [security](#security) — 4 题
- [software-design](#software-design) — 1 题
- [ssr](#ssr) — 1 题
- [typescript](#typescript) — 3 题
- [vue](#vue) — 4 题

---

## ai

### 1. 什么是 Function Calling？LLM 是怎么学会调用外部工具的？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ai-001`
> 标签：#Function Calling, #工具调用, #高频

**💡 一句话速记**

Function Calling 让 LLM 能根据用户意图，输出结构化的工具调用（函数名+参数），由外部代码执行后把结果喂回 LLM。本质是 LLM 经训练学会了「识别何时该用工具 + 生成合法的函数调用 JSON」，实际执行靠外部代码。

**📖 通俗详解**

**Function Calling 工作流程**：
1. 开发者定义一批工具（函数），每个工具有名称、描述、参数 schema。
2. 用户提问时，把「工具清单 + 用户问题」一起发给 LLM。
3. LLM 判断：需不需要用工具？用哪个？参数是什么？
4. LLM 输出结构化的工具调用（函数名 + 参数 JSON），而不是自然语言。
5. 外部代码执行这个函数，拿到结果。
6. 把结果喂回 LLM，LLM 据此生成最终回答。

**LLM 怎么学会的**：
- 不是 LLM 真的会执行代码。是经过专门训练（微调），学会识别工具描述、判断调用时机、生成符合 schema 的参数 JSON。
- 本质是「语言模型 + 结构化输出能力」。
- 训练数据里有大量「问题→该调哪个工具→参数是什么」的样本。

**和 RAG 的区别**：RAG 是检索文档给 LLM 参考（LLM 读）；Function Calling 是让 LLM 调用工具执行操作（LLM 做）。

**🔧 示例 / 代码**

场景：用户问「今天北京天气如何」。LLM 识别需要调天气工具，输出结构化调用：函数名 getWeather，参数 location=北京。外部代码执行 getWeather 拿到「晴 25℃」，喂回 LLM，LLM 生成自然回答「北京今天晴，25 度」。LLM 本身没执行 getWeather，是外部代码执行的。

**🔍 常见追问**

- Function Calling 和 MCP 有什么关系？（MCP 是标准化的工具访问协议）
- LLM 生成的参数不对（类型错/缺字段）怎么处理？
- 多个工具时，LLM 怎么选对的？描述写不好会怎样？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》AI 板块（含「function call」）+ 模型知识。建议结合 OpenAI Function Calling 文档核验。出处：doc/前端知识体系.md:215

---

### 2. SSE（Server-Sent Events）是什么？和 WebSocket 有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ai-003`
> 标签：#SSE, #流式输出, #EventSource, #高频

**💡 一句话速记**

SSE 是服务器单向推消息给浏览器的协议（基于 HTTP，服务器→客户端）。和 WebSocket 区别：SSE 单向（服务器推）、基于 HTTP、简单轻量、自动重连；WebSocket 双向、独立协议、更复杂。

**📖 通俗详解**

**SSE vs WebSocket**：

| 维度 | SSE | WebSocket |
|---|---|---|
| 方向 | 单向（服务器到客户端） | 双向 |
| 协议 | 基于 HTTP | 独立协议（ws） |
| 复杂度 | 简单 | 复杂 |
| 自动重连 | 内置 | 要自己实现 |
| 数据格式 | 文本（UTF-8） | 文本+二进制 |
| 适合 | 服务器推送（通知、流式输出） | 实时双向通信（聊天、游戏） |

**SSE 流式输出原理**：
- 服务器不是一次性返回完整回答，而是生成一段就推一段。
- 前端用 EventSource（或 fetch + ReadableStream）接收。
- 每收到一段就 append 到页面，形成逐字打出的效果。
- 这正是 ChatGPT 回答时的打字机效果——LLM 边生成边推，前端边接收边显示。

**为什么用 SSE 而非 WebSocket**：LLM 流式输出是服务器到客户端单向的，SSE 足够且更简单（基于 HTTP，穿透防火墙、自动重连、无需握手）。

**🔍 常见追问**

- EventSource 为什么不能设请求头？（只能 GET）怎么带 token？
- SSE 怎么处理断线重连？

---

**▶ 追问 1：前端怎么用 SSE 实现流式输出（如打字机效果）？请手写。**

**💡 一句话速记**

用 fetch 发请求（因为 EventSource 只支持 GET 且不能自定义 header），用 response.body.getReader() 读取流，每读到一段就解析并 append 到对话区，实现打字机效果。关键是用 ReadableStream 逐块读取，而非等完整响应。

**📖 通俗详解**

**两种实现方式**：

1. **fetch + ReadableStream（推荐，支持 POST 和自定义 header）**：
   - 因为 EventSource 只支持 GET 且不能设请求头，实际 LLM 接口多为 POST + 带 token，所以用 fetch。
   - `response.body.getReader()` 拿到流 reader，循环 `reader.read()` 逐块读取。
   - 每读到一段就用 TextDecoder 解码，解析 SSE 协议（`data:` 前缀），append 到页面。

2. **EventSource（简单场景，GET 接口）**：
   - `new EventSource(url)`，监听 `onmessage`。
   - 自动重连，但只能 GET、不能带 header。

**🔧 示例 / 代码**

```javascript
// fetch + ReadableStream 实现流式输出（ChatGPT 打字机效果）
async function streamChat(prompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token  // fetch 能带 header
    },
    body: JSON.stringify({ prompt })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // 解析 SSE 协议：按行切，处理 'data:' 前缀
    const lines = buffer.split('\n');
    buffer = lines.pop(); // 留最后可能不完整的行
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const text = line.slice(5).trim();
        if (text === '[DONE]') return;
        appendToDom(JSON.parse(text).content); // 逐字 append，打字机效果
      }
    }
  }
}

// 简单场景用 EventSource（仅 GET）
const es = new EventSource('/api/stream');
es.onmessage = (e) => appendToDom(e.data);
es.onerror = () => es.close();
```

**🔍 常见追问**

- fetch 流式读取（ReadableStream）和 EventSource 有什么区别？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》AI 板块（含「sse 的使用」）+ 模型知识。建议结合 MDN「Server-Sent Events」核验。出处：doc/前端知识体系.md:225

---

### 3. MCP（Model Context Protocol）是什么？它解决了什么问题？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ai-002`
> 标签：#MCP, #工具协议, #高频

**💡 一句话速记**

MCP 是 Anthropic 提出的「LLM 访问外部工具/资源的标准化协议」。解决「每个工具都要单独写适配、千差万别」的碎片化问题——用统一协议，所有工具按同一标准暴露能力，LLM/Agent 用同一套方式访问。类似 USB 之于外设。

**📖 通俗详解**

**MCP 解决的问题**：
- 传统：LLM 要用 GitHub、数据库、文件系统……每个都要写专门适配，接口各不相同，维护成本高。
- MCP：定义一套统一的协议规范，所有工具都按这套规范暴露能力。LLM/Agent 用统一 client 访问。

**MCP 的核心特点：上下文共享**：
- 不只是 RPC 返回数据，还能共享丰富上下文（代码结构、依赖关系、历史）。
- 让 LLM 决策更智能（比如知道文件间的依赖关系）。

**架构**：
- MCP Server：暴露能力（工具/资源）。
- MCP Client：LLM/Agent 侧调用。
- 支持多种传输（stdio、SSE、HTTP）。

**价值**：一处实现处处可用、生态复用、上下文增强。

**🔧 示例 / 代码**

类比：MCP 之于 AI 工具，就像 USB 之于电脑外设——统一接口，插上就能用，不用每个设备配专用驱动。开发者把服务做成 MCP Server，任何支持 MCP 的 Agent 都能用，不用为每个 Agent 单独适配。

**🔍 常见追问**

- MCP 和 Function Calling 什么关系？（Function Calling 是 LLM 能力，MCP 是工具访问协议）
- MCP Server 怎么开发？暴露一个工具要做什么？
- MCP 生态现在有哪些现成的 Server？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》AI 板块（含「mcp」）+ helloAgent 第10章 + 模型知识。建议结合 MCP 官方文档核验。出处：doc/前端知识体系.md:215

---

### 4. AI 如何改变前端研发流程？怎么高效使用 AI 编码工具（如 Cursor/Copilot）？如何保证 AI 生成代码的质量？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ai-004`
> 标签：#AI提效, #研发流程, #Prompt

**💡 一句话速记**

AI 贯穿研发全流程：需求（分析/拆解）、编码（生成/补全/重构）、测试（生成用例）、文档、CR（辅助审查）。高效用 AI 的关键：写好上下文和 Prompt、让 AI 做重复劳动、人做决策和审查。质量保证：必须人工 review、理解每行代码、写测试验证、不盲目信任。

**📖 通俗详解**

**AI 在研发流程的应用**：

1. **需求阶段**：AI 辅助分析需求、拆解任务、识别风险。
2. **编码阶段**（最大价值）：
   - 代码补全（Copilot）：写一句补一段。
   - 生成代码（Cursor Chat）：描述需求生成实现。
   - 重构/优化：让 AI 优化性能、改写法。
   - 解释代码：快速理解陌生代码。
3. **测试阶段**：生成单元测试、边界用例。
4. **文档**：生成注释、README、API 文档。
5. **Code Review**：AI 辅助发现潜在问题。

**高效使用 AI 的技巧**：
- **给足上下文**：AI 不知道你的项目背景，要把相关代码、规范、需求喂给它。
- **写好 Prompt**：明确目标、约束、期望输出格式。分步提问比一次性大问题效果好。
- **让 AI 做重复劳动**：样板代码、转换、批量修改交给 AI。
- **人做决策**：架构、选型、业务逻辑人来定，AI 辅助实现。
- **迭代对话**：AI 第一次生成不完美，追问修正。

**AI 生成代码的质量保证**：
1. **必须人工 review**：每行都要看懂，不能盲信。
2. **理解再采用**：不理解的不用，或先让 AI 解释。
3. **写测试验证**：AI 生成+测试覆盖，确保行为正确。
4. **注意安全**：AI 可能生成有漏洞的代码（XSS、注入），要审查。
5. **注意版权**：AI 可能复现训练数据里的代码。

**核心理念**：AI 是放大器——放大好工程师的能力（更快更好），也放大不负责的工程师的风险（生成一堆看不懂的烂代码）。关键在人。

**🔧 示例 / 代码**

高效用法举例：要实现一个复杂表单。先用 AI Chat 描述需求+项目用的组件库，让它生成初版；自己 review 调整业务逻辑；让 AI 补单元测试；让 AI 生成 JSDoc。AI 负责样板和重复，人负责业务正确性和架构。整个过程比自己手敲快 2-3 倍，但每一行都经人确认。

**🔍 常见追问**

- AI 生成的代码你怎么判断该不该用？
- AI 会不会取代前端？你怎么看？（AI 与程序员的关系）
- 团队引入 AI 编码工具，怎么制定规范防滥用？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》AI 板块（含「ai提效的方式」「ai生成的代码质量如何保证」「如何高效的编写提示词」）+ 模型知识。出处：doc/前端知识体系.md:209-220

---

## algorithm

### 5. 给定两个已排序数组，将它们合并成一个新的有序数组（或把 nums2 合并进 nums1 末尾的预留空间）。

> ⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-003`
> 标签：#数组, #双指针, #合并有序数组, #高频

**💡 一句话速记**

双指针从后往前（原地合并）或从前往后（新数组）依次比较填入，O(m+n) 时间。

**📖 通俗详解**

经典合并：两个数组各自有序，用两个指针 i、j 分别指向开头，比较后把较小者放入结果，移动对应指针；任一数组遍历完后，把另一个数组剩余部分直接接上。

LeetCode 88 变种（nums1 末尾预留 m 个空位，原地合并）：从**后往前**填，避免从前向后移动元素。三个指针：i 指向 nums1 有效末尾、j 指向 nums2 末尾、k 指向 nums1 总末尾。

复杂度：时间 O(m+n)，空间 O(1)（原地）。

**🔧 示例 / 代码**

```javascript
// 1) 合并成新数组
function mergeSorted(a, b) {
  const res = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    res.push(a[i] <= b[j] ? a[i++] : b[j++]);
  }
  while (i < a.length) res.push(a[i++]);
  while (j < b.length) res.push(b[j++]);
  return res;
}
console.log(mergeSorted([1, 3, 5], [2, 4, 6])); // [1,2,3,4,5,6]

// 2) LeetCode 88：原地从后往前合并
function mergeInto(nums1, m, nums2, n) {
  let i = m - 1, j = n - 1, k = m + n - 1;
  while (i >= 0 && j >= 0) {
    nums1[k--] = nums1[i] > nums2[j] ? nums1[i--] : nums2[j--];
  }
  while (j >= 0) nums1[k--] = nums2[j--];
}
const arr = [1, 3, 5, 0, 0, 0];
mergeInto(arr, 3, [2, 4, 6], 3);
console.log(arr); // [1,2,3,4,5,6]
```

**🔍 常见追问**

- 为什么 LeetCode 88 要从后往前合并？（从前会覆盖未处理元素）
- 如果要求合并 K 个有序链表/数组怎么做？（堆 / 分治两两合并）
- 能否用二分优化？（可以但常数更大，工程上没必要）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（合并两个有序数组）+ 模型知识。建议结合 LeetCode 88 核验。出处：doc/前端知识体系.md:254

---

### 6. 判断一个字符串（或整数）是否是回文。

> ⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-011`
> 标签：#回文, #双指针, #高频

**💡 一句话速记**

字符串：左右双指针向中间靠拢，逐字符比较。整数：转字符串同法，或反转数字后比较（注意溢出用 BigInt）。

**📖 通俗详解**

**回文串**：首尾对称，正读反读相同。双指针 i=0、j=len-1，向中间走，任一处不等则非回文。

**回文数字**（LeetCode 9）：两种思路：
1. 转字符串后双指针（简单，但题目有时要求不转）。
2. 反转一半数字：取出后半段反转，与前半段比较。如 1221 → 取出后两位 21 反转成 12，与前两位 12 相等即回文。注意奇数位（如 121）中间数字无所谓，反转后 /10 即可。

复杂度：O(n) 时间 O(1) 空间。

**🔧 示例 / 代码**

```javascript
// 回文串
function isPalindromeStr(s) {
  s = s.toLowerCase().replace(/[^a-z0-9]/g, ''); // 忽略大小写和非字母数字
  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) return false;
    l++; r--;
  }
  return true;
}
console.log(isPalindromeStr('A man, a plan, a canal: Panama')); // true

// 回文数字（不转字符串）
function isPalindromeNum(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false; // 负数 / 末尾0非0
  let reverted = 0;
  while (x > reverted) {
    reverted = reverted * 10 + x % 10;
    x = Math.floor(x / 10);
  }
  // 偶数位 x===reverted，奇数位 x===Math.floor(reverted/10)
  return x === reverted || x === Math.floor(reverted / 10);
}
console.log(isPalindromeNum(121));  // true
console.log(isPalindromeNum(-121)); // false
console.log(isPalindromeNum(10));   // false
```

**🔍 常见追问**

- 最长回文子串怎么求？（LeetCode 5，中心扩展 / Manacher）
- 最长回文子序列呢？（LeetCode 516，区间 DP）
- 回文数字为什么不直接反转整个数字再比？（反转可能溢出，反转一半更安全）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（回文串/回文数字）+ 模型知识。建议结合 LeetCode 9/125 核验。出处：doc/前端知识体系.md:261-262

---

### 7. 比较两个版本号 version1 和 version2（形如 `1.0.1`、`1.01`、`7.5.2.4`）。若 v1 > v2 返回 1，< 返回 -1，相等返回 0。

> ⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-012`
> 标签：#版本号, #字符串, #双指针, #高频

**💡 一句话速记**

按 `.` 切分成修订号数组，从左到右逐段比较（当作数字比，忽略前导零），某段短的补 0。

**📖 通俗详解**

版本号由若干修订号用 `.` 连接。比较规则：从左到右逐段比较每个修订号的**整数值**（忽略前导零，如 `01` == `1`）。若长度不一，缺失段按 0 处理。

步骤：
1. 用 split('.') 切分两个版本。
2. 取两者较长长度作为循环次数。
3. 每段用 Number() 转数字（自动去前导零），比较大小。
4. 全部相等则返回 0。

复杂度：O(max(m,n)) 时间，O(m+n) 空间。

注意坑：不能用字符串直接比（'10' < '2' 字典序错）；不能简单 parseFloat 整个串（会丢小数段信息）。

**🔧 示例 / 代码**

```javascript
function compareVersion(v1, v2) {
  const a1 = v1.split('.'), a2 = v2.split('.');
  const len = Math.max(a1.length, a2.length);
  for (let i = 0; i < len; i++) {
    const n1 = Number(a1[i] || 0); // 缺失补 0
    const n2 = Number(a2[i] || 0);
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

console.log(compareVersion('1.01', '1.001'));     // 0
console.log(compareVersion('1.0', '1.0.0'));      // 0
console.log(compareVersion('0.1', '1.1'));        // -1
console.log(compareVersion('7.5.2.4', '7.5.3'));  // -1
```

**🔍 常见追问**

- 带字母的语义化版本（如 1.0.0-alpha）怎么比？（semver 规范，预发版 < 正式版）
- 如果版本号段可能极大（超过 Number 范围）怎么办？（用 BigInt 或逐字符比较）
- semver 中 `^` 和 `~` 的区别？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（版本号比较）+ 模型知识。建议结合 LeetCode 165 核验。出处：doc/前端知识体系.md:267

---

### 8. 实现快速排序，并分析时间复杂度。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-001`
> 标签：#排序, #快速排序, #分治, #高频

**💡 一句话速记**

选一个基准（pivot），把小于 pivot 的放左、大于的放右，再对左右两段递归排序。

**📖 通俗详解**

快速排序核心是「分治 + 分区」。
1. 选 pivot（常见取中间、首、尾或随机，随机化可避免最坏情况）。
2. 分区（partition）：遍历数组，把元素按与 pivot 的大小关系分到两个数组。
3. 对左右子数组递归执行同样操作，再拼接。

复杂度：
- 平均时间 O(n log n)，最坏 O(n²)（数组已有序且 pivot 取端点）。
- 空间 O(log n)（递归栈），原地版本可做到 O(1) 额外空间。
- 不稳定排序。

工程上常配合「三数取中 / 随机 pivot」+「小数组切插入排序」来优化，V8 早期 Array.prototype.sort 即 TimSort（归并+插入）。

**🔧 示例 / 代码**

```javascript
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  // 取中间元素作 pivot，避免在有序数组上退化
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [], right = [], mid = [];
  for (const item of arr) {
    if (item < pivot) left.push(item);
    else if (item > pivot) right.push(item);
    else mid.push(item);
  }
  return [...quickSort(left), ...mid, ...quickSort(right)];
}

console.log(quickSort([3, 6, 8, 10, 1, 2, 1]));
// [1, 1, 2, 3, 6, 8, 10]
```

**🔍 常见追问**

- 快排最坏情况是什么？如何避免？（提示：有序数组 + 端点 pivot；随机化 pivot）
- 快排是稳定排序吗？为什么？（不稳定，分区时相等元素的相对顺序可能改变）
- 原地快排（in-place）怎么写？为什么要用双指针交换？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（快速排序）+ 模型知识。建议结合 LeetCode 912 / 维基百科核验。出处：doc/前端知识体系.md:252

---

### 9. 反转一个单链表（迭代与递归两种写法）。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-004`
> 标签：#链表, #链表翻转, #指针, #高频

**💡 一句话速记**

迭代：用 prev/curr 双指针，逐个把 next 指向前一个节点。递归：先翻转子链表，再把当前节点接到翻转后链表的末尾。

**📖 通俗详解**

反转链表是链表题的母题。

迭代法（推荐）：维护三个指针 prev、curr、next。每一步：先存 next = curr.next，再把 curr.next 指向 prev，然后 prev、curr 整体后移一位。循环到 curr 为 null，此时 prev 就是新头。

递归法：`reverse(head)` 返回翻转后的新头。先把 head.next 之后的部分翻转，得到 newHead；此时 head.next 仍是翻转后链表的尾节点，令 head.next.next = head 把 head 接到尾部，再断开 head.next = null 防止环。

复杂度：迭代 O(n) 时间 O(1) 空间；递归 O(n) 时间 O(n) 空间（栈）。

**🔧 示例 / 代码**

```javascript
class ListNode {
  constructor(val, next = null) { this.val = val; this.next = next; }
}

// 迭代
function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}

// 递归
function reverseListRec(head) {
  if (!head || !head.next) return head;
  const newHead = reverseListRec(head.next);
  head.next.next = head;
  head.next = null;
  return newHead;
}

// 构造 1->2->3->null
const list = new ListNode(1, new ListNode(2, new ListNode(3)));
let p = reverseList(list);
while (p) { console.log(p.val); p = p.next; } // 3 2 1
```

**🔍 常见追问**

- 如何只翻转链表中 [m, n] 区间的节点？（LeetCode 92，定位前驱后局部翻转）
- K 个一组翻转链表怎么做？（LeetCode 25，先数 k 个再翻转一段）
- 判断反转后链表是否正确（无环、长度一致）。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（链表翻转）+ 模型知识。建议结合 LeetCode 206 核验。出处：doc/前端知识体系.md:258

---

### 10. 判断链表中是否有环。如果有，能否找到环的入口节点？

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-005`
> 标签：#链表, #环形链表, #快慢指针, #高频

**💡 一句话速记**

判断有环：快慢指针（Floyd 判圈），快指针每次走 2 步、慢指针每次走 1 步，相遇即有环。找入口：相遇后让一个指针回到头，两者同速再走，再次相遇点就是入口。

**📖 通俗详解**

**Floyd 判圈算法（龟兔赛跑）**：
1. 快指针 fast 每次走 2 步，慢指针 slow 每次走 1 步。若无环，fast 先到 null；若有环，fast 终会追上 slow（在环内每轮拉近 1 步，必然相遇）。

**找环入口**（数学证明）：设头到入口距离 a、入口到相遇点 b、相遇点回入口 c。相遇时 slow 走 a+b，fast 走 a+b+n(b+c)。又 2(a+b)=a+b+n(b+c)，化简得 a = (n-1)(b+c)+c，即从头走 a 步 = 从相遇点再走 c 步（绕若干圈）。所以让一个指针从头开始、另一个从相遇点开始，每次各走 1 步，相遇点即入口。

复杂度：时间 O(n)，空间 O(1)。

**🔧 示例 / 代码**

```javascript
class ListNode {
  constructor(val, next = null) { this.val = val; this.next = next; }
}

// 1) 判断有环
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// 2) 找环入口
function detectCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      // 相遇后，一个从头开始同速走
      let p = head;
      while (p !== slow) { p = p.next; slow = slow.next; }
      return p;
    }
  }
  return null;
}

// 构造带环节点：3 -> 2 -> 0 -> -4 -> 回到 2
const n3 = new ListNode(3), n2 = new ListNode(2), n0 = new ListNode(0), n4 = new ListNode(-4);
n3.next = n2; n2.next = n0; n0.next = n4; n4.next = n2;
console.log(hasCycle(n3));      // true
console.log(detectCycle(n3).val); // 2
```

**🔍 常见追问**

- 为什么快慢指针一定能相遇，不会跳过？（每轮相对靠近 1 步）
- 用 Set 记录访问过的节点也能判环，空间复杂度是多少？（O(n)）
- 如果要求出环的长度怎么做？（相遇后让一个指针再走一圈计数）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（链表是否有环）+ 模型知识。建议结合 LeetCode 141/142 核验。出处：doc/前端知识体系.md:259

---

### 11. 给定一个只包含 `(`、`)`、`{`、`}`、`[`、`]` 的字符串，判断括号是否合法匹配。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-006`
> 标签：#栈, #括号匹配, #高频

**💡 一句话速记**

用栈：遇左括号入栈，遇右括号看栈顶是否是对应的左括号，匹配则出栈，最后栈空即合法。

**📖 通俗详解**

经典栈应用。思路：
1. 遍历每个字符。
2. 是左括号 → 压栈。
3. 是右括号 → 若栈空或栈顶不是其对应的左括号，则非法；否则弹栈。
4. 遍历完，栈空说明全部配对成功，合法。

用哈希表存「右括号 → 左括号」的映射，方便查对应关系。

复杂度：时间 O(n)，空间 O(n)（最坏全左括号）。

**🔧 示例 / 代码**

```javascript
function isValid(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if (ch === '(' || ch === '[' || ch === '{') {
      stack.push(ch);
    } else {
      if (stack.pop() !== map[ch]) return false;
    }
  }
  return stack.length === 0;
}

console.log(isValid('()[]{}')); // true
console.log(isValid('([)]'));   // false
console.log(isValid('{[]}'));   // true
```

**🔍 常见追问**

- 如果要返回最长合法括号子串长度怎么做？（LeetCode 32，栈存下标 / DP）
- 只用 O(1) 空间判断只有 `(` `)` 的字符串是否合法怎么做？（计数 left/right）
- 如何生成所有合法的 n 对括号组合？（LeetCode 22，回溯）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（括号匹配）+ 模型知识。建议结合 LeetCode 20 核验。出处：doc/前端知识体系.md:256

---

### 12. 在未排序数组中找到第 K 大的元素。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-007`
> 标签：#堆, #第K大, #TopK, #高频

**💡 一句话速记**

两种主流解法：①小顶堆维护 size=K，堆顶即第 K 大；②快速选择（quickSelect），平均 O(n)。

**📖 通俗详解**

**方法一：小顶堆**。维护一个大小为 K 的最小堆，遍历数组：元素数 < K 直接入堆；否则若当前值 > 堆顶，弹出堆顶再入。遍历完后堆顶就是第 K 大。时间 O(n log K)，空间 O(K)。适合 K 很小或数据流场景。

**方法二：快速选择**（推荐）。基于快排的分区：每轮随机选 pivot 分区后，pivot 落点 index 若 == n-K 即为答案；若 index < n-K 在右边找，否则在左边找。每轮规模减半，平均时间 O(n)，最坏 O(n²)（随机化 pivot 几乎不会退化）。空间 O(1)。

JS 没有内置堆，需手写或用排序（O(n log n)）兜底。

**🔧 示例 / 代码**

```javascript
// 方法一：最小堆（简化版，用数组模拟）
class MinHeap {
  constructor() { this.heap = []; }
  size() { return this.heap.length; }
  peek() { return this.heap[0]; }
  push(v) {
    this.heap.push(v);
    this._up(this.heap.length - 1);
  }
  pop() {
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length) { this.heap[0] = last; this._down(0); }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p] <= this.heap[i]) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }
  _down(i) {
    const n = this.heap.length;
    while (true) {
      let s = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.heap[l] < this.heap[s]) s = l;
      if (r < n && this.heap[r] < this.heap[s]) s = r;
      if (s === i) break;
      [this.heap[s], this.heap[i]] = [this.heap[i], this.heap[s]];
      i = s;
    }
  }
}
function findKthLargestHeap(nums, k) {
  const h = new MinHeap();
  for (const x of nums) {
    if (h.size() < k) h.push(x);
    else if (x > h.peek()) { h.pop(); h.push(x); }
  }
  return h.peek();
}

// 方法二：快速选择（原地）
function findKthLargestQuick(nums, k) {
  const target = nums.length - k; // 升序后第 k 大的索引
  const swap = (i, j) => [nums[i], nums[j]] = [nums[j], nums[i]];
  function partition(lo, hi) {
    const pivot = nums[lo + Math.floor(Math.random() * (hi - lo + 1))];
    // 三路：把 pivot 集中到中间
    let lt = lo, gt = hi, i = lo;
    while (i <= gt) {
      if (nums[i] < pivot) swap(i++, lt++);
      else if (nums[i] > pivot) swap(i, gt--);
      else i++;
    }
    if (target < lt) return partition(lo, lt - 1);
    if (target > gt) return partition(gt + 1, hi);
    return pivot;
  }
  return partition(0, nums.length - 1);
}

console.log(findKthLargestHeap([3,2,1,5,6,4], 2)); // 5
console.log(findKthLargestQuick([3,2,1,5,6,4], 2)); // 5
```

**🔍 常见追问**

- 数据流场景下如何动态维护第 K 大？（LeetCode 703，固定大小堆）
- 快速选择为什么平均 O(n)？（每轮只剩一半规模，n+n/2+n/4+...=2n）
- 海量数据求 TopK 怎么做？（分桶 + 归并，或外部排序）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（寻找数组中第K大的数字）+ 模型知识。建议结合 LeetCode 215 核验。出处：doc/前端知识体系.md:255

---

### 13. 给定股票每日价格，只能买卖一次，求最大利润（买卖股票的最佳时机）。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-010`
> 标签：#动态规划, #股票, #高频

**💡 一句话速记**

遍历过程中维护「历史最低价」minPrice，每天算「当天卖出能赚多少 = price - minPrice」，取最大值。

**📖 通俗详解**

**LeetCode 121（一次交易）**：
- 维护两个变量：minPrice（到当前为止的最低价）、maxProfit（最大利润）。
- 遍历每天价格：先更新 maxProfit = max(maxProfit, price - minPrice)，再更新 minPrice = min(minPrice, price)。
- 一趟 O(n)，空间 O(1)。

本质是 DP：第 i 天卖出的最大利润 = 当天价 - 前 i 天最低价。

延伸（不必都写，了解）：
- 122 多次交易：贪心，所有上涨段都吃。
- 123/188 限次数：状态机 DP（持有/不持有 + 已交易次数）。
- 309 含冷冻期：多一个冷冻状态。

**🔧 示例 / 代码**

```javascript
// 一次交易
function maxProfit(prices) {
  let minPrice = Infinity, maxProfit = 0;
  for (const price of prices) {
    if (price < minPrice) minPrice = price;
    else if (price - minPrice > maxProfit) maxProfit = price - minPrice;
  }
  return maxProfit;
}

console.log(maxProfit([7,1,5,3,6,4])); // 5 (1买6卖)
console.log(maxProfit([7,6,4,3,1]));   // 0

// 122 多次交易（贪心）
function maxProfit2(prices) {
  let profit = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) profit += prices[i] - prices[i - 1];
  }
  return profit;
}
```

**🔍 常见追问**

- 允许多次买卖（122）怎么做？为什么贪心是对的？
- 最多允许 k 次交易（188）状态怎么设计？（dp[i][k][0/1]）
- 含冷冻期 / 手续费怎么改状态转移？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（股票卖出的最佳时机）+ 模型知识。建议结合 LeetCode 121/122 核验。出处：doc/前端知识体系.md:260

---

### 14. 实现对象的深度优先遍历（DFS）与广度优先遍历（BFS）。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-013`
> 标签：#DFS, #BFS, #遍历, #树, #高频

**💡 一句话速记**

DFS 用递归（或栈）一路向下钻；BFS 用队列一层一层扫。两者都需 visited 集合防环。

**📖 通俗详解**

前端常考「对象/树」的遍历（区别于图，但写法类似）。

**DFS（深度优先）**：递归最自然——先处理当前节点，再依次递归所有子节点。也可用栈迭代。适合「找最深路径」「树形菜单折叠」。

**BFS（广度优先）**：用队列，先进先出。当前层所有节点处理完才进下一层。适合「最短路径」「按层输出」「找最近的目标」。

**防环**：对象可能有循环引用（如 a.b = a），需用 Set 记录已访问对象，避免死循环。WeakSet 更合适（不阻止 GC）。

复杂度：均 O(V+E)。

**🔧 示例 / 代码**

```javascript
const tree = {
  name: 'root',
  children: [
    { name: 'A', children: [{ name: 'A1' }, { name: 'A2' }] },
    { name: 'B', children: [{ name: 'B1' }] }
  ]
};

// DFS（递归）
function dfs(node, out = []) {
  if (!node) return out;
  out.push(node.name);
  (node.children || []).forEach(c => dfs(c, out));
  return out;
}
console.log(dfs(tree)); // ['root','A','A1','A2','B','B1']

// DFS（迭代，用栈）
function dfsIter(root) {
  const out = [], stack = [root];
  while (stack.length) {
    const node = stack.pop();
    out.push(node.name);
    // 倒序入栈保证从左到右访问
    (node.children || []).reverse().forEach(c => stack.push(c));
  }
  return out;
}

// BFS（队列）
function bfs(root) {
  const out = [], queue = [root];
  while (queue.length) {
    const node = queue.shift();
    out.push(node.name);
    (node.children || []).forEach(c => queue.push(c));
  }
  return out;
}
console.log(bfs(tree)); // ['root','A','B','A1','A2','B1']
```

**🔍 常见追问**

- 如何检测对象的循环引用？（DFS/BFS + WeakSet，或 JSON.stringify 捕获异常）
- 深拷贝时如何用 DFS 处理循环引用？（WeakMap 缓存已拷贝对象）
- 二叉树的 DFS 三种序（前/中/后）怎么区分？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（对象的深度优先遍历/广度优先遍历）+ 模型知识。建议结合 LeetCode 144/102 核验。出处：doc/前端知识体系.md:249-250

---

### 15. 用两个队列实现一个栈，支持 push / pop / top 操作。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 📈中频 · `fe-algo-014`
> 标签：#栈, #队列, #数据结构, #高频

**💡 一句话速记**

两种实现：①push 时把新元素加到空队列 q2，再把 q1 全部倒进 q2，交换 q1/q2（保证 q1 队首始终是栈顶）；②pop 时把 q1 前 n-1 个倒进 q2，剩最后一个弹出。

**📖 通俗详解**

**思路**：栈是 LIFO，队列是 FIFO。用两个队列互相倒腾，让「最后进的元素」跑到队首。

**方案 A（push O(n)，pop O(1)）**：
- push：把元素入 q2；把 q1 的全部元素依次出队再入 q2（这样新元素在队首）；最后交换 q1、q2。
- pop：直接 q1 出队。
- top：q1 队首。

**方案 B（push O(1)，pop O(n)）**：
- push：直接入 q1。
- pop：把 q1 前 n-1 个元素依次搬到 q2，剩最后一个出队作为返回值，再交换 q1、q2。

前端工程中更常用「双栈实现队列」（两个栈互相倒），但大纲明确要求「两队列实现栈」。

复杂度取决于方案选择，单次均摊可为 O(1)。

**🔧 示例 / 代码**

```javascript
class MyStack {
  constructor() {
    this.q1 = [];
    this.q2 = [];
  }
  // 方案 A：push 时调整，保证 q1 队首是栈顶
  push(x) {
    this.q2.push(x);
    while (this.q1.length) this.q2.push(this.q1.shift());
    [this.q1, this.q2] = [this.q2, this.q1]; // 交换
  }
  pop() {
    return this.q1.length ? this.q1.shift() : undefined;
  }
  top() {
    return this.q1[0];
  }
  empty() {
    return this.q1.length === 0;
  }
}

const s = new MyStack();
s.push(1); s.push(2); s.push(3);
console.log(s.top());  // 3
console.log(s.pop());  // 3
console.log(s.pop());  // 2
console.log(s.pop());  // 1
console.log(s.empty());// true
```

**🔍 常见追问**

- 反过来，用两个栈实现队列怎么做？（LeetCode 232，一个入栈一个出栈，出栈空了再倒）
- 方案 A 和方案 B 的均摊复杂度哪个更优？
- 能否用单个队列实现栈？（把新元素后的所有元素依次出队再入队）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（两个队列实现栈）+ 模型知识。建议结合 LeetCode 225 核验。出处：doc/前端知识体系.md:263

---

### 16. 归并排序和快速排序有什么区别？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-002`
> 标签：#排序, #归并排序, #分治, #稳定排序

**💡 一句话速记**

归并排序是「自顶向下分两半 → 递归排序 → 合并两个有序数组」，稳定且始终 O(n log n)，但需要 O(n) 额外空间。

**📖 通俗详解**

归并排序思路：
1. 分：把数组从中间一刀切成左右两半。
2. 治：对左右两半分别递归归并排序。
3. 合：用「合并两个有序数组」的思路，把两段有序子数组合成一个大的有序数组。

复杂度：
- 时间 O(n log n)（最佳/平均/最坏都是），分 log n 层，每层合并 O(n)。
- 空间 O(n)（合并时用的辅助数组）。
- 稳定排序（合并时相等元素取左边在前）。

与快排对比：归并稳定、最坏也是 O(n log n)，但要多 O(n) 空间；快排平均更快、可原地，但不稳定、最坏 O(n²)。链表排序首选归并（无需额外空间）。

**🔍 常见追问**

- 为什么归并排序是稳定的，而快排不是？
- 归并排序在链表上为什么比快排更合适？（链表合并不需要随机访问，O(1) 额外空间）
- 迭代版（自底向上）的归并排序怎么实现？避免了递归栈开销。

---

**▶ 追问 1：请手写实现归并排序。**

**💡 一句话速记**

分治：对半切到单个元素，再两两有序合并。时间O(nlogn)稳定排序，空间O(n)。

**📖 通俗详解**

mergeSort(arr)：if len<=1 return；mid=对半；left=mergeSort(前半)；right=mergeSort(后半)；return merge(left,right)。merge用双指针合并两个有序数组。

**🔧 示例 / 代码**

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

// 合并两个有序数组
function merge(a, b) {
  const res = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) res.push(a[i++]);
    else res.push(b[j++]);
  }
  while (i < a.length) res.push(a[i++]);
  while (j < b.length) res.push(b[j++]);
  return res;
}

console.log(mergeSort([5, 2, 8, 3, 9, 1]));
// [1, 2, 3, 5, 8, 9]
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（归并排序/合并两个有序数组）+ 模型知识。建议结合 LeetCode 912 / 维基百科核验。出处：doc/前端知识体系.md:253

---

### 17. 给定 n 个非负整数表示柱子的高度图，计算按此排列能接多少雨水。

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-008`
> 标签：#双指针, #接雨水, #hard, #高频

**💡 一句话速记**

每个位置能接的水 = min(左边最高, 右边最高) - 当前高度。可用动态规划预处理左右最大值，或用左右双指针 O(1) 空间。

**📖 通俗详解**

**核心公式**：位置 i 能接的雨水 = max(0, min(leftMax[i], rightMax[i]) - height[i])。

**解法演进**：
1. 暴力：每个位置左右各扫一遍求最大值，O(n²)。
2. 动态规划：预先 leftMax[] 和 rightMax[]，两次遍历，O(n) 时间 O(n) 空间。
3. **双指针（最优）**：左右两个指针 lo、hi，分别维护 leftMax、rightMax。哪边的 max 小就处理哪边：若 leftMax < rightMax，则左指针位置的水量由 leftMax 决定（右边一定有更高的挡着），处理左指针并右移；反之处理右指针。O(n) 时间 O(1) 空间。

直觉：水从矮的一侧决定，先处理矮的一侧不会错。

**🔧 示例 / 代码**

```javascript
// 双指针 O(1) 空间
function trap(height) {
  let lo = 0, hi = height.length - 1;
  let leftMax = 0, rightMax = 0, ans = 0;
  while (lo < hi) {
    if (height[lo] < height[hi]) {
      // 左边较矮，水量由 leftMax 决定
      height[lo] >= leftMax ? (leftMax = height[lo]) : (ans += leftMax - height[lo]);
      lo++;
    } else {
      height[hi] >= rightMax ? (rightMax = height[hi]) : (ans += rightMax - height[hi]);
      hi--;
    }
  }
  return ans;
}

console.log(trap([0,1,0,2,1,0,1,3,2,1,2,1])); // 6
console.log(trap([4,2,0,3,2,5]));               // 9
```

**🔍 常见追问**

- 如果柱子是二维的（盛水容器为 3D），怎么做？（LeetCode 407，优先队列 BFS）
- 单调栈解法怎么写？（按层接水，遇到凹槽出栈计算）
- 「盛最多水的容器」(LeetCode 11) 和接雨水有什么区别？（前者是两条线围成的面积，不是凹槽）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（接雨水）+ 模型知识。建议结合 LeetCode 42 核验。出处：doc/前端知识体系.md:270

---

### 18. 给定不同面额的硬币 coins 和总金额 amount，求凑成总金额所需的最少硬币数。每种硬币可使用无限次。

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-algo-009`
> 标签：#动态规划, #零钱兑换, #完全背包, #高频

**💡 一句话速记**

完全背包 DP：dp[i] 表示金额 i 的最少硬币数，dp[i] = min(dp[i], dp[i-coin]+1)，遍历所有 coin。

**📖 通俗详解**

**动态规划**：
- 状态：dp[i] 表示凑出金额 i 所需的最少硬币数。
- 转移：对每个硬币 coin，dp[i] = min(dp[i], dp[i - coin] + 1)（前提 i >= coin）。
- 初始化：dp[0] = 0，其余设为 Infinity。
- 答案：dp[amount]，若仍为 Infinity 返回 -1。

本质是「完全背包」求最小价值问题（每个物品无限件）。外层遍历金额、内层遍历硬币（顺序无关紧要，因为完全背包允许重复取）。

复杂度：时间 O(amount * coins.length)，空间 O(amount)。

变体：求组合数（LeetCode 518）则是计数型 DP，转移 dp[i] += dp[i-coin]，且要先遍历硬币再遍历金额（求组合数而非排列数）。

**🔧 示例 / 代码**

```javascript
function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let i = 1; i <= amount; i++) {
    for (const coin of coins) {
      if (i >= coin) dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}

console.log(coinChange([1, 2, 5], 11)); // 3 (5+5+1)
console.log(coinChange([2], 3));        // -1
```

**🔍 常见追问**

- 求组合方案数（而非最少硬币数）怎么改 DP？（dp[i] += dp[i-coin]，先遍历硬币）
- 贪心（每次取最大面额）为什么不一定对？（如 [1,3,4] amount=6，贪心取 4+1+1=3 枚，最优是 3+3=2 枚）
- 如果每种硬币只能用一次呢？（0-1 背包，金额从大到小遍历避免重复取）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》数据结构与算法板块（零钱兑换）+ 模型知识。建议结合 LeetCode 322 核验。出处：doc/前端知识体系.md:265

---

## browser

### 19. `setTimeout` 里的错误能否被外层 `try/catch` 捕获？为什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-003`
> 标签：#事件循环, #setTimeout, #错误处理, #高频

**💡 一句话速记**

不能。setTimeout 回调被放入宏任务队列，等执行时外层 try/catch 早已出栈，栈帧不连续无法捕获。

**📖 通俗详解**

**为什么捕获不到**：
- try/catch 只能捕获**同步调用栈**上的错误。
- setTimeout(fn, 0) 会把 fn 推入宏任务队列，**当前同步代码先执行完**，try/catch 块已经结束。
- 等事件循环下一轮取出 fn 执行时，它在**新的执行上下文**里抛错，外层栈早已销毁，catch 自然接不到。

**类比**：try/catch 像「现场保安」，只盯当前这间屋子；setTimeout 把错误挪到「下一栋楼」才发生，保安够不着。

**对比 Promise**：Promise 的 .catch 能捕获 reject，因为 Promise 把 rejection 显式建模成值；但**同步抛出的 unhandled rejection 仍需 .catch 兜底**，否则只是控制台报错。

| 异步类型 | try/catch | .catch | window.onerror |
|---|---|---|---|
| setTimeout 抛同步错 | ✗ | — | ✓ |
| Promise reject | ✗ | ✓ | ✓(unhandled) |
| async/await | ✓(用 await) | ✓ | ✓ |

**🔍 常见追问**

- async/await 里 await 一个会 reject 的 Promise，try/catch 能抓到吗？（能）
- 为什么 Promise.reject 不加 .catch 会报 unhandledrejection？

---

**▶ 追问 1：怎么解决 setTimeout 错误无法捕获的问题？**

**💡 一句话速记**

三种方案：①回调内部自己 try/catch ②返回 Promise 用 .catch ③监听 window error 事件做全局兜底。

**📖 通俗详解**

**三种解法**：
1. **回调内自行 try/catch**：在 setTimeout 的回调里包一层 try/catch。
2. **包装成 Promise**：把 setTimeout 包成 Promise，用 .catch 捕获。
3. **全局兜底**：监听 window 的 error / unhandledrejection 事件，做统一错误上报。

**🔧 示例 / 代码**

```javascript
// ✓ 方案1：回调内自行捕获
setTimeout(() => {
  try { throw new Error('boom'); }
  catch (e) { console.log('内部捕获', e); }
}, 0);

// ✓ 方案2：包装成 Promise
function delay(fn) {
  return new Promise((resolve, reject) => {
    setTimeout(() => { try { resolve(fn()); } catch (e) { reject(e); } }, 0);
  });
}
delay(() => { throw new Error('boom'); }).catch(e => console.log(e));

// ✓ 方案3：全局兜底
window.addEventListener('error', e => console.log('全局', e.error));
window.addEventListener('unhandledrejection', e => console.log(e.reason));
```

**🔍 常见追问**

- 如何做一个统一的异步错误上报？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「setTimeout 中的错误能否 catch 住」+ 模型知识。建议结合 MDN「try...catch」「unhandledrejection event」核验。出处：doc/前端知识体系.md:70

---

### 20. 什么是重绘（Repaint）和回流/重排（Reflow）？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-005`
> 标签：#重绘, #回流, #性能优化, #高频

**💡 一句话速记**

回流是重新算几何（位置/大小），重绘是重新填像素。回流必然引发重绘，重绘不一定引发回流。改 layout 属性（宽高/top/left）触发回流，改外观属性（color/background）只触发重绘。

**📖 通俗详解**

**回流（Reflow / Layout）**：当**几何信息**变化时，浏览器要重新跑 Layout 阶段。触发：增删 DOM、改宽高/margin/padding/位置、窗口 resize、读取 offsetWidth/getComputedStyle 等「强制同步布局」API。

**重绘（Repaint）**：只改**外观**（颜色、背景、阴影、visibility）时，跳过 Layout 直接重 Paint。

**关系**：回流 ⊃ 重绘（回流一定重绘，重绘不一定回流）。

**为什么卡**：Layout 和 Paint 都在主线程。回流成本远高于重绘（要重算整棵子树）。连续读写 DOM 交替会引发「**布局抖动 Layout Thrashing**」：读→改→读→改，每次读都强制浏览器立刻 flush 上次改动。

**类比**：回流是「重新装修房子」（敲墙改结构），重绘是「重新刷漆」。

**🔧 示例 / 代码**

```javascript
// ✗ 布局抖动：每次读都强制 flush
for (let i = 0; i < 100; i++) {
  el.style.width = box.offsetWidth + 10 + 'px'; // 读→写→读→写
}
```

**🔍 常见追问**

- 为什么读 offsetTop 会触发强制同步布局？
- transform 动画为什么不卡？（合成层 + GPU）
- 如何用 Chrome DevTools 排查布局抖动？

---

**▶ 追问 1：为什么改动 DOM 会卡？怎么减少重绘回流？**

**💡 一句话速记**

改 DOM 频繁触发回流（重算几何）会卡死主线程。减少手段：用 transform/opacity 做动画（合成层）、批量改样式、读写分离、脱离文档流、缓存 offset 值、用 DocumentFragment 批量插入。

**📖 通俗详解**

**为什么改动 DOM 会卡**：回流成本远高于重绘（要重算整棵子树），且 Layout 和 Paint 都在主线程，频繁触发会让主线程卡死。

**性能优化手段**：
1. 用 transform/opacity 做动画（合成层，跳过 Layout+Paint）。
2. 批量改样式：用 class 切换替代多次 style.xxx=。
3. 读写分离：先把所有「读」做完，再统一「写」。
4. 脱离文档流：absolute/fixed 元素回流不影响主文档。
5. 避免逐条访问 offsetWidth，缓存到变量。
6. 用 DocumentFragment 批量插入节点。

**🔧 示例 / 代码**

```javascript
// ✓ 先读后写，只触发一次回流
const width = box.offsetWidth; // 一次读
for (let i = 0; i < 100; i++) {
  el.style.width = width + 10 + 'px';
}
```

```css
/* ✓ 用 transform 代替 top/left，进合成层 */
.bad  { transition: top 0.3s;     top: 100px; }   /* 回流 */
.good { transition: transform .3s; transform: translateY(100px); } /* 只合成 */
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「减少重绘回流次数」+ 模型知识。建议结合 web.dev「Avoid large, complex layouts and layout thrashing」核验。出处：doc/前端知识体系.md:71-83

---

### 21. `<script>` 标签的 `defer` 和 `async` 属性有什么区别？应该怎么选？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-006`
> 标签：#script, #defer, #async, #高频

**💡 一句话速记**

普通 script 阻塞 HTML 解析；async 下载时不阻塞，但**下载完立刻执行**（执行时阻塞），执行顺序不可控；defer 下载不阻塞，**等 HTML 解析完后按出现顺序执行**，DOMContentLoaded 之前。第三方库用 defer，与 DOM 无强依赖且无序的用 async。

**📖 通俗详解**

**三种 script 行为**：

| 属性 | HTML 解析时下载 | 执行时机 | 执行顺序 | 是否阻塞解析 |
|---|---|---|---|---|
| 无属性 | ✗ 阻塞解析去下载 | 下载完立刻执行 | 按出现顺序 | 是 |
| async | ✓ 并行下载 | **下载完立刻**执行 | 不保证（先下完先执行）| 执行时阻塞 |
| defer | ✓ 并行下载 | HTML 解析完、DOMContentLoaded **之前** | **按出现顺序** | 否 |

**类比**：
- 普通：做饭时米没买齐，全家停下来等送米（同步阻塞）。
- async：让外卖小哥边走边送，谁先到谁先吃（无序）。
- defer：让外卖小哥排队，等饭点（DOM 解析完）统一按下单顺序上桌。

**选择原则**：
- 主业务脚本、依赖 DOM 的库 → **defer**（保序、不阻塞解析）。
- 独立的第三方（统计、广告）、不操作 DOM、不依赖其他脚本 → **async**。
- 模块化用 `<script type="module">`（默认 defer 行为）。

**🔧 示例 / 代码**

```html
<!-- ✓ 推荐写法：业务脚本用 defer，保序、不阻塞 -->
<head>
  <script defer src="react.js"></script>
  <script defer src="app.js"></script>   <!-- react 先执行，app 后执行 -->
</head>

<!-- ✓ 独立脚本用 async，不关心顺序 -->
<script async src="ga.js"></script>
<script async src="ads.js"></script>

<!-- type=module 默认 defer 行为 -->
<script type="module" src="main.js"></script>
```

**🔍 常见追问**

- DOMContentLoaded 和 load 事件分别在 defer 脚本执行的前还是后？
- 为什么 async 脚本不能依赖 DOM？
- type=module 和普通 script 还有什么区别？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「script defer async」+ 模型知识。建议结合 MDN「script element: defer」「async」核验。出处：doc/前端知识体系.md:89

---

### 22. `preload`、`prefetch`、`lazyload` 分别是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-browser-009`
> 标签：#性能优化, #preload, #prefetch, #lazyload, #资源优化

**💡 一句话速记**

preload 提前加载本页关键资源（高优先级）；prefetch 空闲时预取下页可能用的资源（低优先级）；lazyload 延迟到滚动可见才加载。

**📖 通俗详解**

**资源加载策略对比**：

| 手段 | 时机 | 优先级 | 用途 |
|---|---|---|---|
| preload | 当前页**立刻**需要 | 高 | 提前加载首屏关键字体/JS/CSS |
| prefetch | 浏览器**空闲** | 低 | 预取下一页资源（如路由跳转）|
| preconnect | 立刻建连 | 中 | 提前完成 DNS/TCP/TLS 握手 |
| dns-prefetch | 立刻 | 低 | 仅提前 DNS 解析 |
| lazyload | 滚动**可见时** | 按需 | 图片/组件懒加载，省首屏带宽 |

**类比**：preload 像「点餐时顺手把饮料也点了」（这顿马上喝）；prefetch 像「吃完饭顺手把下顿的菜预定了」（可能吃）；lazyload 像「自助餐按需拿」（不一次性堆桌上）。

**🔧 示例 / 代码**

```html
<!-- preload：首屏关键字体 -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>

<!-- prefetch：预测用户会去商品页 -->
<link rel="prefetch" href="/product.js" as="script">

<!-- preconnect：提前与第三方建连 -->
<link rel="preconnect" href="https://cdn.example.com" crossorigin>
<link rel="dns-prefetch" href="//stats.example.com">
```

```html
<!-- 原生图片懒加载 -->
<img src="img.jpg" loading="lazy" decoding="async" width="300" height="200">
```

**🔍 常见追问**

- preload 加多了会有什么副作用？（挤占带宽、抢关键资源）
- loading=lazy 的浏览器兼容性？怎么 polyfill？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「preload prefetch / lazyload / 资源合并压缩」+ web.dev 文档。建议结合 MDN「preload」「prefetch」「loading=lazy」核验。出处：doc/前端知识体系.md:79-83

---

### 23. 为什么做动画推荐用 `requestAnimationFrame` 而不是 `setTimeout`？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-browser-010`
> 标签：#动画, #requestAnimationFrame, #Canvas, #性能

**💡 一句话速记**

rAF 的回调在浏览器每次重绘前触发，频率自动匹配刷新率（通常 60fps/120Hz），与渲染同步、切后台自动暂停、不丢帧也不过度绘制；setTimeout 固定间隔，无法与渲染同步，切后台仍跑、耗电。

**📖 通俗详解**

**requestAnimationFrame 优势**：
1. **跟随刷新率**：60Hz 显示器约 16.6ms 一次，120Hz 约 8.3ms 一次，自动适应。
2. **与渲染同步**：回调在「微任务清空后、Paint 之前」执行，保证这帧的改动能被画出。
3. **后台节流**：页面切到后台，rAF 自动暂停（省电）；setTimeout 还在傻跑。
4. **CPU/GPU 友好**：浏览器可合并多个 rAF 调度。

**对比 setTimeout**：
| 维度 | setTimeout(fn, 16) | requestAnimationFrame |
|---|---|---|
| 触发对齐渲染 | ✗ | ✓ |
| 切后台 | 继续跑 | 暂停 |
| 帧率匹配 | 固定 | 自动 |
| 适用 | 定时任务 | 动画 |

**关键帧动画 vs 过渡动画**：
- **transition**：两状态间插值，需触发（hover/class）。简单平滑。
- **keyframes（@keyframes）**：多关键帧、循环、自动播放。

**类比**：rAF 像「跟着电视刷新节奏换画片」，setTimeout 像「自己掐秒表换，可能不同步」。

**🔧 示例 / 代码**

```javascript
// rAF 动画循环
let start = null;
function animate(ts) {
  if (!start) start = ts;
  const progress = (ts - start) / 1000; // 秒
  box.style.transform = `translateX(${Math.min(progress * 100, 300)}px)`;
  if (progress < 3) requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// 停止动画
const id = requestAnimationFrame(animate);
cancelAnimationFrame(id);
```

```css
/* 关键帧动画 */
@keyframes spin { to { transform: rotate(360deg); } }
.loader { animation: spin 1s linear infinite; }
```

**🔍 常见追问**

- 为什么 rAF 在后台标签页会被暂停？对性能监控有什么影响？
- CSS 动画和 JS 动画（rAF）哪个性能更好？

---

**▶ 追问 1：Canvas 离屏渲染（OffscreenCanvas）是干嘛的？怎么用？**

**💡 一句话速记**

把复杂、不变的图形预先画到一个不挂 DOM 的 canvas（离屏），每帧主 canvas 只 drawImage 一次，省掉每帧重复绘制静态部分的成本；OffscreenCanvas 还能在 Web Worker 里渲染，完全不阻塞主线程。

**📖 通俗详解**

**离屏渲染原理**：
- 把耗时图形（背景图、复杂形状）预先画到一个不挂在 DOM 上的 canvas。
- 每帧主 canvas 只 `drawImage(offscreen, ...)` 一次，避免每帧重画静态部分。
- OffscreenCanvas（标准 API）可在 Web Worker 里渲染，完全不阻塞主线程。

**适用场景**：
- 复杂背景/大量静态元素重复出现在每帧。
- 游戏类高频绘制、粒子系统。
- 需要把渲染移出主线程的场景。

**类比**：离屏渲染像「把不变的海报提前画好，每帧只贴上去」，主 canvas 不用每帧重画海报。

**🔧 示例 / 代码**

```javascript
// 离屏 canvas：背景只画一次
const off = document.createElement('canvas');
off.width = 800; off.height = 600;
const offCtx = off.getContext('2d');
// 复杂背景预渲染
for (let i = 0; i < 1000; i++) offCtx.fillRect(...);

function frame() {
  ctx.clearRect(0, 0, 800, 600);
  ctx.drawImage(off, 0, 0); // 一次贴图，省掉 1000 次 fillRect
  drawPlayer();
  requestAnimationFrame(frame);
}

// OffscreenCanvas + Worker（把渲染移出主线程）
// HTMLCanvasElement.transferControlToOffscreen 只能调用一次
const canvas = document.querySelector('canvas');
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('render-worker.js');
worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
```

**🔍 常见追问**

- OffscreenCanvas + Worker 怎么用？浏览器兼容性如何？
- 离屏渲染和双缓冲（double buffering）是一回事吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「动画：关键帧/过渡/requestAnimationFrame/canvas 动画/canvas 离屏渲染」+ 模型知识。建议结合 MDN「requestAnimationFrame」「OffscreenCanvas」核验。出处：doc/前端知识体系.md:101-106

---

### 24. 浏览器的 Event Loop（事件循环）机制是怎样的？宏任务和微任务的执行顺序如何？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-001`
> 标签：#事件循环, #宏任务, #微任务, #高频

**💡 一句话速记**

JS 单线程靠 Event Loop 调度任务。每一轮：先执行一个宏任务（含同步代码），清空其产生的所有微任务，再执行 UI 渲染，然后取下一个宏任务。微任务插队，优先级高于下一个宏任务。

**📖 通俗详解**

**核心模型**：调用栈 + 微任务队列 + 宏任务队列 + 渲染。

**一次循环（tick）步骤**：
1. 从宏任务队列取**一个**任务执行（脚本本身是第一个宏任务）。
2. 执行过程中产生的**所有微任务**，在本轮清空（一个接一个执行完）。
3. 必要时执行 requestAnimationFrame 回调。
4. 触发 UI 渲染（render 步骤，受节流限制，不是每轮都渲染）。
5. 回到第 1 步。

**类比**：宏任务是「排队取号的顾客」，微任务是「VIP 加急单」——每个顾客服务完，必须把当前累积的 VIP 单全办完，才轮到下一个顾客。

**宏任务 vs 微任务**：
| 类型 | 常见成员 |
|---|---|
| 宏任务 | script 整体、setTimeout、setInterval、I/O、UI 事件、postMessage、MessageChannel |
| 微任务 | Promise.then/catch/finally、MutationObserver、queueMicrotask、process.nextTick(Node) |

**记忆**：同步代码 → 微任务（清空）→ 渲染 → 宏任务。

**🔧 示例 / 代码**

```javascript
console.log('1 同步');

setTimeout(() => console.log('4 宏任务'), 0);

Promise.resolve().then(() => console.log('3 微任务'));

console.log('2 同步');
// 输出顺序：1 → 2 → 3 → 4
```

```javascript
// 嵌套场景：微任务里再产生微任务，仍在本轮清空
Promise.resolve().then(() => {
  console.log('a');
  Promise.resolve().then(() => console.log('b'));
}).then(() => console.log('c'));
// 输出：a → b → c（每个 then 入队时都已 ready，按入队顺序执行）
```

**🔍 常见追问**

- requestAnimationFrame 属于宏任务还是微任务？它在事件循环哪个阶段执行？
- await 后面的代码等价于什么？（提示：包在 Promise.then 里，是微任务）
- 为什么微任务会阻塞渲染？（提示：本轮渲染必须等微任务清空）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「事件循环」+ 模型知识。建议结合 MDN「In depth: microtasks and javascript timers」「HTML Standard event loop processing model」核验。出处：doc/前端知识体系.md:68-70

---

### 25. 浏览器从拿到 HTML 到把页面画到屏幕上，经历了哪些步骤？（关键渲染路径）

> ⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-browser-004`
> 标签：#渲染流程, #DOM, #渲染树, #高频

**💡 一句话速记**

六步：解析 HTML→DOM，解析 CSS→CSSOM，合并→渲染树（Render Tree），布局（Layout/Reflow）算几何，绘制（Paint）填像素，合成（Composite）分层合并。JS/CSS 会阻塞对应阶段。

**📖 通俗详解**

**关键渲染路径（Critical Rendering Path）**：

1. **构建 DOM**：字节→字符→令牌→节点→DOM 树。HTML 解析容错性强（缺失标签会补）。
2. **构建 CSSOM**：解析 CSS 文本→CSSOM 树。CSS 解析不会阻塞 HTML，但**会阻塞渲染**（避免无样式闪烁 FOUC）。
3. **构建渲染树**：DOM + CSSOM → 渲染树。**只包含可见节点**（`display:none` 不进渲染树，但 `visibility:hidden` 进——它占位）。
4. **布局 Layout（回流 Reflow）**：根据视口计算每个节点的**几何信息**（位置、大小）。
5. **绘制 Paint**：把每个节点转成屏幕上的**像素**（颜色、文字、阴影、边框）。
6. **合成 Composite**：页面分层，GPU 合成各层（transform/opacity 在独立层，性能最好）。

**类比**：DOM 是「骨架」，CSSOM 是「化妆方案」，渲染树是「化了妆要露脸的人」（藏起来的不算），布局是「排座位」，绘制是「上色」，合成是「贴图层」。

| 阶段 | 输入 | 输出 | 是否阻塞 HTML |
|---|---|---|---|
| DOM | HTML 字节 | DOM 树 | — |
| CSSOM | CSS 文本 | CSSOM 树 | 不阻塞解析，阻塞渲染 |
| Render Tree | DOM+CSSOM | 渲染树 | — |
| Layout | 渲染树 | 布局框 | — |
| Paint | 布局框 | 像素位图 | — |
| Composite | 各层位图 | 最终画面 | — |

**🔧 示例 / 代码**

```text
HTML: <div id="a"><p>hi</p></div>

1. DOM:        div#a ── p ── "hi"
2. CSSOM:      (规则树，匹配选择器)
3. RenderTree: div#a(p="block") ── p ── "hi"   ← display:none 的节点被剔除
4. Layout:     div#a {x:0,y:0,w:100,h:50}   p{x:0,y:0,w:100,h:20}
5. Paint:      把每个框涂成像素
6. Composite:  GPU 合成图层
```

```html
<!-- 优化点：CSS 放 head（尽早开始 CSSOM），JS 放 body 末尾或加 defer -->
<head>
  <link rel="stylesheet" href="a.css"> <!-- 不阻塞 DOM 解析，但阻塞首次渲染 -->
</head>
<body>
  <script defer src="b.js"></script>   <!-- defer：DOM 解析完才执行 -->
</body>
```

**🔍 常见追问**

- display:none 和 visibility:hidden 在渲染树上有什么区别？
- 为什么 transform 做动画不触发回流？（提示：合成层）
- 首屏渲染要等所有 CSS 加载完吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「页面渲染的流程」「渲染树」+ 模型知识。建议结合 web.developer.critical-rendering-path、MDN「关键渲染路径」核验。出处：doc/前端知识体系.md:71-83

---

### 26. Chrome 的 Web Vitals 核心性能指标（LCP/CLS/FID）分别是什么？怎么测量？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-browser-007`
> 标签：#性能指标, #LCP, #CLS, #FID, #Core Web Vitals, #Performance API

**💡 一句话速记**

LCP（最大内容绘制，衡量加载，应 <2.5s）、CLS（累积布局偏移，衡量视觉稳定，应 <0.1）、FID（首次输入延迟，衡量交互响应，应 <100ms；新版已用 INP 替代）。用 PerformanceObserver / web-vitals 库采集上报。

**📖 通俗详解**

**Core Web Vitals 三大指标**：

| 指标 | 全称 | 衡量维度 | 好 | 需改进 | 差 |
|---|---|---|---|---|---|
| LCP | Largest Contentful Paint | 加载性能（最大块内容出现时间）| ≤2.5s | 2.5–4s | >4s |
| CLS | Cumulative Layout Shift | 视觉稳定（内容跳动）| ≤0.1 | 0.1–0.25 | >0.25 |
| FID | First Input Delay | 交互响应（首次输入到响应）| ≤100ms | 100–300ms | >300ms |
| INP | Interaction to Next Paint | 全程交互响应（FID 的继任者，2024 生效）| ≤200ms | 200–500ms | >500ms |

**通俗解释**：
- LCP：「用户看到主要内容要等多久」。
- CLS：「页面会不会突然乱跳」（图片没设尺寸、字体异步加载都会跳）。
- FID/INP：「点按钮到有反应卡不卡」。

**测量方式**：
1. **Chrome DevTools / Lighthouse**：本地审计。
2. **PageSpeed Insights**：线上 + 实验室数据。
3. **PerformanceObserver API**：代码里订阅采集，上报到 RUM（真实用户监控）。
4. **web-vitals 官方库**：封装好上报逻辑。

**🔧 示例 / 代码**

```javascript
// 用 PerformanceObserver 采集 LCP
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lastEntry = entries[entries.length - 1];
  console.log('LCP:', lastEntry.startTime, lastEntry.element);
}).observe({ type: 'largest-contentful-paint', buffered: true });

// 采集 CLS
let cls = 0;
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (!entry.hadRecentInput) cls += entry.value;
  }
  console.log('CLS:', cls);
}).observe({ type: 'layout-shift', buffered: true });

// 采集 FID / INP
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log('FID:', entry.processingStart - entry.startTime);
  }
}).observe({ type: 'first-input', buffered: true });
```

```javascript
// 推荐用官方 web-vitals 库
import { onLCP, onCLS, onINP } from 'web-vitals';
onLCP(metric => report(metric));
onCLS(metric => report(metric));
onINP(metric => report(metric));
```

**🔍 常见追问**

- 为什么 FID 被 INP 替代？（提示：FID 只测第一次，覆盖不全）
- 如何优化 LCP？（图片优先级、预加载关键资源、SSR）
- CLS 常见根因有哪些？（图片无尺寸、动态注入内容、字体闪烁）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「chrome 性能优化指标」「lcp/cls/fid」「performance api」+ web.dev 官方文档。建议结合 web.dev「Core Web Vitals」「INP」核验。出处：doc/前端知识体系.md:84-88

---

### 27. 浏览器的强缓存和协商缓存是怎么工作的？完整判定流程是怎样的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-008`
> 标签：#缓存, #强缓存, #协商缓存, #Cache-Control, #ETag, #高频

**💡 一句话速记**

三步判定：①查本地强缓存（Cache-Control/Expires），未过期→直接用（200 from cache）；②过期→发请求带上 ETag/If-None-Match、Last-Modified/If-Modified-Since 协商；③服务器判断资源没变→304 用本地，变了→200 返回新资源。

**📖 通俗详解**

**完整缓存判定流程**：

```
请求资源
  ↓
① 本地有缓存？
  ├ 无 → 直接向服务器请求（200）
  └ 有 → 看强缓存
② 强缓存有效？(看 Cache-Control.max-age 或 Expires)
  ├ 有效 → 直接用本地，不发请求 (200 from disk/memory cache)
  └ 过期 → 进入协商缓存
③ 发条件请求，带上：
    - If-None-Match: <ETag>
    - If-Modified-Since: <Last-Modified>
  ↓
④ 服务器对比：
  ├ 资源没变 → 304 Not Modified（不带 body，省流量）
  └ 资源变了 → 200 + 新资源 + 新的缓存头
```

**强缓存 vs 协商缓存**：
| 维度 | 强缓存 | 协商缓存 |
|---|---|---|
| 是否发请求 | 不发 | 发（条件请求）|
| 响应码 | 200 (from cache) | 304 |
| 判定方 | 浏览器本地 | 服务器 |
| 关键头 | Cache-Control, Expires | ETag/If-None-Match, Last-Modified/If-Modified-Since |

**关键 HTTP 头**：
- `Cache-Control: max-age=3600`：1 小时内强缓存有效（优先级高于 Expires）。
- `Expires: Wed, 24 Jul 2026 12:00:00 GMT`：绝对过期时间（HTTP/1.0，已弱化）。
- `ETag: "abc123"`：资源内容指纹（hash），变了就变。
- `Last-Modified: ...`：资源最后修改时间。

**为什么 ETag 比 Last-Modified 优先**：ETag 精确到内容（改了又改回会更新 ETag），Last-Modified 只精确到秒，且「内容没变但修改时间变了」会误判。

**类比**：强缓存是「保质期内直接吃」，协商缓存是「过期了问店员能不能吃」，店员说没坏（304）就吃，坏了（200）换新的。

**🔧 示例 / 代码**

```http
# 首次响应
HTTP/1.1 200 OK
Cache-Control: max-age=600
ETag: "v3-abc"
Last-Modified: Wed, 24 Jul 2026 10:00:00 GMT

[资源内容]
```

```http
# 600 秒内再次请求：不发请求，直接用本地
# (DevTools 显示 200 from disk cache，无网络记录)
```

```http
# 600 秒后：发条件请求
GET /app.js
If-None-Match: "v3-abc"
If-Modified-Since: Wed, 24 Jul 2026 10:00:00 GMT

# 资源没变 →
HTTP/1.1 304 Not Modified
# 资源变了 →
HTTP/1.1 200 OK
[新内容 + 新 ETag]
```

```text
# 常用 Cache-Control 指令
max-age=600      强缓存 600 秒
no-cache         强制每次都协商（协商缓存）
no-store         完全不缓存（连本地都不存）
public/private   是否允许中间代理缓存
s-maxage         共享缓存（CDN）专用时长
immutable        资源永不变（用户刷新也不协商）
```

**🔍 常见追问**

- no-cache 和 no-store 有什么区别？
- 用户按 F5 刷新和 Ctrl+F5 强刷，缓存行为有何不同？
- 如何让带 hash 的静态资源永久缓存、HTML 不缓存？
- ETag 是怎么生成的？强 ETag 和弱 ETag 有何区别？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「强缓存和协商缓存」+ HTTP 缓存规范。建议结合 MDN「HTTP Caching」、RFC 9111 核验。出处：doc/前端知识体系.md:107-112

---

### 28. TCP 的三次握手和四次挥手是怎样的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-011`
> 标签：#TCP, #三次握手, #四次挥手, #网络, #高频

**💡 一句话速记**

三次握手建连：SYN→SYN+ACK→ACK，双方确认收发能力并同步序列号。四次挥手断连：FIN→ACK→FIN→ACK，主动方先关、被动方发完剩余数据后再关。

**📖 通俗详解**

**三次握手（建立连接）**：
```
Client                          Server
  | --- SYN, seq=x ------------> |   (1) 我要连
  | <--- SYN+ACK, seq=y, ack=x+1-|   (2) 同意，我也要连
  | --- ACK, ack=y+1 ----------> |   (3) 收到，开始传
  |=== 连接建立（ESTABLISHED）===|
```

**四次挥手（断开连接）**：
```
Client                          Server
  | --- FIN, seq=m ------------> |   (1) 我没数据了
  | <--- ACK, ack=m+1 ----------|   (2) 收到，但我可能还有
  |        (Server 继续发剩余数据)|
  | <--- FIN, seq=n ------------|   (3) 我也发完了
  | --- ACK, ack=n+1 ----------> |   (4) 收到，2MSL 后关闭
  |=== TIME_WAIT → CLOSED ======|
```

**TIME_WAIT 的作用**（主动关闭方最后等 2MSL）：
1. 确保最后的 ACK 到达对端（丢了对端会重发 FIN）。
2. 让本次连接的旧报文在网络中失效，避免干扰新连接。

关于「为什么握手是 3 次、挥手是 4 次」的原理见追问。

**🔧 示例 / 代码**

```text
# 用 tcpdump / Wireshark 看握手
$ tcpdump -i any -n 'tcp port 443 and (tcp-syn|tcp-fin) != 0'

# 典型 HTTPS 连接时序
1. TCP 三次握手       (RTT 1)
2. TLS 握手          (1-2 RTT)
3. HTTP 请求/响应     (RTT + 处理)
# 这就是为什么 HTTP/2、HTTP/3(QUIC) 要减少握手次数
```

```text
# 半关闭状态的应用：shutdown(SHUT_WR) 后仍可读
# 服务端能继续发完剩余数据再关
```

**🔍 常见追问**

- 如果第三次握手（ACK）丢了会怎样？
- 为什么 TIME_WAIT 是 2MSL？大量 TIME_WAIT 怎么排查？
- TCP 为什么是面向连接的、可靠的？靠哪些机制？（序列号、确认、重传、滑动窗口、拥塞控制）

---

**▶ 追问 1：为什么握手是三次、挥手是四次？**

**💡 一句话速记**

握手时服务器的「同意连接」和「我也请求连接」可以合并成一次 SYN+ACK，所以只需 3 次；挥手时 TCP 全双工，被动方收到 FIN 时自己可能还有数据没发完，ACK 和 FIN 不能合并，所以要 4 次。

**📖 通俗详解**

**为什么握手 3 次、挥手 4 次**：
- **握手**：SYN+ACK 可以合并成一次发送（服务器同时表达「同意」和「我也连」）。
- **挥手**：TCP 是**全双工**，被动方收到 FIN 时自己可能还有数据没发完，所以先回 ACK（确认收到关闭请求），等数据发完再发自己的 FIN。两个动作不能合并 → 多一次。
- 挥手多出来的这一次，本质上是为了允许「半关闭」状态——一方停止发送但仍能接收对方的剩余数据。

**类比**：握手像「打电话：喂？— 嗨我在 — 好说事」（同意+我也连合并成一句）；挥手像「挂电话：我说完了 — 嗯你等下我还有句 — 我也说完了 — 好，挂」（因为对方可能还有话说，不能立刻回挂）。

**🔍 常见追问**

- 半关闭状态（half-close）有什么实际应用？（提示：shutdown 后单向通信）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「三次握手和四次挥手」+ TCP/IP 经典模型。建议结合 RFC 793「TRANSMISSION CONTROL PROTOCOL」核验。出处：doc/前端知识体系.md:113-125

---

### 29. 什么是浏览器同源策略？

> ⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-browser-012`
> 标签：#跨域, #CORS, #JSONP, #同源策略, #高频

**💡 一句话速记**

同源策略：协议+域名+端口三者全相同才同源，跨源的 DOM 访问、Cookie、AJAX 受限。注意 `<img>`/`<script>`/`<link>` 标签本身不受同源限制（能加载，但读内容受限）。

**📖 通俗详解**

**同源策略**：浏览器对「不同源」的资源做了三类限制：
1. **跨源 DOM 访问**：iframe / window 跨源拿不到对方的 DOM（可用 postMessage 通信）。
2. **跨源 Cookie/Storage**：隔离。
3. **跨源 AJAX**：fetch/XHR 默认被拦截（除非服务器允许）。

注：`<img>`、`<script>`、`<link>` 标签本身**不受同源限制**（能加载，但读内容受限），这是 JSONP 等跨域方案的基础。

跨源的解决方案（CORS / JSONP / 代理）详见追问。

**🔧 示例 / 代码**

```javascript
// 跨源 DOM 访问受限示例
const iframe = document.querySelector('iframe');
// 若 iframe 跨源，下面会抛 SecurityError
iframe.contentWindow.document;

// 用 postMessage 安全通信
iframe.contentWindow.postMessage('hello', 'https://trusted.com');
window.addEventListener('message', (e) => {
  if (e.origin === 'https://trusted.com') console.log(e.data); // 校验 origin
});
```

**🔍 常见追问**

- postMessage 怎么安全通信？为什么要校验 origin？

---

**▶ 追问 1：跨域有哪些解决方案（CORS / JSONP / 代理）？**

**💡 一句话速记**

三种主流方案：①CORS（服务器加响应头，标准方案，支持所有方法）②JSONP（利用 script 标签不受同源限制，只支持 GET，已淘汰）③代理服务器（开发用 webpack/vite proxy，生产用 Nginx 反代）。

**📖 通俗详解**

**三种方案对比**：
| 方案 | 原理 | 请求方法 | 是否要服务端配合 | 现代性 |
|---|---|---|---|---|
| CORS | 服务器加 `Access-Control-Allow-Origin` | 全部 | 是 | ✓ 主流 |
| JSONP | script 标签 + 回调函数 | 仅 GET | 是 | ✗ 已淘汰 |
| 代理 | 前端请求同源代理，代理转发 | 全部 | 是（部署代理）| ✓ 常用 |

**CORS 完整流程**：
- **简单请求**（GET/HEAD/POST + 安全头）：直接发，服务器返回 `Access-Control-Allow-Origin` 即可。
- **预检请求 Preflight**：复杂请求先发 OPTIONS，服务器批准后才发真请求。
- 关键头：`Access-Control-Allow-Origin`、`Allow-Methods`、`Allow-Headers`、`Allow-Credentials`（带 Cookie 时必须指定具体 origin，不能是 `*`）。

**类比**：CORS 像「业主登记授权的访客白名单」；JSONP 像「钻门禁只查快递员的空子」；代理像「让本小区住户帮你跑腿」。

**🔧 示例 / 代码**

```javascript
// CORS：服务端设置（Node Express）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://app.example.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // 带 Cookie
  if (req.method === 'OPTIONS') return res.sendStatus(204); // 预检
  next();
});

// 前端带 Cookie
fetch('https://api.example.com/user', { credentials: 'include' });
```

```javascript
// JSONP（了解原理即可）
function handleData(data) { console.log(data); }
// 服务端返回：handleData({name:'tom'});
const s = document.createElement('script');
s.src = 'https://api.example.com?callback=handleData';
document.body.appendChild(s);
```

```javascript
// Vite 开发代理（同源到前端，转发到后端）
// vite.config.js
export default {
  server: {
    proxy: { '/api': { target: 'https://api.example.com', changeOrigin: true } }
  }
};
```

```nginx
# Nginx 生产反代
location /api/ {
  proxy_pass https://api.example.com/;
}
```

**🔍 常见追问**

- CORS 带 Cookie 时，Allow-Origin 能写 * 吗？为什么？
- 预检请求（OPTIONS）什么时候触发？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「跨域」+ CORS 规范。建议结合 MDN「Cross-Origin Resource Sharing」「Same-origin policy」核验。出处：doc/前端知识体系.md:117

---

### 30. DNS 的查询过程是怎样的？递归和迭代有什么区别？

> ⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-browser-013`
> 标签：#DNS, #CDN, #高频

**💡 一句话速记**

DNS 查询：浏览器缓存→OS 缓存→hosts→本地 DNS（递归）→根→顶级域→权威服务器，拿到 IP。递归是客户端把活全交给本地 DNS「你帮我把答案找全」；迭代是本地 DNS 替你一层层问「你不知道就告诉下一步问谁」。

**📖 通俗详解**

**两类查询**：
- **递归**：客户端只发一次给本地 DNS「你帮我把答案找全」，自己等结果。
- **迭代**：本地 DNS 替你一层层问各级服务器「你不知道就告诉下一步问谁」。

**DNS 完整查询流程**：
```
1. 浏览器 DNS 缓存     → 命中则止
2. 操作系统 DNS 缓存   → 命中则止
3. hosts 文件
4. 本地 DNS 服务器（递归解析器，如运营商）
     ↓ (本地未命中，开始迭代查询)
5. 根域名服务器 (.)     → 告诉你「.com 的服务器是谁」
6. 顶级域服务器 (.com)  → 告诉你「example.com 的权威是谁」
7. 权威域名服务器       → 返回最终 IP
     ↓ (逐级缓存)
8. 本地 DNS 缓存结果并返回给浏览器
```

**类比**：DNS 像「逐级查通讯录」（公司→部门→个人）。

**🔧 示例 / 代码**

```bash
# 查看某域名的 DNS 解析链
$ dig +trace example.com
$ nslookup example.com
```

```html
<!-- 优化 DNS：dns-prefetch 提前解析第三方域名 -->
<link rel="dns-prefetch" href="//cdn.example.com">
<link rel="preconnect" href="//api.example.com">
```

**🔍 常见追问**

- DNS 解析慢怎么办？（dns-prefetch、HTTPDNS、本地缓存）
- 为什么有了 HTTPDNS？（移动端 DNS 劫持、解析慢）
- 浏览器 DNS 缓存和 OS 缓存的 TTL 冲突怎么处理？

---

**▶ 追问 1：CDN 的基本原理是什么？它是怎么做到就近访问的？**

**💡 一句话速记**

CDN 把静态资源复制到全球边缘节点，用户请求时由智能 DNS（GSLB）根据用户 IP/网络/节点负载返回最近最优的边缘节点 IP；命中缓存就近返回，未命中边缘节点回源拉取并缓存。

**📖 通俗详解**

**CDN（Content Delivery Network）原理**：
1. 源站把资源同步到 CDN 厂商的边缘节点（全球分布）。
2. 用户请求 `cdn.example.com`，DNS 解析时 CDN 的智能 DNS（GSLB）根据**用户 IP、网络状况、节点负载**返回**最近最优**的边缘节点 IP。
3. 用户直连边缘节点：
   - **命中缓存**：直接返回（RTT 极短）。
   - **未命中**：边缘节点回源拉取，缓存后返回（同时按 TTL 保留）。
4. 资源更新通过缓存刷新 / 版本 hash 控制。

**类比**：CDN 像「全国连锁仓，下单从最近的仓发货，没货才回总厂调」。

**CDN 关键技术**：智能调度（GSLB）、边缘缓存、回源、缓存刷新、HTTPS 就近卸载、防 DDoS。

**🔧 示例 / 代码**

```nginx
# 源站配置缓存头（让 CDN 边缘节点知道缓存多久）
location ~* \.(js|css|png|jpg)$ {
  expires 30d;
  add_header Cache-Control "public, max-age=2592000";
}
```

```html
<!-- 带版本/hash 的资源，更新时换 URL，CDN 自动拉新 -->
<script src="https://cdn.example.com/app.abc123.js"></script>
```

**🔍 常见追问**

- CDN 节点缓存怎么更新？预热是什么？
- CDN 回源策略有哪些？缓存未命中的成本怎么控制？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「dns 查询策略」「cdn 的原理」+ 模型知识。建议结合 RFC 1034「Domain Names - Concepts and Facilities」、各 CDN 厂商文档核验。出处：doc/前端知识体系.md:118-119

---

### 31. HTTP 和 HTTPS 有什么区别？HTTPS 的握手认证过程是怎样的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-014`
> 标签：#HTTPS, #TLS, #加密, #证书, #高频

**💡 一句话速记**

HTTP 明文传输、端口 80；HTTPS = HTTP + TLS，加密+身份认证+完整性校验，端口 443。握手：客户端发起→服务器返证书→客户端用 CA 公钥验签→协商对称密钥→后续用对称加密通信。

**📖 通俗详解**

**HTTP vs HTTPS**：
| 维度 | HTTP | HTTPS |
|---|---|---|
| 传输 | 明文 | TLS 加密 |
| 端口 | 80 | 443 |
| 身份 | 无 | 证书认证 |
| 完整性 | 无 | 有（MAC）|
| 性能 | 略快 | 多 1-2 RTT 握手（TLS 1.3 已优化到 1-RTT/0-RTT）|
| SEO | 弱 | Google 优先 |

**HTTPS（TLS 1.2）握手核心步骤**：
```
Client                                  Server
  | --- ClientHello (支持的密码套件、随机数1) -->|
  | <-- ServerHello (选定套件、随机数2) + 证书 ---|  证书含公钥+CA 签名
  | --- 验证证书（用内置 CA 公钥验签）            |
  | --- 生成 pre-master，用服务器公钥加密发送 ---->|
  | <-- 双方用 随机数1+随机数2+pre-master 算会话密钥 |
  | === 后续用对称密钥加密通信 ====================|
```

要点：
1. **非对称加密**只用于握手期交换密钥（性能差，不能全程用）。
2. **对称加密**用于后续数据（快）。
3. **证书链信任**：浏览器内置 CA 根证书，逐级验签到服务器证书。

**🔧 示例 / 代码**

```text
# 浏览器点小锁 → 证书 → 看证书链
  根 CA (DigiCert)
   └ 中间 CA
      └ example.com (服务器证书)

# 浏览器校验：签名有效 + 域名匹配 + 未过期 + 未被吊销(CRL/OCSP)
```

```nginx
# 启用 HTTPS + 强制 HSTS（防降级）
server {
  listen 443 ssl http2;
  ssl_certificate     /etc/ssl/fullchain.pem;
  ssl_certificate_key /etc/ssl/privkey.pem;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
server {
  listen 80;
  return 301 https://$host$request_uri;  # HTTP 跳 HTTPS
}
```

**🔍 常见追问**

- TLS 1.3 相比 1.2 改进了什么？（1-RTT/0-RTT、去掉不安全算法）
- 为什么对称加密快、非对称加密慢？为什么不全用非对称？
- HSTS 是什么？解决什么问题？

---

**▶ 追问 1：HTTPS 还会被攻击吗？有哪些攻击方式？**

**💡 一句话速记**

仍可能被攻击：中间人攻击（信任伪造 CA）、降级攻击（退回弱 TLS）、证书伪造/签发漏洞（CA 被入侵）、侧信道/实现漏洞（如 Heartbleed）。难度比 HTTP 大增，但非绝对安全。

**📖 通俗详解**

**HTTPS 仍可能被攻击**：
- **中间人攻击**：若用户信任了伪造 CA（如公司/恶意根证书），可被解密。
- **降级攻击**：迫使双方退回弱版本 TLS（缓解：强制 HSTS）。
- **证书伪造/签发漏洞**：CA 被入侵。
- **侧信道、实现漏洞**（如 Heartbleed）。
- HSTS、证书钉扎（HPKP 已弃用）、CT 日志可缓解。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「http 和 https 区别 / https 认证过程 / https 会被攻击吗」+ TLS 规范。建议结合 RFC 8446「TLS 1.3」核验。出处：doc/前端知识体系.md:120-122

---

### 32. HTTP/2 和 HTTP/3 相比 HTTP/1.1 有什么改进？为什么 HTTP/3 改用 UDP？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-browser-015`
> 标签：#HTTP2, #HTTP3, #QUIC, #WebSocket, #网络

**💡 一句话速记**

HTTP/2：二进制分帧、多路复用（一个 TCP 连接并发多请求）、头部压缩 HPACK、服务端推送。HTTP/3：抛弃 TCP，基于 QUIC（UDP），解决 TCP 层队头阻塞、握手更快（TLS 1.3 内建 1-RTT/0-RTT）、支持连接迁移。

**📖 通俗详解**

**HTTP 版本演进**：
| 版本 | 传输 | 关键特性 | 痛点 |
|---|---|---|---|
| HTTP/1.1 | TCP | 持久连接、管道化 | 队头阻塞、连接数受限、文本头大 |
| HTTP/2 | TCP | 二进制分帧、**多路复用**、HPACK 头部压缩、Server Push | TCP 层队头阻塞（丢一个包全堵）|
| HTTP/3 | **QUIC(UDP)** | 无队头阻塞、0/1-RTT 握手、连接迁移 | 部署/兼容仍在推进 |

**HTTP/2 多路复用**：一个 TCP 连接上并发多个请求/响应，每个请求拆成帧交错发送，彻底告别「域名分片」「雪碧图」。

**为什么 HTTP/3 改用 UDP**：HTTP/2 虽然应用层多路复用，但底层 TCP 一旦丢包，所有流都被阻塞（TCP 队头阻塞）。QUIC 在 UDP 上自己实现可靠传输 + 多流，一个流丢包不影响其他流。

**类比**：HTTP/1.1 是「每个请求开条车道」；HTTP/2 是「一条高速公路多车道」；HTTP/3 是「把公路换成更聪明的轨道系统，单条堵不影响其他」。

**🔧 示例 / 代码**

```nginx
# 启用 HTTP/2 / HTTP/3
listen 443 ssl http2;        # HTTP/2
listen 443 quic reuseport;   # HTTP/3 (QUIC, UDP)
add_header Alt-Svc 'h3=":443"'; # 告诉浏览器可升级到 H3
```

**🔍 常见追问**

- HTTP/2 还需要打包/雪碧图吗？为什么？
- QUIC 怎么在 UDP 上实现可靠性？
- 为什么 HTTP/3 部署比 HTTP/2 慢？（UDP 在中间设备/防火墙常被限）

---

**▶ 追问 1：WebSocket 解决了什么问题？它和 HTTP 轮询、SSE 怎么选？**

**💡 一句话速记**

WebSocket 在单条 TCP 上提供全双工通信，解决 HTTP 只能客户端发起、服务端无法主动推送的痛点；连接复用、低延迟、双向。需要双向实时选 WebSocket，只需服务端单向推送选 SSE。

**📖 通俗详解**

**WebSocket**：
- 协议升级：HTTP `Upgrade: websocket` → 101 Switching Protocols。
- 之后该 TCP 连接变成全双工，服务端可主动推消息。
- 适用：聊天、实时通知、股票行情、协同编辑。
- vs HTTP 轮询/SSE：连接复用、低延迟、双向。

**三种方案对比**：
| 方案 | 方向 | 实时性 | 连接成本 | 适用 |
|---|---|---|---|---|
| HTTP 轮询（短/长轮询） | 客户端拉 | 差（延迟由间隔决定） | 高（反复建连/空请求） | 简单、兼容性好 |
| SSE（Server-Sent Events） | 服务端→客户端（单向） | 好（一条长连接推送） | 中（单向） | 通知、行情推送 |
| WebSocket | 全双工 | 最好（双向实时） | 低（一条连接复用） | 聊天、协同编辑 |

**类比**：HTTP 是「写信（一问一答）」，SSE 是「广播（只听服务端说）」，WebSocket 是「打电话（双向实时）」。

**🔧 示例 / 代码**

```javascript
// WebSocket 基础
const ws = new WebSocket('wss://socket.example.com/chat');
ws.onopen  = () => ws.send('hello');
ws.onmessage = (e) => console.log('收到', e.data);
ws.onclose = () => console.log('断开');

// 心跳保活（防止 NAT/代理断连）
setInterval(() => ws.readyState === 1 && ws.send('ping'), 30000);
```

**🔍 常见追问**

- WebSocket 怎么做心跳保活和断线重连？
- WebSocket 和 SSE 在鉴权、二进制传输上有什么差异？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「http2.0 / http3.0 / websocket / udp 和 tcp」+ 协议规范。建议结合 RFC 9113「HTTP/2」、RFC 9114「HTTP/3」、RFC 9000「QUIC」核验。出处：doc/前端知识体系.md:121-125

---

### 33. JavaScript 的垃圾回收机制是怎样的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-browser-016`
> 标签：#垃圾回收, #V8, #新生代, #老生代, #标记清除, #高频

**💡 一句话速记**

JS 栈由执行上下文进出自动回收（ESP 指针下移即销毁）；堆靠 GC。判断可达性：从根（全局对象、当前栈上的变量）出发遍历，能到达的对象存活，到达不了的就是垃圾，靠「标记-清除」算法回收。GC 在代码执行间隙分批进行，避免长时间卡顿。

**📖 通俗详解**

**栈 vs 堆的回收**：
- **栈**：基本类型、引用地址。函数执行完，上下文出栈，ESP（栈顶指针）下移，该空间自动「失效」（被后续覆盖）。**没有显式 GC**。
- **堆**：对象、闭包变量。靠**垃圾回收器**识别「不可达」对象并释放。

**判断可达性（reachability）**：从「根」（全局对象、当前栈上的变量）出发遍历，能到达的对象存活，到达不了的就是垃圾。

**标记-清除（Mark-Sweep）**：现代 JS 引擎的核心算法——从根遍历标记存活对象，清除未标记的。

**🔧 示例 / 代码**

```javascript
// 触发垃圾回收的常见场景
let user = { name: 'tom' };
user = null;  // 原对象不可达 → 下次 GC 回收

// 闭包持有：不会被回收
function makeCounter() {
  let count = 0;
  return () => ++count;  // count 被闭包引用，常驻堆
}

// 常见内存泄漏（对象仍可达）
let cache = {};
function add(k, v) { cache[k] = v; } // 只加不删 → 永久持有
```

```text
// DevTools → Memory → Heap snapshot
//   对比两次快照，看 Retained Size 增长的对象
// Performance → 看GC事件占比
```

**🔍 常见追问**

- WeakMap/WeakSet 为什么不会阻止 GC？（弱引用，不计入可达性）
- 如何排查页面内存泄漏？（Heap snapshot 三段对比法）

---

**▶ 追问 1：V8 的新生代/老生代、标记清除、增量标记分别是什么？**

**💡 一句话速记**

V8 分代回收：新生代（Scavenge，From/To 复制算法，存活短、回收频繁）→ 晋升 → 老生代（标记清除 Mark-Sweep + 标记整理 Mark-Compact + 增量标记 Incremental Marking，存活久）。

**📖 通俗详解**

**V8 分代回收**：

| 区域 | 占比 | 算法 | 特点 |
|---|---|---|---|
| 新生代 | 小（~1-8MB×2）| Scavenge（Cheney 复制）| 对象存活率低、回收频繁 |
| 老生代 | 大 | Mark-Sweep + Mark-Compact + 增量标记 | 对象存活久、回收慢 |

**新生代 Scavenge（From/To）**：
1. 新对象分到 From 空间。
2. From 满了，检查 From 中存活对象，**复制**到 To（同时整理内存，无碎片）。
3. 清空 From，From/To 角色互换。
4. 经历过一次 Scavenge 还活着、或 To 占用超 25% → **晋升老生代**。

**老生代 Mark-Sweep / Mark-Compact**：
- **Mark-Sweep（标记清除）**：从根遍历标记存活对象，清除未标记的。缺点：产生内存碎片。
- **Mark-Compact（标记整理）**：清除时把存活对象移到一端，消除碎片（更慢，但无碎片）。

**增量标记 Incremental Marking**：把一次长标记拆成多个小步，**与 JS 交替执行**（写屏障 Write Barrier 记录期间变更），避免一次 GC 卡顿几百毫秒。

**类比**：新生代像「快餐盘，吃完立刻洗一批」；老生代像「仓库，定期大盘点」；增量标记像「把盘点拆成每天盘一点，别一次停业」。

**🔍 常见追问**

- Scavenge 为什么用复制算法而不用标记清除？（新生代存活少，复制成本低且无碎片）
- 分代回收为什么有效？（弱分代假说：大多数对象朝生夕死）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「垃圾回收机制：栈/堆、新生代/老生代、标记清除、增量标记」+ V8 文档。建议结合 V8 官方博客「Trash talk: the Orinoco garbage collector」核验。出处：doc/前端知识体系.md:90-100

---

### 34. Web Worker 和 Service Worker 分别是什么？有什么区别和使用场景？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-browser-017`
> 标签：#Web Worker, #Service Worker, #多线程

**💡 一句话速记**

Web Worker 是给页面跑耗时计算的后台线程（纯计算，用完销毁），与主线程 postMessage 通信。Service Worker 是浏览器和网络之间的可编程代理（离线缓存、推送、后台同步），独立于页面、有生命周期、可拦截 fetch 请求。两者都不能操作 DOM。

**📖 通俗详解**

**对比**：
| 维度 | Web Worker | Service Worker |
|---|---|---|
| 角色 | 页面的「计算助手」 | 浏览器/网络的「代理+缓存层」 |
| 生命周期 | 随页面 | 独立，跨页面/重启仍存在 |
| 通信 | postMessage | postMessage + fetch 拦截 + 消息推送 |
| DOM | ✗ | ✗ |
| 持久化 | ✗（SharedWorker 例外）| ✓（Cache API）|
| HTTPS | 不强制 | 强制（开发 localhost 例外）|
| 典型场景 | 大数据计算、图片处理、解析 | PWA 离线、推送通知、资源缓存 |

**Web Worker**：
- 主线程把耗时任务（排序、解析、图像处理）扔给 worker，避免阻塞 UI。
- 数据通过 `postMessage` 传递（结构化克隆，大对象可用 Transferable 零拷贝转移 ArrayBuffer）。
- 细分：Dedicated Worker（单页面）、Shared Worker（多页面共享）。

**Service Worker**：
- 注册后由浏览器在后台运行，**有独立生命周期**：install → activate → fetch/message 事件。
- 监听 `fetch` 事件，可决定「走缓存还是走网络」——这是 PWA 离线可用、秒开的核心。
- 监听 `push` 事件实现 Web 推送（即使页面没开）。
- 监听 `sync` 事件实现后台同步。
- 注意：闲置会被浏览器停止，事件触发时再唤醒（事件驱动）。

**类比**：Web Worker 像「雇个临时工算账」（用完走人）；Service Worker 像「装了个智能管家」（长期住着，替你管快递、缓存、通知）。

**🔧 示例 / 代码**

```javascript
// Web Worker —— 主线程
const worker = new Worker('./heavy.js');
worker.postMessage({ data: bigArray }, [bigArray.buffer]); // Transferable 零拷贝
worker.onmessage = (e) => console.log('结果', e.data);

// heavy.js (worker 内)
self.onmessage = (e) => {
  const result = heavyCompute(e.data.data);
  self.postMessage(result);
};
```

```javascript
// Service Worker —— 注册（主线程）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => console.log('registered', reg));
}

// sw.js (Service Worker)
const CACHE = 'v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/app.js','/style.css'])));
});

self.addEventListener('activate', e => {
  // 清理旧缓存
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  // 缓存优先，回退网络
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }))
  );
});
```

**🔍 常见追问**

- 为什么 Worker 不能操作 DOM？（避免多线程并发修改 DOM 的竞态）
- postMessage 传大对象性能差怎么办？（Transferable / SharedArrayBuffer）
- Service Worker 更新后旧页面还用旧版本，怎么平滑升级？（skipWaiting + clients.claim）
- PWA 离线原理是什么？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》浏览器板块「多线程：service worker / web worker」+ MDN 文档。建议结合 MDN「Web Workers API」「Service Worker API」核验。出处：doc/前端知识体系.md:126-128

---

## cross-platform

### 35. 瀑布流布局怎么实现？有哪些方案？

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 低频 · `fe-cross-003`
> 标签：#瀑布流, #布局, #实现

**💡 一句话速记**

三种方案：①CSS columns（最简单，但顺序是列优先）②JS 分列（计算每列高度，新元素放最短列，顺序正确）③CSS Grid（masonry 还在实验中）。实际项目多用 JS 分列方案，控制精确、顺序正确。

**📖 通俗详解**

**瀑布流特点**：等宽不等高的卡片，像 Pinterest 那样错落排列，填满空间无大空白。

**方案一：CSS columns（最简单）**：
- `column-count` 分列，元素自动流入。
- 优点：纯 CSS，代码少。
- 缺点：**填充顺序是列优先**（先填满第一列再第二列），不是常见的行优先（左到右、上到下）。视觉顺序奇怪。

**方案二：JS 分列（主流）**：
- 固定 N 列，维护每列当前高度。
- 新元素来，放进**当前最矮的列**。
- 优点：顺序正确（行优先）、空间利用率高。
- 缺点：要写 JS，元素高度变化要重排。

**方案三：CSS Grid masonry**：
- `grid-template-rows: masonry`（实验特性）。
- 优点：纯 CSS 且顺序正确。
- 缺点：浏览器支持差，还在实验。

**JS 分列核心逻辑**：
1. 初始化 N 个列，记录每列高度（初始 0）。
2. 每个元素：找到高度最小的列，append 进去，更新该列高度。
3. 窗口 resize 时重新计算列数。

**🔧 示例 / 代码**

**JS 瀑布流核心**：
```javascript
function waterfall(container, items, columnCount = 3) {
  const columns = new Array(columnCount).fill(0); // 每列高度
  const colWidth = container.clientWidth / columnCount;
  items.forEach(item => {
    // 找最矮的列
    const minCol = columns.indexOf(Math.min(...columns));
    // 定位
    item.style.position = 'absolute';
    item.style.left = minCol * colWidth + 'px';
    item.style.top = columns[minCol] + 'px';
    item.style.width = colWidth + 'px';
    // 更新该列高度（需等图片加载后才知道实际高度）
    columns[minCol] += item.offsetHeight;
  });
}
```

**CSS columns 方案（简单但有顺序问题）**：
```css
.masonry { column-count: 3; column-gap: 10px; }
.masonry > div { break-inside: avoid; margin-bottom: 10px; }
```

**🔍 常见追问**

- 瀑布流里图片高度异步加载怎么处理？（提示：onload 后重排）
- 无限滚动的瀑布流，新数据来了怎么高效追加？
- CSS columns 的列优先顺序问题能解决吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-跨端板块（含「瀑布流的实现」）+ 模型知识。出处：doc/前端知识体系.md:174

---

### 36. 如何实现一个轮播图（carousel）？请手写。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 低频 · `fe-cross-005`
> 标签：#轮播图, #实现, #高频

**💡 一句话速记**

核心：用 transform: translateX 做位移，定时器自动切换 + 拖拽/点击手动切换；无缝循环靠克隆首尾元素实现。

**📖 通俗详解**

**轮播图核心实现**：

**1. 结构**：一个容器 overflow:hidden，里面一个 track（flex 横排所有 slide），用 transform 移动 track。

**2. 自动播放**：setInterval 定时切换到下一张。

**3. 手动切换**：左右按钮、指示点、移动端 touch 拖拽。

**4. 无缝循环（关键）**：
- 在最后一张后面克隆一份第一张，在第一张前面克隆一份最后一张。
- 滚到克隆的第一张时，瞬间（无过渡）跳回真正的第一张，用户感觉是无缝的。

**性能要点**：用 transform 而非 left（transform 走合成层，不触发重排）。

**🔧 示例 / 代码**

**轮播核心逻辑**：
```javascript
let current = 0;
const slides = [cloneLast, ...realSlides, cloneFirst]; // 克隆首尾
let animating = false;

function goTo(index, animate = true) {
  if (animating) return;        // 防快速点击
  animating = true;
  track.style.transition = animate ? 'transform 0.3s' : 'none';
  track.style.transform = `translateX(-${index * slideWidth}px)`;
  current = index;
}

// 过渡结束：如果到了克隆位，瞬间跳回真实位
track.addEventListener('transitionend', () => {
  animating = false;
  if (current === 0) goTo(realLength, false);       // 在克隆的末尾→跳真末尾
  if (current === slides.length - 1) goTo(1, false); // 在克隆的开头→跳真开头
});

// 自动播放
setInterval(() => goTo(current + 1), 3000);
```

**🔍 常见追问**

- 用 CSS scroll-snap 实现轮播和 JS 实现各有什么优劣？
- 轮播图在 SSR 下要注意什么？

---

**▶ 追问 1：轮播图有哪些常见的踩坑点？**

**💡 一句话速记**

常见踩坑：快速点击导致动画乱（要加 animating 锁）、拖拽距离阈值判断、离开页面暂停自动播放、窗口 resize 重算宽度、移动端 touch 事件处理。

**📖 通俗详解**

**踩坑点**：
1. **快速点击**：过渡动画没结束又点，会乱。要加锁（animating 标记）。
2. **拖拽距离阈值**：拖超过一半切下一张，否则回弹。
3. **离开页面暂停**：visibilitychange 或鼠标离开暂停自动播放。
4. **响应式**：窗口 resize 要重算 slide 宽度。
5. **性能**：用 transform 而非 left（transform 走合成层，不触发重排）。

**🔍 常见追问**

- 无限循环除了克隆还有别的方案吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-跨端板块（含「轮播图的实现」）+ 模型知识。出处：doc/前端知识体系.md:175

---

### 37. Taro 跨端框架的原理是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-cross-001`
> 标签：#taro, #跨端, #编译, #高频

**💡 一句话速记**

Taro 原理是「编译时 + 运行时」：编译时把 React 代码转成各端的代码（小程序转 WXML/WXSS/JS，H5 转原生标签）；运行时提供统一的组件库和 API 适配层，抹平各端差异。本质是「用 React 语法描述 UI，编译器翻译成各端产物」。

**📖 通俗详解**

**Taro 的两层架构**：

**1. 编译时（核心）**：
- 你写 React（JSX）代码。
- Taro 编译器把 JSX 转成各端能跑的代码：
  - 微信小程序：JSX → WXML，CSS → WXSS，JS → 小程序 JS（组件转成 view/text 等小程序标签）。
  - H5：JSX → React（标签转成 div/span）。
  - RN：JSX → RN 组件（View/Text）。
- 这是 Taro3 之前的核心，编译期完成大部分转换。

**2. 运行时**：
- 提供统一组件库（`<View>`、`<Text>`，各端映射到各自原生组件）。
- 提供统一 API（`Taro.request` 等，内部适配各端实现）。
- Taro3 引入了运行时方案：在小程序里实现一个「React 运行时」，不再纯靠编译，更接近 React 原生写法。

**🔧 示例 / 代码**

**Taro 代码 → 多端产物**：
```jsx
// 你写的（一套代码）
<View className="box">
  <Text>{title}</Text>
  <Button onClick={handler}>点击</Button>
</View>

// 编译到微信小程序
<view class="box">
  <text>{{title}}</text>
  <button bindtap="handler">点击</button>
</view>

// 编译到 H5
<div class="box">
  <span>{title}</span>
  <button onClick={handler}>点击</button>
</div>
```

**🔍 常见追问**

- Taro3 的运行时方案和 Taro2 的纯编译方案有什么区别？为什么改？
- Taro 和 uni-app 跨端原理有什么不同？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-跨端板块（含「taro跨端框架的原理」）+ 模型知识。建议结合 Taro 官方文档核验。出处：doc/前端知识体系.md:172

---

### 38. 虚拟滚动（virtual scroll）的实现原理是什么？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-cross-002`
> 标签：#虚拟滚动, #长列表, #性能, #高频

**💡 一句话速记**

虚拟滚动只渲染可视区域的列表项，用绝对定位 + transform 偏移，滚动时动态替换内容，靠一个大的占位元素撑出总高度。核心：计算可视区间 [startIndex, endIndex]，只渲染这部分，用 padding/transform 撑出滚动条。

**📖 通俗详解**

**为什么需要虚拟滚动**：列表有上万条，全渲染 DOM 会卡死（DOM 太多）。虚拟列表只渲染可视区的几十条，滚动时动态替换。

**核心原理**：
1. **只渲染可视区**：根据滚动位置 scrollTop 和每项高度 itemHeight，算出当前该显示第几项到第几项（startIndex ~ endIndex）。
2. **偏移定位**：渲染的项用绝对定位/transform 偏移到正确位置（top = startIndex × itemHeight）。
3. **撑出总高度**：用一个占位 div 撑出 list.length × itemHeight 的总高度，让滚动条正常。
4. **滚动监听**：监听 scroll，scrollTop 变就重新计算 startIndex/endIndex，更新渲染。

**两种高度模式**：
- **定高**：每项高度固定，计算简单（startIndex = floor(scrollTop / itemHeight)）。
- **不定高**：项高度不一，要预估 + 缓存实际高度 + 动态修正，复杂得多。

**🔍 常见追问**

- 不定高虚拟列表怎么实现？（提示：预估高度 + 实际测量缓存 + 二分查找）
- 虚拟滚动滚动过快会白屏怎么办？（提示：加 buffer、预渲染）
- React Window / react-virtualized 这些库比手写强在哪？

---

**▶ 追问 1：请手写一个简化版的虚拟滚动。**

**💡 一句话速记**

只渲染可视区域：容器固定高度+内容区绝对定位，根据scrollTop计算startIndex/endIndex，只渲染这部分item，用transform偏移。

**📖 通俗详解**

关键计算：visibleCount=容器高度/itemHeight，startIndex=Math.floor(scrollTop/itemHeight)，endIndex=startIndex+visibleCount，offsetY=scrollTop。监听scroll更新这四个值。

**🔧 示例 / 代码**

**定高虚拟滚动简化版**：
```jsx
function VirtualList({ items, itemHeight = 40, visibleHeight = 400 }) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * itemHeight;
  // 可视区间
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(visibleHeight / itemHeight) + 2, // +2 buffer
    items.length
  );
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div style={{ height: visibleHeight, overflowY: 'auto', position: 'relative' }}
         onScroll={e => setScrollTop(e.target.scrollTop)}>
      {/* 占位撑总高度 */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可视项，偏移定位 */}
        {visibleItems.map((item, i) => (
          <div key={startIndex + i}
               style={{ position: 'absolute', top: offsetY + i * itemHeight, height: itemHeight }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-跨端板块（含「虚拟滚动的实现」）+ 模型知识。建议结合 react-window 源码核验。出处：doc/前端知识体系.md:173

---

### 39. Electron 和 NW.js（node-webkit）有什么区别？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-cross-004`
> 标签：#electron, #nw.js, #桌面应用, #Tauri

**💡 一句话速记**

两者都用 Chromium + Node 做 Web 桌面应用，区别在架构：Electron 多进程（主进程用 Node + 渲染进程用 Chromium），渲染进程默认隔离、要 IPC 调 Node；NW.js 单进程，把 Node 直接注入 DOM。Electron 进程隔离更安全、生态更主流，NW.js 基本被淘汰。

**📖 通俗详解**

**Electron vs NW.js**：
| 维度 | Electron | NW.js |
|---|---|---|
| 架构 | 主进程(Node)+渲染进程(Chromium)，多进程 | 单进程，Node 直接注入 DOM |
| Node 访问 | 渲染进程默认隔离，要 IPC 调主进程 | DOM 里直接能用 Node API |
| 安全 | 更好（进程隔离） | 较弱（DOM 直接碰 Node） |
| 生态 | 极成熟（VSCode/Slack/Discord） | 衰落 |

两者都是 Chromium + Node，但 Electron 的多进程架构更安全、更主流，NW.js 基本被淘汰。

**类比**：Electron 像「后厨（Node）和前厅（页面）分两个房间，靠传菜口（IPC）沟通」；NW.js 像「后厨直接开在前厅里，服务员能直接伸手」。

**🔧 示例 / 代码**

**Electron 多进程模型**：
```
主进程(Node) ←IPC→ 渲染进程1(Chromium)
                  渲染进程2(Chromium)
渲染进程要调系统API → 通过IPC让主进程(Node)执行 → 结果返回
```

**🔍 常见追问**

- Electron 的 contextIsolation 和 nodeIntegration 为什么默认关？
- Electron 的 IPC 通信有性能瓶颈吗？
- 为什么 NW.js 输给了 Electron？

---

**▶ 追问 1：做桌面应用，Electron 和 Tauri 怎么选型？**

**💡 一句话速记**

新项目首选 Tauri（用系统 WebView + Rust 后端，包小、内存低、性能接近原生），但团队要会 Rust 且渲染依赖系统 WebView 可能有差异；追求生态成熟、各端渲染绝对一致、团队熟 JS 则选 Electron。

**📖 通俗详解**

**Electron vs Tauri**：
| 维度 | Electron | Tauri |
|---|---|---|
| 渲染引擎 | 自带 Chromium | 用系统 WebView（Win=WebView2, Mac=WKWebView） |
| 后端 | Node.js | Rust |
| 安装包 | 大（~100MB+） | 极小（~10MB） |
| 内存 | 高 | 低 |
| 生态 | 极成熟 | 发展中 |
| 兼容性 | 各端一致（自带 Chromium） | 依赖系统 WebView，可能有差异 |

**选型建议**：
- 追求包小、内存低、性能 → **Tauri**（但团队要会 Rust）。
- 追求生态成熟、各端渲染绝对一致、团队熟 JS → **Electron**。
- 老项目迁移 → 评估成本，Electron→Tauri 主要是渲染层不变、后端 Node 改 Rust。

**🔧 示例 / 代码**

**包体/内存对比**：
```
Electron: 自带 Chromium → 包 ~100MB+，内存高
Tauri:    用系统 WebView → 包 <10MB，接近原生性能
         后端 Rust → 安全、高效
```

**🔍 常见追问**

- Tauri 用系统 WebView，不同系统的渲染差异怎么处理？
- Tauri 的 Rust 后端，前端团队上手成本高吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-跨端板块（含「electron和nw的区别」）+ 模型知识。建议结合 Electron/Tauri 官方文档核验。出处：doc/前端知识体系.md:176

---

## css

### 40. CSS 盒模型有哪几种？`box-sizing` 的作用是什么？两种盒模型的区别是什么？

> ⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-001`
> 标签：#盒模型, #box-sizing, #高频

**💡 一句话速记**

盒模型分标准盒模型（content-box，默认）和怪异盒模型（border-box）。前者 width 只含内容，后者 width 包含内容+padding+border，开发中几乎都用 border-box。

**📖 通俗详解**

盒模型由内到外四部分：**content（内容）、padding（内边距）、border（边框）、margin（外边距）**。

两种模型的区别就在 `width` 到底算哪部分：

| 模型 | box-sizing | width 包含 | 加 padding 后盒子的实际占地宽度 |
|---|---|---|---|
| 标准盒模型（默认） | content-box | 仅 content | width + padding + border，盒子被撑大 |
| 怪异盒模型 | border-box | content+padding+border | 不变，padding 从 content 里扣 |

**类比**：content-box 像「你买了个 200平 的毛坯房，装修（padding）和砌墙（border）还要额外占地方，最后房子更大了」；border-box 像「房子总共就 200平，装修砌墙都算在里面，外墙尺寸不变」。

**实践**：全局加 `* { box-sizing: border-box; }`，尺寸计算直观，避免 padding 把布局撑乱。margin 始终不算在 width 里（两种模型都是）。

**🔧 示例 / 代码**

```css
/* 默认：标准盒模型 */
.box1 {
  width: 200px;
  padding: 20px;
  border: 5px solid #000;
  /* 实际占地宽度 = 200 + 20*2 + 5*2 = 250px */
}

/* 怪异盒模型：尺寸固定不撑大 */
.box2 {
  box-sizing: border-box;
  width: 200px;
  padding: 20px;
  border: 5px solid #000;
  /* 实际占地宽度仍 = 200px，content 被 padding/border 挤压 */
}

/* 全局推荐写法 */
*, *::before, *::after {
  box-sizing: border-box;
}
```

**🔍 常见追问**

- `outline`（轮廓）算在盒模型里吗？它和 border 有什么区别？（提示：outline 不占布局空间）
- 相邻块级元素的 margin 为什么会「折叠」？折叠规则是什么？
- inline 元素的 padding/margin 在垂直方向上表现有什么不同？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点 + 模型知识。建议结合 MDN「box-sizing」核验。出处：doc/前端知识体系.md:54-64

---

### 41. CSS 选择器的优先级（specificity）如何计算？`!important` 在其中起什么作用？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-002`
> 标签：#选择器, #优先级, #specificity, #高频

**💡 一句话速记**

优先级按 (行内样式, ID, 类/属性/伪类, 元素/伪元素) 四级比较，从左到右高位大的胜出；同级则后写的覆盖先写的；`!important` 凌驾于所有规则之上但应慎用。

**📖 通俗详解**

浏览器用「特指度」（specificity）四元组 (a, b, c, d) 判断谁赢：

| 级别 | 对应选择器 | 权重示例 |
|---|---|---|
| a 行内样式 | `style=""` | (1,0,0,0) |
| b ID | `#id` | (0,1,0,0) |
| c 类/属性/伪类 | `.class`、`[type]`、`:hover` | (0,0,1,0) |
| d 元素/伪元素 | `div`、`::before` | (0,0,0,1) |
| 通配/继承 | `*`、继承来的 | (0,0,0,0) |

比较时**从左到右逐位比**，左边大的直接赢（注意不是简单的十进制加法，11 个 class 不会超过 1 个 ID）。

举例：`#nav .item:hover` = (0,1,2,0)；`div ul li a` = (0,0,0,4)。

**`!important`**：给单条声明开「外挂」，优先级最高，甚至覆盖行内样式。多个 !important 之间再比 specificity。它是维护噩梦，应尽量避免，只在覆盖第三方库样式时用。

**记忆口诀**：ID 横着走（最贵），class 是主力，标签是底层，行内样式能掀桌，!important 砸场子。

**🔧 示例 / 代码**

```css
/* 同优先级，后写的覆盖先写的 */
.text { color: red; }
.text { color: blue; }   /* 生效：蓝色 */

/* ID 打 class，再多 class 也没用 */
#title { color: green; }          /* (0,1,0,0) 赢 */
.a.b.c.d.e.f.g.h { color: red; }  /* (0,0,8,0) 输 */

/* !important 最强，慎用 */
.btn { color: red !important; }
<button class="btn" style="color:blue">我仍是红色</button>
```

**🔍 常见追问**

- 两个 `!important` 规则冲突时谁赢？（提示：再回到 specificity 比较）
- 继承来的样式优先级是多少？（提示：比通配符还低，会被任意直接规则覆盖）
- `:not()`、`:is()`、`:where()` 对优先级有什么影响？（提示：:where() 永远是 0）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点 + 模型知识。建议结合 MDN「Specificity」核验。出处：doc/前端知识体系.md:54-64

---

### 42. CSS `position` 的五个取值（static/relative/absolute/fixed/sticky）各有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-003`
> 标签：#position, #定位, #sticky, #高频

**💡 一句话速记**

static 默认不定位；relative 相对自己原位置偏移且占位；absolute 相对最近非 static 祖先且脱标不占位；fixed 相对视口且脱标；sticky 滚动未达阈值时像 relative、达到阈值后像 fixed。

**📖 通俗详解**


| 取值 | 定位参考系 | 是否脱离文档流 | 原位置是否保留 |
|---|---|---|---|
| static（默认） | 不定位，top/left 无效 | 否 | — |
| relative | 自身原本在文档流中的位置 | 否 | 保留（占位） |
| absolute | 最近的 position ≠ static 的祖先，没有则 html | 是 | 不保留 |
| fixed | 浏览器视口（有 transform 祖先时例外） | 是 | 不保留 |
| sticky | 滚动容器，阈值前 relative、阈值后 fixed | 否（达标前）/是（达标后） | 阈值前保留 |

**关键点**：
1. `absolute` 找不到 positioned 祖先时相对 `html`（初始包含块）。常见套路是父级 `position: relative`，子级 `absolute`，让子相对父定位。
2. `fixed` 如果祖先有 `transform`/`filter`/`will-change` 等属性，会变成相对那个祖先而非视口，这是常见坑。
3. `sticky` 必须设定 `top`/`left` 等阈值才生效，且父容器不能 `overflow: hidden`，否则滚动监听失效。

**类比**：static 是普通座位；relative 是「起身倾斜一下但座位还在」；absolute/fixed 是「彻底离座另找位置」；sticky 是「座位还在，但滚到某处会粘住」。

**🔧 示例 / 代码**

```css
/* 父相对、子绝对：经典定位组合 */
.parent { position: relative; }
.child  { position: absolute; top: 10px; right: 10px; }

/* 吸顶导航 */
.header {
  position: sticky;
  top: 0;            /* 必须有阈值 */
  z-index: 10;
}

/* 固定回到顶部按钮 */
.back-top { position: fixed; right: 20px; bottom: 20px; }
```

**🔍 常见追问**

- `absolute` 元素的父级都是 static，它相对谁定位？（提示：html / 初始包含块）
- `fixed` 元素的祖先有 `transform`，会带来什么问题？（提示：参考系变了）
- `sticky` 为什么有时候不生效？常见失效原因有哪些？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点 + 模型知识。建议结合 MDN「position」核验。出处：doc/前端知识体系.md:54-64

---

### 43. 实现元素水平垂直居中有哪些方案？各自适用什么场景？

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-css-004`
> 标签：#居中, #flex, #grid, #高频

**💡 一句话速记**

现代首选 `display:flex; justify-content:center; align-items:center;`（一行搞定）；grid 用 `place-items:center` 更简洁；不知宽高时用 `absolute + transform:translate(-50%,-50%)`。

**📖 通俗详解**

按「是否需要知道宽高」分类记忆：

| 方案 | 关键代码 | 是否需知宽高 | 备注 |
|---|---|---|---|
| flex | 父 `display:flex; justify-content:center; align-items:center;` | 否 | 现代首选 |
| grid | 父 `display:grid; place-items:center;` | 否 | 最简洁 |
| absolute + transform | 子 `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);` | 否 | 不需知宽高 |
| absolute + margin 负值 | 子 `left:50%; top:50%; margin:-w/2 -h/2;` | 是 | 需知宽高 |
| absolute + margin auto | 子 `position:absolute; inset:0; margin:auto;` | 是 | 需知宽高 |
| 行内文本 | 父 `text-align:center; line-height=高;` 或 table-cell | — | 适合单行文字 |

**核心原理**：flex/grid 的 `align/justify` 是浏览器帮你算居中；`transform:translate(-50%)` 是按自身尺寸百分比位移，所以不需要知道宽高；而 `margin 负值` 必须手动写死一半宽高。

**选择建议**：能用 flex/grid 就用，简单可靠；做弹窗/遮罩层这种脱离文档流的，用 absolute+transform。

**🔧 示例 / 代码**

```css
/* 方案一：flex（最常用） */
.parent {
  display: flex;
  justify-content: center;   /* 水平居中 */
  align-items: center;       /* 垂直居中 */
  height: 300px;
}

/* 方案二：grid 一行 */
.parent { display: grid; place-items: center; }

/* 方案三：absolute + transform（弹窗常用，不需知宽高） */
.center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}
```

**🔍 常见追问**

- `transform:translate(-50%,-50%)` 为什么不需要知道元素宽高？（提示：% 基于自身尺寸）
- flex 布局里子项太多时，`align-items` 和 `align-content` 有什么区别？
- 如何让一段多行文字垂直居中？（提示：flex 或 `display:table-cell; vertical-align:middle;`）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点 + 模型知识。建议结合 MDN「flex」「transform」核验。出处：doc/前端知识体系.md:54-64

---

### 44. `flex: 1` 这个缩写的完整含义是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-005`
> 标签：#flex, #flex-grow, #flex-shrink, #flex-basis, #高频

**💡 一句话速记**

`flex: 1` 等价于 `flex: 1 1 0%`，即 grow=1（有剩余则放大占满）、shrink=1（空间不足则缩小）、basis=0%（初始基准为 0，完全靠 grow 分配）。所以 `flex:1` 的元素会自动占满剩余空间。

**📖 通俗详解**

`flex` 是 `flex-grow`、`flex-shrink`、`flex-basis` 三者的缩写。写 `flex: 1` 时，浏览器展开为 `1 1 0%`：
- 第一个 1 → flex-grow=1（放大比例）
- 第二个 1 → flex-shrink=1（缩小比例）
- 0% → flex-basis=0%（基准尺寸）

**关键**：basis=0% 意味着元素初始尺寸为 0，完全靠 grow 按比例分配空间，所以多个 `flex:1` 的元素会等分容器。如果是 `flex: 2` 则占两份。

**🔧 示例 / 代码**

```css
/* 三等分布局 */
.container { display: flex; }
.container > div { flex: 1; }   /* 三个子项各占 1/3 */

/* 固定侧栏 + 自适应主区 */
.layout { display: flex; }
.sidebar { flex: 0 0 200px; }   /* 不放大不缩小，固定 200px */
.main    { flex: 1; }           /* 占满剩余空间 */

/* 注意 flex:1 与 flex:1 1 auto 的区别 */
.a { flex: 1; }        /* basis:0% → 真均分 */
.b { flex: 1 1 auto; } /* basis:auto → 按内容宽，不一定均分 */
```

**🔍 常见追问**

- `flex:1` 和 `flex:1 1 auto` 在视觉上为什么可能不一样？（提示：basis 不同）
- `flex-basis` 和 `width` 同时设置时谁优先？（提示：basis 优先，auto 时才回退到 width）
- 如何实现「左侧固定宽、右侧自适应」的两栏布局？（提示：flex:0 0 200px + flex:1）

---

**▶ 追问 1：flex-grow、flex-shrink、flex-basis 分别代表什么？**

**💡 一句话速记**

flex-grow=放大比例（有剩余空间时按比例瓜分）、flex-shrink=缩小比例（空间不足时按比例收缩）、flex-basis=基准尺寸（分配空间前的初始大小）。

**📖 通俗详解**

| 子属性 | 含义 | 默认值 | 作用时机 |
|---|---|---|---|
| flex-grow | 放大比例：剩余空间按 grow 值瓜分 | 0（不放大） | 容器有剩余空间 |
| flex-shrink | 缩小比例：空间不足按 shrink 值收缩 | 1（等比缩小） | 容器空间不足 |
| flex-basis | 基准尺寸：分配空间前的初始大小 | auto（取 width/height） | 计算剩余空间前 |

**记忆**：grow 管「分余粮」（多了怎么分），shrink 管「抗饥荒」（少了怎么省），basis 管「起跑线」（从哪开始算）。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块 flex「flex 1缩写」（doc/前端知识体系.md:56）+ 模型知识。建议结合 MDN「flex」「flex-grow」核验。出处：doc/前端知识体系.md:56

---

### 45. 伪元素 `::before` 和 `:before` 有什么区别？`content` 属性起什么作用？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-css-008`
> 标签：#伪元素, #::before, #content, #clearfix

**💡 一句话速记**

`::before`（双冒号）是 CSS3 规范的伪元素写法，`:before`（单冒号）是 CSS2 旧写法，效果完全等价，现代浏览器都支持，推荐用双冒号。伪元素默认不生成，必须设置 `content` 属性才会出现在渲染树中。

**📖 通俗详解**

**双冒号 vs 单冒号**：
- CSS2 时代伪类和伪元素都用单冒号（`:hover`、`:before`）。
- CSS3 为了区分「伪类」（单冒号，如 `:hover :first-child`）和「伪元素」（双冒号，如 `::before ::after`），规定伪元素统一用双冒号。
- 为向后兼容，浏览器对 `:before` 仍按伪元素处理，所以两者等价。实际开发推荐双冒号以符合规范。

**`content` 的作用**：
- 伪元素本质是 CSS 生成的「假元素」，不在 HTML 中，**不写 content 它根本不会渲染**。
- content 可取值：字符串、`attr(属性名)`（取元素属性值）、`url(图片)`、`counter()`（计数器），以及最常见的空字符串 `content:''`（配合定位做装饰）。
- content 生成的内容**不可被用户选中、不可被 JS 直接操作**（非真实 DOM 节点）。

**常见用途**：clearfix 清除浮动、插入装饰图标/分隔线、CSS 计数器生成序号、用 `attr()` 提取 data 属性做 tooltip。

**类比**：伪元素像是用 CSS 「凭空变出来」的装饰贴纸，content 就是那张贴纸，不贴（不写 content）贴纸就不存在。

**🔧 示例 / 代码**

```css
/* 用法一：clearfix 清除浮动（最经典） */
.clearfix::after {
  content: '';          /* 必须有 content，哪怕空字符串 */
  display: block;
  clear: both;
}

/* 用法二：CSS 计数器自动编号 */
h2::before {
  content: '第 ' counter(chapter) ' 章 ';
  counter-increment: chapter;
  color: #888;
}

/* 用法三：attr() 读取 data 属性做 tooltip */
.tip::after {
  content: attr(data-tip);   /* 读取元素的 data-tip 属性 */
  position: absolute;
  background: #000;
  color: #fff;
}
```

**🔍 常见追问**

- 伪元素能被 `document.querySelector` 选中吗？能用 JS 修改它的 content 吗？（提示：不能直接选中，但可改父元素 class 间接切换）
- `content: counter()` 计数器怎么配合 `counter-reset`/`counter-increment` 使用？
- 为什么 clearfix 清除浮动要用伪元素而不是直接给父元素 overflow:hidden？（提示：避免副作用）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块 伪元素「双冒号和单冒号的区别 / content 的作用」（doc/前端知识体系.md:61-63）+ 模型知识。建议结合 MDN「::before」「content」核验。出处：doc/前端知识体系.md:61-63

---

### 46. 如何用 CSS 实现暗黑模式 / 主题切换？

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-css-009`
> 标签：#主题切换, #暗黑模式, #CSS变量, #prefers-color-scheme, #高频

**💡 一句话速记**

主流方案：用 CSS 自定义属性（变量）把颜色抽象出来，根元素切换 `data-theme` 属性改变量值，或用 `prefers-color-scheme` 媒体查询跟随系统。JS 只负责切换 data 属性，所有样式靠 CSS 变量自动响应。

**📖 通俗详解**

主题切换的核心思路是「把颜色抽象成变量，切换时只改变量值，不动具体样式」。

**方案一：CSS 变量 + data-theme 属性（最灵活，手动切换）**
1. `:root` 定义默认（亮色）变量。
2. `[data-theme="dark"]` 选择器重写变量为暗色。
3. 业务样式全部用 `var(--xxx)` 引用变量。
4. JS 切换：`document.documentElement.setAttribute('data-theme', 'dark')`。

**方案二：prefers-color-scheme 媒体查询（跟随系统）**
```css
@media (prefers-color-scheme: dark) { :root { --bg:#1a1a1a; --text:#eee; } }
```
适合「自动跟随用户系统设置」，无需手动按钮。

**方案三对比**：
| 方案 | 变量定义时机 | 是否可运行时切换 | 适用 |
|---|---|---|---|
| CSS 变量 | 运行时 | 是（改属性即生效） | 主题切换首选 |
| Sass/Less 变量 | 编译期 | 否（需多套 CSS） | 静态多主题 |
| CSS-in-JS | 运行时 | 是 | React 生态 |

**为什么 CSS 变量是首选**：运行时可改、浏览器原生、天然支持主题切换、性能好。Sass 变量编译完就固定，切主题要重新加载 CSS。

**记忆**：主题切换 = 「变量 + 状态切换」。把颜色变成变量是关键，切换方式只是触发器。

**🔧 示例 / 代码**

```css
/* 1. 定义亮色默认变量 */
:root {
  --bg: #ffffff;
  --text: #333333;
  --primary: #1890ff;
}

/* 2. 定义暗色变量（覆盖同名变量） */
[data-theme="dark"] {
  --bg: #1a1a1a;
  --text: #eeeeee;
  --primary: #3b9eff;
}

/* 3. 业务样式全部用变量 */
body { background: var(--bg); color: var(--text); }
.btn  { background: var(--primary); color: var(--bg); }
```
```html
<!-- 切换按钮 -->
<button onclick="toggleTheme()">切换主题</button>
<script>
  function toggleTheme() {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next); // 持久化用户选择
  }
  // 启动时恢复
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
</script>
```

**🔍 常见追问**

- CSS 变量和 Sass 变量的本质区别是什么？（提示：运行时 vs 编译时）
- 如何让主题跟随系统又允许用户手动覆盖？（提示：prefers-color-scheme 设默认值 + JS 改 data-theme 覆盖）
- 为什么 CSS 变量切换主题比改 class 名重新加载样式性能好？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块「主题切换如何实现」（doc/前端知识体系.md:64）+ 模型知识。建议结合 MDN「Using CSS custom properties」「prefers-color-scheme」核验。出处：doc/前端知识体系.md:64

---

### 47. CSS3 的 `transform`、`transition`、`animation` 有什么区别？分别怎么用？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-011`
> 标签：#CSS3, #transform, #transition, #animation, #动画, #高频

**💡 一句话速记**

transform 是「变换动作」（位移/缩放/旋转，不触发回流）；transition 是「被动过渡」（状态改变时平滑过渡，需触发）；animation 是「主动动画」（用 @keyframes 关键帧自动循环播放）。三者常配合使用。

**📖 通俗详解**

| 特性 | transform | transition | animation |
|---|---|---|---|
| 作用 | 元素变换（位移/缩放/旋转/倾斜） | 属性变化时的过渡效果 | 关键帧动画 |
| 触发方式 | 立即生效 | 需触发（hover、加 class、改值） | 可自动播放 |
| 能否循环 | 否 | 否 | 能（infinite） |
| 关键帧 | 无 | 只有起止两态 | 可定义多关键帧 |
| 性能 | 好（GPU 合成层，不触发回流） | 一般 | 一般 |

- **transform**：`translate()/scale()/rotate()/skew()`，改变视觉但**不影响文档流和布局**，走 GPU 合成层，性能最佳。它常作为动画的「动作来源」。
- **transition**：定义「属性值变化时怎么平滑过渡」。语法 `transition: property duration timing-function delay;`。只支持可插值的属性（颜色、数值），不支持从 `display:none` 过渡。
- **animation**：用 `@keyframes` 定义关键帧，配合 `animation: name duration timing-function delay iteration-count direction` 播放，支持循环、反向、暂停。

**三者配合**：用 `animation` 控制「何时播、播几次」，用 `transform` 决定「具体怎么动」。

**记忆**：transform 是「动作」，transition 是「被动过渡」，animation 是「主动导演」。

**🔧 示例 / 代码**

```css
/* transition：hover 时平滑放大 */
.btn { transition: transform 0.3s ease; }
.btn:hover { transform: scale(1.1); }

/* animation：无限旋转 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.loader { animation: spin 1s linear infinite; }

/* animation 多关键帧：弹跳 */
@keyframes bounce {
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-20px); }
  100% { transform: translateY(0); }
}
.ball { animation: bounce 0.6s ease infinite; }
```

**🔍 常见追问**

- `transition` 能让 `display:none → block` 平滑过渡吗？为什么？（提示：不能，display 不可插值，需用 opacity/visibility 替代）
- `transform` 为什么能 GPU 加速、不触发回流？（提示：作用于合成层，不改布局）
- `animation` 的 `steps()` 函数有什么用？（提示：雪碧图逐帧动画）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点（CSS3 新特性）+ 模型知识。建议结合 MDN「transform」「transition」「animation」核验。出处：doc/前端知识体系.md:54-64

---

### 48. 实现响应式布局有哪些常用方案？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-012`
> 标签：#响应式, #媒体查询, #rem, #vw, #高频

**💡 一句话速记**

主流：媒体查询 @media 做断点、弹性单位 rem/em/vw/vh 做缩放、flex/grid 弹性布局做自适应，新特性还有容器查询 @container。核心思想是「一套代码适配多端」。

**📖 通俗详解**

响应式 = 内容和布局随视口/容器变化而自适应。常用方案分三类：

**方案一：媒体查询 @media（断点切换样式）**
```css
@media (max-width: 768px) { /* 移动端 */ }
@media (min-width: 1200px) { /* 桌面端 */ }
```

**方案二：弹性单位（随参照物缩放）**
| 单位 | 相对什么 | 典型场景 |
|---|---|---|
| px | 绝对像素 | 精确控制 |
| em | 父元素字体大小 | 组件内局部 |
| rem | 根元素 html 字体大小 | 全局缩放，配媒体查询改 html font-size |
| vw/vh | 视口宽/高的 1% | 全屏布局 |
| % | 父元素尺寸 | 弹性容器 |
| vmin/vmax | 视口较小/较大边的 1% | 横竖屏自适应 |

**方案三：flex/grid 弹性布局**：本身就能自适应，配合 min-width/max-width 和 flex-wrap 自动换行。

**方案四：容器查询 @container**（较新）：基于**父容器**宽度而非视口响应，比媒体查询更精确，适合组件化场景。

**方案五：图片响应式**：`<picture>` + `srcset` 根据屏幕加载合适尺寸图片。

**移动端常用套路**：rem + flexible.js（动态设 html font-size）+ 媒体查询，或直接用 vw/vh。

**记忆**：媒体查询是「骨架断点」，弹性单位是「血肉缩放」，flex/grid 是「关节自适应」。

**🔧 示例 / 代码**

```css
/* rem + 媒体查询：不同屏宽下根字号变化 */
html { font-size: 16px; }                 /* 默认 */
@media (max-width: 768px) {
  html { font-size: 14px; }               /* 移动端缩小 */
}
.title { font-size: 1.25rem; }            /* 随根字号缩放 */

/* flex 自适应卡片：小屏单列、大屏多列 */
.cards { display: flex; flex-wrap: wrap; gap: 16px; }
.card  { flex: 1 1 300px; }               /* 最小 300px，自动换行 */

/* 容器查询：组件自身宽度决定布局 */
.card-container { container-type: inline-size; }
@container (min-width: 400px) {
  .card { display: flex; }                /* 容器够宽就横排 */
}
```

**🔍 常见追问**

- `rem` 和 `em` 的区别？为什么容易混淆出错？（提示：参照物不同，em 会逐级嵌套放大）
- 移动端为什么常用 rem 配合 flexible.js？（提示：动态算 html font-size 适配不同 dpr）
- 移动端「1px 边框」问题怎么解决？（提示：用 transform:scaleY(0.5) 或媒体查询按 dpr 调整）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块（doc/前端知识体系.md:54-64）补充的高频考点 + 模型知识。建议结合 MDN「Media queries」「rem」「Container queries」核验。出处：doc/前端知识体系.md:54-64

---

### 49. flex 容器空间不足时，`flex-shrink` 如何计算各子项实际收缩的宽度？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-006`
> 标签：#flex, #flex-shrink, #计算, #高频

**💡 一句话速记**

收缩不是简单等比例缩小，而是按 `shrink × basis` 的加权比例分配。某子项的收缩量 = 总溢出量 × (本项shrink×basis) / Σ(各项shrink×basis)。

**📖 通俗详解**

当 flex-shrink > 0 且主轴空间不够时，浏览器先算出溢出量，再按权重把溢出量分摊到各子项。

**计算步骤**：
1. 溢出量 = Σ(各项 basis) − 容器宽度
2. 权重和 = Σ(各项 flex-shrink × flex-basis)
3. 某项收缩量 = 溢出量 × (该项 shrink × 该项 basis) / 权重和
4. 某项最终宽度 = 该项 basis − 该项收缩量

**关键点**：权重是 `shrink × basis`，不是只看 shrink。因为 basis 大的元素「盘子大」，被砍的基数也大。所以 basis 大 + shrink 大的元素会被砍得最多。

**举例**：容器宽 600px，三个子项：
- A: basis=300, shrink=1
- B: basis=200, shrink=1
- C: basis=400, shrink=2

溢出量 = (300+200+400) − 600 = 300
权重和 = 300×1 + 200×1 + 400×2 = 300+200+800 = 1300
- A 收缩 = 300 × 300/1300 ≈ 69 → A 实际 ≈ 231
- B 收缩 = 300 × 200/1300 ≈ 46 → B 实际 ≈ 154
- C 收缩 = 300 × 800/1300 ≈ 185 → C 实际 ≈ 215
合计 ≈ 231+154+215 = 600（恰好填满容器，C 的 basis×shrink=800 占权重最大头被砍最多）

**注意**：实际浏览器还有 min-width 默认值（auto，约等于内容最小宽度）的保护，不会把元素缩到 0 或负值。

**🔧 示例 / 代码**

```css
/* 演示 flex-shrink 的加权收缩 */
.box { display: flex; width: 600px; }
.box > div { /* 默认 shrink:1, basis:auto(取width) */ }

.a { width: 300px; flex-shrink: 1; }  /* 收缩较少 */
.b { width: 200px; flex-shrink: 1; }
.c { width: 400px; flex-shrink: 2; }  /* basis 大 + shrink 大，收缩最多 */

/* 不希望某项被压缩：shrink 设为 0 */
.fixed { flex: 0 0 200px; }  /* 固定 200px，溢出也不缩 */
```

**🔍 常见追问**

- 如果某项 `flex-shrink: 0`，空间不足时会怎样？（提示：不收缩，可能溢出容器）
- flex 子项会被压缩到 0 宽度吗？什么在保护它？（提示：min-width:auto 默认保护）
- 为什么三个 shrink 都等于 1 时，收缩量却不相等？（提示：basis 不同导致权重不同）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块 flex「flex-shinrk」(原大纲拼写，即 flex-shrink)（doc/前端知识体系.md:57）+ 模型知识。建议结合 MDN「flex-shrink」核验。出处：doc/前端知识体系.md:57

---

### 50. 什么是 BFC（块级格式化上下文）？如何触发？有哪些典型应用场景？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-css-007`
> 标签：#BFC, #清除浮动, #margin塌陷, #高频

**💡 一句话速记**

BFC 是一块独立隔离的渲染区域，内部元素与外部互不影响。触发方式：overflow:hidden/auto、float、position:absolute/fixed、display:flex/inline-block/flow-root 等。应用：清除浮动、避免 margin 塌陷、自适应两栏布局。

**📖 通俗详解**

BFC = Block Formatting Context，块级格式化上下文。可理解为给元素套一个「结界」，里面元素的布局不影响外面，外面也不影响里面。

**BFC 的关键特性**：
1. 内部的 Box 在垂直方向上一个接一个放置。
2. **同一个 BFC 内**相邻 Box 的垂直 margin 会折叠（塌陷）。
3. BFC 区域**不会与 float 元素重叠**。
4. 计算 BFC 高度时，**浮动子元素也参与计算**。
5. BFC 是隔离容器，内部元素不影响外部。

**触发条件**（满足任一即可）：
- 根元素 html 本身就是 BFC
- float ≠ none（left/right）
- position 为 absolute 或 fixed
- display 为 inline-block / flex / inline-flex / grid / table-cell / **flow-root**
- overflow ≠ visible（hidden/auto/scroll）
- contain 为 layout/content/paint

**三大应用场景**：

| 场景 | 原理 | 做法 |
|---|---|---|
| 清除浮动（父高度塌陷） | 特性4：浮动子元素参与 BFC 高度计算 | 父元素 overflow:hidden 或 display:flow-root |
| 避免 margin 塌陷 | 特性2只发生在同 BFC，分到不同 BFC 就不塌 | 把其中一个元素包进新 BFC |
| 自适应两栏布局 | 特性3：BFC 不与浮动重叠 | 左浮动 + 右侧 overflow:hidden 自适应 |

**推荐**：清除浮动优先用 `display:flow-root`，它就是 W3C 专门为触发 BFC 设计的，没有 overflow:hidden 的副作用（不裁剪溢出内容、不挡阴影）。

**🔧 示例 / 代码**

```css
/* 场景一：清除浮动，解决父元素高度塌陷 */
.parent { display: flow-root; }   /* 触发 BFC，包住浮动子元素 */
/* 或用 clearfix 伪元素方案 */
.clearfix::after {
  content: '';
  display: block;
  clear: both;
}

/* 场景二：避免 margin 塌陷 */
.outer { overflow: hidden; }   /* 外层触发 BFC */
.inner { margin-top: 20px; }   /* 不会和外部 margin 合并 */

/* 场景三：自适应两栏（左侧固定浮动，右侧自适应） */
.layout { overflow: hidden; }  /* 触发 BFC */
.left  { float: left; width: 200px; }
.right { overflow: hidden; }   /* 右侧 BFC 不与浮动重叠，自动占剩余宽度 */
```

**🔍 常见追问**

- margin 塌陷发生在哪三种情况？（父子、相邻兄弟、空元素）
- 为什么 `overflow:hidden` 能清除浮动？它的原理是什么？
- `display:flow-root` 相比 `overflow:hidden` 触发 BFC 有什么优势？（提示：无裁剪副作用）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》CSS 板块 BFC「如何触发/应用」（doc/前端知识体系.md:58-60）+ 模型知识。建议结合 MDN「Block formatting context」核验。出处：doc/前端知识体系.md:58-60

---

## design-pattern

### 51. 设计模式分为哪三大类？前端常用的是哪些？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-dp-001`
> 标签：#设计模式, #分类, #创建型, #结构型, #行为型

**💡 一句话速记**

三大类：创建型（怎么创建对象，如单例/工厂）、结构型（怎么组合对象，如装饰器/代理/适配器）、行为型（对象间怎么通信，如观察者/发布订阅/策略）。前端最常用：单例、观察者/发布订阅、策略、装饰器、代理。

**📖 通俗详解**

**GoF 23 种设计模式分三类**：

**1. 创建型（Creational）—— 怎么创建对象**：
- 单例（Singleton）：全局只有一个实例（如全局状态、弹窗）。
- 工厂（Factory）：封装对象创建过程（如 React.createElement）。
- 建造者（Builder）：分步构建复杂对象。
- 原型（Prototype）：通过克隆创建（Object.create）。

**2. 结构型（Structural）—— 怎么组合对象**：
- 装饰器（Decorator）：动态加功能（高阶组件 HOC）。
- 代理（Proxy）：控制访问（Vue3 响应式、缓存代理）。
- 适配器（Adapter）：接口转换。
- 外观（Facade）：简化复杂接口。

**3. 行为型（Behavioral）—— 对象间怎么通信**：
- 观察者（Observer）：一对多通知（Vue 响应式）。
- 发布订阅（Pub/Sub）：通过中间人解耦（EventBus）。
- 策略（Strategy）：算法互换（表单校验规则）。
- 责任链（Chain of Responsibility）：请求链式传递（中间件）。
- 命令（Command）：封装请求。

**前端高频**：单例、发布订阅/观察者、策略、装饰器、代理、责任链（中间件）。

**设计模式本质**：是前人总结的「面向对象设计经验」，解决特定场景的复用、扩展、解耦问题。不是教条，是工具。

**🔧 示例 / 代码**

**前端场景映射**：
- 单例：Vuex/Redux store、全局弹窗、登录态管理。
- 观察者：Vue 响应式、MutationObserver。
- 发布订阅：EventBus、Node EventEmitter。
- 策略：表单校验（不同规则用不同校验函数）。
- 装饰器：React HOC、ES7 装饰器语法。
- 代理：Vue3 Proxy 响应式、图片懒加载代理。
- 责任链：Koa 洋葱圈中间件、Express 中间件。

**🔍 常见追问**

- 观察者模式和发布订阅模式有什么区别？（核心高频）
- 单例模式在前端怎么实现？有什么坑？
- 策略模式相比 if-else 优势在哪？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》设计模式板块（含「创建型」「结构型」「行为型」）+ 模型知识。建议结合《设计模式》/refactoring.guru 核验。出处：doc/前端知识体系.md:275-277

---

### 52. 单例模式是什么？前端有哪些应用场景？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-dp-003`
> 标签：#单例模式, #实现

**💡 一句话速记**

单例保证一个类全局只有一个实例，并提供全局访问点。前端应用：全局状态（store）、弹窗/登录框（只一个）、日志/请求工具类、全局配置。

**📖 通俗详解**

**单例模式**：保证一个类只有一个实例，并提供全局访问点。

**前端应用场景**：
1. **全局状态管理**：Redux/Vuex store 全局一个。
2. **弹窗/登录框**：整个应用只一个登录弹窗实例，避免重复。
3. **工具类**：日志、请求封装、缓存——全局复用一个。
4. **配置**：全局配置对象。

**实现方式**：

1. **闭包缓存实例**（经典）：用闭包变量存实例，getInstance 时判断。
2. **模块单例**（ES Module 天然单例）：ES Module 的导出是单例的（模块只执行一次），直接导出实例就是单例。
3. **全局变量**（简单粗暴）：挂 window，但不推荐（污染全局）。

**JS 的「线程安全」**：JS 单线程，不存在多线程竞争。但要防止「重复实例化」（比如惰性单例，第一次用才创建，之后复用）。

**🔍 常见追问**

- 单例模式有什么缺点？（全局状态难测试、隐式依赖）

---

**▶ 追问 1：怎么实现一个防重复实例化的单例？请手写。**

**💡 一句话速记**

用一个闭包变量缓存实例；getInstance 方法判断变量是否已有实例，没有就 new，有就直接返回。现代前端更推荐用 ES Module 的天然单例特性——模块只执行一次，导出的就是单例对象，不用手写 getInstance。

**📖 通俗详解**

**实现要点**：
- JS 单线程，不存在多线程竞争，单例的「安全」实际指「防止重复实例化」。
- 闭包变量缓存实例：getInstance 时判断，没有就创建，有就返回已有。
- 惰性单例：第一次用才创建，之后复用。
- ES Module 天然单例：模块只执行一次，导出的实例全局唯一。

**🔧 示例 / 代码**

```javascript
// 闭包缓存实例（经典写法）
const Singleton = (function () {
  let instance = null;
  function User(name) {
    this.name = name;
  }
  return {
    getInstance(name) {
      if (!instance) {
        instance = new User(name);  // 没有 new，有就直接返回已有
      }
      return instance;
    }
  };
})();
const a = Singleton.getInstance('Lee');
const b = Singleton.getInstance('Wang');
console.log(a === b); // true，全局唯一

// ES Module 天然单例（推荐）
// store.js
export const store = { user: null, setUser(u) { this.user = u; } };
// 任何地方 import { store } 都是同一个实例，模块只执行一次
```

**🔍 常见追问**

- 惰性单例（用的时候才创建）怎么实现？
- ES Module 为什么天然是单例？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》设计模式板块（含「创建型」）+ 模型知识。建议结合《JavaScript设计模式》核验。出处：doc/前端知识体系.md:275

---

### 53. 观察者模式和发布订阅模式有什么区别？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-dp-002`
> 标签：#发布订阅, #EventBus, #手写, #观察者, #高频

**💡 一句话速记**

观察者模式：目标和观察者直接耦合，目标直接通知观察者。发布订阅：目标和订阅者通过「事件中心（调度中心）」解耦，互不认识。区别就在有没有中间调度中心。手写 EventBus 核心：on 注册、emit 触发、off 取消。

**📖 通俗详解**

**两种模式的区别**（关键考点）：

**观察者模式（Observer）**：
- Subject（目标）直接维护 Observer 列表，状态变化时直接调用 Observer.update()。
- 目标和观察者**互相知道**对方（耦合）。
- 例子：Vue 的响应式（数据变了直接通知依赖它的渲染函数）。

**发布订阅模式（Pub/Sub）**：
- Publisher（发布者）和 Subscriber（订阅者）**互不认识**。
- 通过**事件中心（EventBus/消息总线）**中转：发布者只管发事件给中心，订阅者只管从中心收。
- 完全解耦。
- 例子：EventBus、Node EventEmitter、消息队列。

**核心区别**：有没有「调度中心」。观察者没中心（直连），发布订阅有中心（中转）。

**EventBus 实现**：
- 用一个对象存 {事件名: [回调函数数组]}。
- on(event, fn)：往对应事件数组里加回调。
- emit(event, data)：遍历对应事件数组，逐个调用回调。
- off(event, fn)：从数组里删除回调。
- once(event, fn)：注册只触发一次的回调。

**🔍 常见追问**

- EventBus 怎么实现 once（只触发一次）？
- 发布订阅模式会不会内存泄漏？（回调没 off 掉）
- Vue 的响应式是观察者还是发布订阅？（提示：观察者）

---

**▶ 追问 1：请手写一个发布订阅（EventBus）。**

**💡 一句话速记**

EventBus用对象存事件名→回调数组：on注册、emit遍历触发、off移除、once注册一次性。

**📖 通俗详解**

核心数据结构{event:[callbacks]}。on往数组push，emit遍历调用，off过滤删除。要注意emit时遍历的边界（回调里off导致的索引问题）。

**🔧 示例 / 代码**

EventBus 手写实现：on 方法把回调按事件名分组存入 Map；emit 方法取出该事件的所有回调逐个执行并传入数据；off 方法从数组移除指定回调；once 用包装函数实现触发后自动 off。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》设计模式板块（含红色高亮「实现发布订阅模式」）+ 模型知识。建议结合 Node EventEmitter 源码核验。出处：doc/前端知识体系.md:278

---

### 54. 策略模式、责任链模式、装饰器模式各自解决什么问题？它们的共同思想是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-dp-004`
> 标签：#策略模式, #责任链, #装饰器, #代理

**💡 一句话速记**

策略模式替代 if-else（把可互换的算法/规则封装起来）；责任链让请求沿链传递、每个节点决定处理或下传（中间件）；装饰器在不改原对象的前提下动态叠加功能（HOC）。三者都服务于「开闭原则」——对扩展开放、对修改封闭。

**📖 通俗详解**

**三种模式各自定位**：
| 模式 | 解决的问题 | 前端经典场景 |
|---|---|---|
| 策略模式（Strategy） | 多种算法/规则用 if-else 写很乱 → 封装成可互换策略 | 表单校验、折扣计算 |
| 责任链（Chain of Responsibility） | 一个请求要经过多个处理步骤、顺序可变 → 链式传递 | Koa/Express 中间件、事件冒泡 |
| 装饰器（Decorator） | 想加功能但不想改原对象 → 包一层叠加 | React HOC（withRouter、connect） |

**共同思想**：都是为「开闭原则」服务——对扩展开放，对修改封闭。加功能不改老代码。

各模式的实现细节和对比见下方追问链。

**🔧 示例 / 代码**

三者的最小骨架对比：
```javascript
// 策略：按 key 取函数执行，替代 if-else
const strategies = { required: v => !!v, email: v => /@/.test(v) };
function validate(type, val) { return strategies[type](val); }

// 责任链：每个节点 next() 决定继续还是停下
const chain = [auth, logger, biz];
function run(req, i = 0) { return chain[i] ? chain[i](req, () => run(req, i+1)) : req; }

// 装饰器：包一层加功能，不改原对象
const withLog = (fn) => (...args) => { console.log('call', args); return fn(...args); };
```

**🔍 常见追问**

- 策略模式和状态模式有什么区别？
- 中间件（洋葱圈）和经典责任链有什么不同？
- React HOC 和 Hook，哪个更符合装饰器思想？

---

**▶ 追问 1：策略模式怎么用？举一个前端实际例子（如表单校验）。**

**💡 一句话速记**

把每种规则封装成一个独立函数，存进对象（key→策略函数），调用时按类型取对应策略执行，新增规则只加一个策略函数、不改原逻辑，替代一长串 if-else。

**📖 通俗详解**

**策略模式要点**：
- 场景：表单校验有多种规则（必填、邮箱、手机号），用 if-else 写又长又难维护。
- 策略：每种规则封装成一个函数，存进对象，按字段类型取对应策略调用。
- 好处：加新规则只加一个策略函数，不改原逻辑（开闭原则）。
- 与状态模式的区别：策略是「外部选择用哪个算法」，状态是「对象内部状态变化自动切换行为」。

**🔧 示例 / 代码**

```javascript
const strategies = {
  required: (v) => !!v || '不能为空',
  email:    (v) => /@/.test(v) || '邮箱格式错误',
  phone:    (v) => /^1\d{10}$/.test(v) || '手机号错误',
};
function validate(type, val) { return strategies[type](val); }
// 新增「身份证」校验：只加 strategies.idcard，不改 validate
```

**🔍 常见追问**

- 策略模式和状态模式的边界在哪？
- 策略对象用 Map 还是普通对象？为什么？

---

**▶ 追问 2：责任链模式在前端怎么用？为什么中间件（洋葱圈）是它的变体？**

**💡 一句话速记**

把多个处理者串成链，请求从链头进入，每个节点决定「处理 / 传给下一个」；前端经典是 Express/Koa 中间件，请求依次经过 auth→logger→biz，每层可拦截、修改、放行。解耦，增删步骤不影响其他。

**📖 通俗详解**

**责任链模式要点**：
- 场景：一个请求要经过多个处理步骤（鉴权→日志→业务），且步骤顺序可能变化。
- 责任链：每个处理者持有「下一个」引用，决定「自己处理」还是「传给下一个」。
- 前端经典：Koa/Express 中间件（洋葱圈就是责任链变体，允许「前→后→前」来回执行）。
- 好处：解耦，增删处理步骤不影响其他。
- 与洋葱圈区别：经典责任链是「单向传递，处理完就停」；洋葱圈是「请求穿透到核心，响应再原路返回」，每层都有 before/after 两个钩子。

**🔧 示例 / 代码**

```javascript
// Express 风格责任链
function auth(req, res, next)  { if (!req.token) return res.end('no auth'); next(); }
function logger(req, res, next){ console.log(req.url); next(); }
app.use(auth);   // 鉴权不通过直接拦下
app.use(logger); // 打日志后放行
```

**🔍 常见追问**

- 洋葱圈的 next() 为什么是 async/await 友好的？
- 责任链里某节点忘了 next() 会发生什么？

---

**▶ 追问 3：装饰器模式怎么用？React HOC 是装饰器吗？**

**💡 一句话速记**

装饰器在不改原对象的前提下，包一层动态叠加新功能（日志/权限/缓存）；前端经典是 React 高阶组件（HOC）——withRouter、connect 都接收一个组件返回增强后的新组件，符合装饰器思想。

**📖 通俗详解**

**装饰器模式要点**：
- 场景：想给组件/函数加日志、权限、缓存，但不想改它本身。
- 装饰器：包一层，在原功能基础上加新功能，原对象不变。
- 前端经典：React 高阶组件（HOC）——withRouter、connect 都是装饰器思想。
- 好处：不改原对象，灵活叠加功能（单一职责）。
- HOC vs Hook：HOC 是「包一层组件」更贴合装饰器（套娃结构）；Hook 是「把逻辑抽成函数组合」，更偏组合而非包裹，所以 HOC 更符合经典装饰器语义。

**🔧 示例 / 代码**

```javascript
// 给函数加日志的装饰器
const withLog = (fn) => (...args) => {
  console.log('call', fn.name, args);
  return fn(...args);
};
const sum = withLog((a, b) => a + b);

// React HOC：包一层组件，注入路由 props
const withRouter = (Component) => (props) =>
  <Component {...props} router={useRouter()} />;
```

**🔍 常见追问**

- HOC 的 ref 转发为什么要 forwardRef？
- 多层 HOC 套娃会有什么问题？Hook 怎么解决的？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》设计模式板块（含「结构型」「行为型」）+ 模型知识。建议结合《设计模式》核验。出处：doc/前端知识体系.md:276-277

---

## engineering

### 55. Webpack 里 module、chunk、bundle 这三个概念分别是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-eng-001`
> 标签：#webpack, #bundle, #chunk, #module, #高频

**💡 一句话速记**

module 是源码里的单个文件（一切皆模块）；chunk 是 webpack 内部构建的代码块（打包过程的中间态，含入口chunk/异步chunk）；bundle 是最终输出的文件（chunk 经过处理后的产物）。关系：module → 组成 chunk → 输出 bundle。

**📖 通俗详解**

**三个概念的关系**（从源码到产物）：

1. **Module（模块）**：
- 你写的每一个源文件就是一个 module（JS、CSS、图片，一切皆模块）。
- webpack 从入口开始，通过 import/require 把所有依赖的 module 收集起来，形成依赖图。

2. **Chunk（代码块）**：
- webpack 构建过程中的**中间态**。一个 chunk 由多个 module 组成。
- 分类：
  - **Entry Chunk（入口 chunk）**：从 entry 生成的。
  - **Async Chunk（异步 chunk）**：动态 import（`() => import()`）产生的，按需加载。
  - **Common Chunk（公共 chunk）**：SplitChunksPlugin 抽取的公共代码。
- chunk 是 webpack 内部的概念，最终会被处理成 bundle。

3. **Bundle（产物）**：
- chunk 经过 webpack 处理（加运行时、压缩等）后输出的最终文件。
- 一个 chunk 通常对应一个 bundle 文件（但配置 minchunks/split 可能变化）。

**一句话流程**：源码 module → 依赖图 → chunk（分组） → bundle（输出文件）。

**🔧 示例 / 代码**

**示例流程**：
```
源码:
  entry.js (import a.js, import b.js)
  a.js (import c.js)
  动态 import('./d.js')

webpack 处理:
  module: entry.js, a.js, b.js, c.js, d.js
  chunk:  [entry, a, b, c] → main chunk
          [d]              → async chunk (动态加载)
  bundle: main.js, d.js  (最终输出文件)
```

**类比**：module 是砖头，chunk 是砌好的墙（几块砖组成），bundle 是建好的房子（墙组装好）。

**🔍 常见追问**

- SplitChunksPlugin 是怎么把公共代码抽成单独 chunk 的？
- 动态 import 产生的 chunk 怎么加载？
- bundle 和 chunk 在什么情况下不是一一对应？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-webpack 板块（含红色高亮「bundle、module、plugin的概念」）+ 模型知识。建议结合 webpack 官方文档核验。出处：doc/前端知识体系.md:231

---

### 56. pnpm 相比 npm/yarn 有什么优势？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-eng-005`
> 标签：#pnpm, #包管理, #lock, #高频

**💡 一句话速记**

pnpm 优势：用硬链接 + 软链接（content-addressable store）节省磁盘、严格依赖隔离（防幽灵依赖）、安装快、原生支持 monorepo。

**📖 通俗详解**

**pnpm 的核心优势**：

1. **节省磁盘（content-addressable store）**：
- npm/yarn：每个项目的 node_modules 都拷贝一份依赖，10 个项目用 React 就存 10 份。
- pnpm：全局 store 只存一份，各项目的 node_modules 用**硬链接**指向 store。省磁盘。

2. **严格的依赖隔离（防幽灵依赖）**：
- npm/yarn 的 node_modules 是扁平的，你能 import 没在 package.json 里声明但被其他包安装的依赖（幽灵依赖）。
- pnpm：node_modules 用软链接结构，**只有 package.json 声明的依赖才能被访问**。杜绝幽灵依赖，更安全。

3. **安装快**：硬链接 + 并行下载，比 npm/yarn 快。

4. **支持 monorepo**：workspace 原生支持，比 yarn workspace 更完善。

关于 lock 文件的作用见追问。

**🔧 示例 / 代码**

**pnpm 的 node_modules 结构**：
```
node_modules/
├── .pnpm/                    # 真实包都在这（软链接到全局store）
│   ├── react@18.0.0/
│   └── lodash@4.0.0/
├── react -> .pnpm/react@18.0.0/  # 软链接，只有声明的才能访问
└── lodash -> .pnpm/lodash@4.0.0/

# npm/yarn 的扁平结构（能访问到没声明的依赖）:
node_modules/
├── react/
├── lodash/   (可能是某个包的依赖，但你能直接 import → 幽灵依赖)
└── ...全部平铺
```

**🔍 常见追问**

- 幽灵依赖具体会带来什么问题？
- pnpm 的软链接结构有没有兼容性问题？（有些工具不认软链接）
- monorepo 里 pnpm workspace 怎么管理内部包依赖？

---

**▶ 追问 1：lock 文件的作用是什么？**

**💡 一句话速记**

lock 文件（package-lock.json / pnpm-lock.yaml / yarn.lock）锁定每个依赖的精确版本和完整性 hash，保证团队/CI 安装结果一致、可复现。

**📖 通俗详解**

**Lock 文件的作用**：
1. **锁定精确版本**：package.json 里写 `^1.2.0`（可装 1.x），lock 锁死到 `1.2.3`，避免不同人装到不同版本。
2. **锁定完整性**：记录每个包的 hash（integrity），防篡改、防缓存损坏。
3. **保证可复现**：任何人/CI 用 lock 安装，结果完全一致。
4. **加速安装**：不用重新解析依赖树。

**关键原则**：lock 文件要提交到 git，团队和 CI 共用一份。不该只 lock 不提交（那样 lock 就失去意义）。

**🔧 示例 / 代码**

**lock 锁定示例**：
```
package.json:  "react": "^18.0.0"   (范围，不精确)
lock:          "react@18.2.0"       (精确锁定)
```

**🔍 常见追问**

- lock 文件冲突怎么处理？该不该手动改？
- CI 里是优先用 lock 还是重新解析依赖？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-包管理板块（含「pnpm的优势」「package.json lock文件的作用」）+ 模型知识。建议结合 pnpm 官方文档核验。出处：doc/前端知识体系.md:243-244

---

### 57. Webpack 的打包原理是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-eng-002`
> 标签：#webpack, #打包原理, #loader, #plugin, #高频

**💡 一句话速记**

webpack 从入口出发递归构建依赖图，用 loader 把各类文件转成 JS 模块，分组生成 chunk，经 plugin 在生命周期各阶段干预后输出 bundle。

**📖 通俗详解**

**Webpack 打包原理**：
1. **读配置**：entry、output、loader、plugin。
2. **构建依赖图**：从 entry 开始，递归解析每个 import/require，用 loader 处理非 JS 文件，收集所有 module 及其依赖。
3. **生成 chunk**：根据依赖关系把 module 分组成 chunk。
4. **应用 plugin**：在编译生命周期的各钩子（编译开始/模块构建/优化/输出）执行 plugin 逻辑。
5. **输出 bundle**：把 chunk 写到 output 目录。
6. **产物**：bundle（含 webpack 运行时 + 模块代码）。

**一句话流程**：源码 module → 依赖图 → chunk（分组） → bundle（输出文件）。

其中 loader 在第 2 步负责「文件级转换」、plugin 在第 4 步负责「流程级干预」，二者详细区别见追问。

**🔍 常见追问**

- webpack 的构建生命周期有哪些关键 hook？

---

**▶ 追问 1：loader 和 plugin 有什么区别？各自做什么？**

**💡 一句话速记**

loader 做「文件级转换」——把非 JS 文件（CSS/图片/TS）转成 JS 模块，本质是一个字符串转换函数；plugin 做「流程级干预」——钩入构建生命周期各阶段做更宏观的任务（压缩、注入、生成文件），本质是一个带 apply 方法的类。loader 管「文件怎么读」，plugin 管「流程怎么跑」。

**📖 通俗详解**

**Loader（文件级转换）**：
- 作用：webpack 只懂 JS/JSON。遇到 CSS/图片/TS，loader 把它们转换成 JS 模块。
- 链式：多个 loader 从右到左执行（如 css-loader → style-loader）。
- 例子：
  - babel-loader：TS/ES6 → ES5。
  - css-loader：解析 CSS 的 import，处理成 JS。
  - file-loader：把图片转成 URL。
- 本质：一个输入源码字符串、输出转换后字符串的函数。

**Plugin（生命周期钩子）**：
- 作用：loader 做不了的事——在构建流程各阶段插入自定义逻辑。
- 例子：
  - HtmlWebpackPlugin：生成 HTML 并注入 bundle。
  - MiniCssExtractPlugin：抽 CSS 成单独文件。
  - DefinePlugin：注入环境变量。
  - 压缩、复制、清理等。
- 本质：一个带 apply 方法的类，注册到 compiler 的各 hook 上。

**区别总结**：loader 处理「单个文件怎么转」，plugin 处理「整个流程怎么干预」。loader 是流水线工人，plugin 是车间主管。

**🔧 示例 / 代码**

**Loader 简化实现**：
```javascript
// 一个 loader 就是个字符串转换函数
module.exports = function(source) {
  // source 是文件内容字符串
  return source.replace(/console\.log\(.*?\)/g, ''); // 删掉 console.log
};
```

**Plugin 简化实现**：
```javascript
class MyPlugin {
  apply(compiler) {
    // 钩到编译生命周期的某个阶段
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, cb) => {
      // compilation.assets 是所有输出文件
      console.log('即将输出文件...');
      cb();
    });
  }
}
```

**🔍 常见追问**

- 怎么写一个自定义 loader？（输入输出是什么）
- 怎么写一个自定义 plugin？（tapable 的 hook 机制）
- loader 的执行顺序为什么是从右到左？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-webpack 板块（含红色高亮「打包的原理」「loader和plugin的理解」「自定义plugin和loader」）+ 模型知识。建议结合 webpack 官方文档核验。出处：doc/前端知识体系.md:231-234

---

### 58. Vite 为什么比 Webpack 快？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-eng-003`
> 标签：#vite, #esm, #为什么快, #热更新, #高频

**💡 一句话速记**

Vite 快在：开发时用浏览器原生 ESM「按需加载」（不打包，请求哪个模块编译哪个），只有依赖预构建用 esbuild（极快）。Webpack 要先把所有模块打成 bundle 再启动，项目越大启动越慢。

**📖 通俗详解**

**Vite vs Webpack 的根本区别**：

**Webpack（bundle-based）**：
- 启动前要把所有 module 打成 bundle，项目越大启动越慢。
- 改一个文件，可能要重新构建整个 bundle（HMR 范围大）。

**Vite（ESM-based，开发时不打包）**：
- 利用浏览器原生 ESM：`import` 直接发请求加载模块。
- 开发服务器拦截请求，按需编译单个模块，返回 ESM 格式。
- **只有请求到的模块才编译**，启动极快（不管项目多大）。
- 依赖预构建：第三方依赖（node_modules）用 **esbuild**（Go 写的，比 babel 快 10-100 倍）预打包成 ESM，减少请求数。

**Vite 为什么快（三点）**：
1. **不打包**：开发时零打包，靠浏览器 ESM 按需加载。
2. **esbuild 预构建**：依赖用 esbuild（Go，多核并行，无 JS 开销）预构建，极快。
3. **按需编译**：只有访问到的模块才编译。

**🔧 示例 / 代码**

**Vite 开发时模块加载流程**：
```
浏览器请求 index.html
  → 里面 <script type="module" src="/main.js">
  → 浏览器请求 main.js（ESM）
  → main.js import './App.vue'
  → 浏览器请求 App.vue
  → Vite 拦截，编译 .vue 成 JS，返回
  → 浏览器继续解析 import，按需请求
```

**对比 Webpack**：
```
Webpack: 启动 → 打包所有模块成 bundle → 启动服务 → 访问
Vite:    启动 → 直接起服务 → 访问时按需编译
```

**🔍 常见追问**

- 为什么 Vite 生产环境用 Rollup 不用 esbuild？
- Vite 的 ESM 模式在旧浏览器怎么办？

---

**▶ 追问 1：Vite 的热更新（HMR）原理是什么？**

**💡 一句话速记**

Vite HMR 通过 WebSocket 精确通知：改文件后找到该模块，通过 WebSocket 通知浏览器某模块变了，浏览器带时间戳重新请求该模块，只有改动的模块及其依赖链重新编译，其余不动——精确、快。

**📖 通俗详解**

**Vite 热更新（HMR）原理**：
1. 改文件 → Vite 找到这个模块的「修改时间戳」变化。
2. 通过 WebSocket 通知浏览器「某模块变了」。
3. 浏览器重新请求这个模块（带时间戳绕过缓存）。
4. 只有改动的模块及其依赖链重新编译，其余不动 → 精确、快。
- 对比 Webpack：HMR 要重新计算受影响的 chunk，范围大。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-vite 板块（含「什么是esm」「vite为什么快，底层原理」「vite的热更新原理」）+ 模型知识。建议结合 Vite 官方文档核验。出处：doc/前端知识体系.md:238-241

---

### 59. Rsbuild（基于 Rspack）为什么比 Vite/Webpack 快？它的定位是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-eng-004`
> 标签：#rsbuild, #rspack, #rust, #为什么快

**💡 一句话速记**

Rspack 用 Rust 重写了 webpack 核心（兼容 webpack 生态），Rsbuild 是基于 Rspack 的开箱即用方案。比 Vite 快在：生产环境也极快（Vite 生产用 Rollup 较慢）；比 Webpack 快在：Rust 编译（多核并行、无 JS 开销）。定位：webpack 的性能替代品，迁移成本低。

**📖 通俗详解**

**Rspack（字节出品）**：
- 用 **Rust** 重写 webpack 核心。
- 兼容 webpack 的 loader/plugin API，迁移成本低（webpack 配置几乎能直接用）。
- Rust 性能：多核并行、无 JIT 开销、内存安全，编译速度比 webpack 快 5-10 倍。

**Rsbuild**：
- 基于 Rspack 的**开箱即用**构建方案（类似 create-react-app 的约定式配置）。
- 内置最佳实践（React/Vue 支持、代码分割、压缩等），零配置可用。
- 定位：让你享受 Rspack 的速度，又不用手写复杂配置。

**为什么比 Vite 快**（关键对比）：
- **Vite 的弱点**：开发快（ESM 不打包），但**生产环境慢**——要用 Rollup 打包，大项目生产构建慢。
- **Rspack/Rsbuild**：开发和生产都快，因为 Rust 打包本身就是强项，不管开发还是生产。
- 所以 Rsbuild 在**生产构建速度**上常常赢 Vite。

**为什么比 Webpack 快**：
- Webpack 用 JS 写，受 JS 单线程 + JIT 拖累。
- Rspack 用 Rust，多核并行、无 GC 压力、原生性能。

**定位总结**：
- Webpack：生态最全，但慢。
- Vite：开发体验无敌，生产用 Rollup（大项目慢）。
- Rspack/Rsbuild：webpack 的速度升级版，开发生产都快，迁移成本低。

**选型**：新项目追求速度 + 兼容 webpack 生态 → Rsbuild；追求开发体验极致 → Vite；老项目迁移 → Rspack（配置兼容）。

**🔧 示例 / 代码**

**速度对比（量级）**：
```
构建大项目:
Webpack: 60s
Vite(生产 Rollup): 20s
Rspack/Rsbuild: 5-10s

开发启动:
Webpack: 10-30s（要打包）
Vite: <1s（不打包）
Rsbuild: 1-3s（Rust 预打包快）
```

**Rsbuild 的卖点**：webpack 的配置/生态 + Rust 的速度。

**🔍 常见追问**

- Rspack 怎么做到兼容 webpack 的 loader/plugin？有兼容性坑吗？
- Rust 写的构建工具（Rspack/swc/esbuild）为什么比 JS 快这么多？
- Rsbuild 和 Turbopack（Vercel）有什么区别？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-rsbuild 板块（含「基本原理和优势」「为什么比vite快」）+ 模型知识。建议结合 Rspack/Rsbuild 官方文档核验。出处：doc/前端知识体系.md:235-236

---

### 60. CommonJS（CJS）和 ES Modules（ESM）有什么区别？为什么 ESM 是趋势？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-eng-006`
> 标签：#CommonJS, #ESM, #模块化, #高频

**💡 一句话速记**

CJS 用 require/module.exports（运行时加载、同步、可动态），ESM 用 import/export（编译时静态分析、异步、支持 tree-shaking）。ESM 是趋势因为：静态分析能力强（tree-shaking/优化）、官方标准、支持顶层 await、浏览器原生支持。

**📖 通俗详解**

**核心区别对比**：

| 维度 | CommonJS | ESM |
|---|---|---|
| 语法 | require/module.exports | import/export |
| 加载时机 | 运行时（动态） | 编译时静态分析 |
| 同步/异步 | 同步（阻塞） | 异步 |
| 动态导入 | require 可在任意位置 | 静态 import 顶层；动态用 import() |
| 值的拷贝 | 导出值的拷贝（改了不影响原） | 导出值的引用（绑定） |
| this | module.exports = {} | undefined |
| tree-shaking | 不支持（运行时才知道导出啥） | 支持（静态分析知道用了啥） |

**几个关键差异详解**：

1. **静态 vs 动态**：
- CJS：require 是运行时执行，可以写 `if (cond) require('./a')` 动态加载。
- ESM：import 在编译时静态分析，必须顶层、路径固定。这让工具能分析出哪些导出没被用 → tree-shaking。

2. **值的拷贝 vs 引用**：
- CJS 导出的是值的**拷贝**。模块内部变量变了，引入方拿到的还是旧值。
- ESM 导出的是**引用**（绑定）。模块内部变量变了，引入方能感知到。

3. **tree-shaking**：
- 只有 ESM 能 tree-shaking（静态分析未使用的导出并删除）。CJS 不行（运行时才知道）。
- 这是 ESM 成为趋势的重要原因——产物更小。

**为什么 ESM 是趋势**：
1. 官方标准，CJS 是 Node 私有。
2. 静态分析 → tree-shaking、优化、类型检查。
3. 浏览器原生支持（`<script type="module">`）。
4. 支持顶层 await。
5. 统一前后端模块系统。

**迁移痛点**：CJS 和 ESM 互操作有坑（default 导出、__dirname 在 ESM 没有、require 在 ESM 没有），Node 现在双轨支持。

**🔧 示例 / 代码**

**值的拷贝 vs 引用**：
```javascript
// CJS：值的拷贝
// lib.js
let count = 0;
module.exports = { count, inc: () => count++ };
// main.js
const { count, inc } = require('./lib');
inc();
console.log(count);  // 0（count 是拷贝，不变）

// ESM：引用
// lib.js
export let count = 0;
export const inc = () => count++;
// main.js
import { count, inc } from './lib';
inc();
console.log(count);  // 1（count 是引用，变了）
```

**tree-shaking**：
```javascript
// utils.js (ESM)
export const used = () => {};
export const unused = () => {};  // 没人用，打包时被删掉
// 如果是 CJS，exports.unused 删不掉（运行时才知道）
```

**🔍 常见追问**

- Node.js 怎么区分一个文件是 CJS 还是 ESM？（package.json type / .mjs/.cjs）
- ESM 里怎么用 __dirname/__filename？（提示：import.meta.url）
- CJS 和 ESM 互操作（CJS 里 import ESM）有什么坑？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-模块化板块（含「commonjs和esm的区别」）+ 模型知识。建议结合 Node.js/MDN 文档核验。出处：doc/前端知识体系.md:246

---

### 61. Webpack 的模块联邦（Module Federation）是什么？它和微前端是什么关系？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-eng-007`
> 标签：#webpack, #模块联邦, #微前端, #高频

**💡 一句话速记**

模块联邦让多个独立打包的应用在运行时共享模块——一个应用 expose 暴露模块，另一个远程 consume 消费，无需重新打包。它本质是一种微前端实现方案（运行时集成独立应用），也可用于组件/库的动态共享。

**📖 通俗详解**

**模块联邦核心概念**：

1. **Host（消费者）**：引用其他应用模块的应用。
2. **Remote（提供者）**：暴露模块给其他应用用的应用。
3. **运行时共享**：Host 启动时从 Remote 动态加载模块，不需要打包时静态引入。

**工作机制**：
- Remote 在 webpack 配置里 expose 一些模块（组件/函数/对象）。
- 这些模块被编译成独立的 chunk，可被远程加载。
- Host 配置 remotes 指向 Remote 地址，用 import 时运行时去 Remote 拉。
- 共享依赖（如 React）可配 singleton，全局只加载一份。

**模块联邦 vs 传统方式**：
- 传统：A 用 B 的代码，要么 npm 安装（构建时绑定），要么复制。
- 模块联邦：A 运行时动态从 B 加载，B 更新了 A 不用重新打包。

**和微前端的关系**：
- 模块联邦**是一种微前端实现方案**：多个独立应用运行时集成。
- 但比 qiankun 那种「整个子应用挂载」更细粒度——可以共享到单个组件级别。
- 优势：
  - 共享依赖（React 只加载一份）。
  - 细粒度（可共享单个组件，不用整个应用）。
  - 编译期就知道依赖关系，类型友好。
- 劣势：
  - 强依赖 webpack5+。
  - 配置复杂。
  - 版本兼容（Host 和 Remote 用的共享库版本要协调）。

**适用场景**：多个应用共享组件库、大型项目拆分独立部署、需要运行时动态集成。

**🔧 示例 / 代码**

**模块联邦配置**：
```javascript
// Remote（暴露组件的应用）
new ModuleFederationPlugin({
  name: 'remoteApp',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/components/Button',  // 暴露 Button 组件
  },
  shared: { react: { singleton: true } }   // React 共享，只加载一份
})

// Host（消费的应用）
new ModuleFederationPlugin({
  name: 'hostApp',
  remotes: {
    remoteApp: 'remoteApp@http://xxx/remoteEntry.js',
  },
  shared: { react: { singleton: true } }
})

// Host 里直接 import Remote 的组件（运行时加载）
const Button = React.lazy(() => import('remoteApp/Button'));
```

**🔍 常见追问**

- 模块联邦怎么处理共享依赖的版本冲突？
- 模块联邦和 qiankun 在微前端场景下各有什么优劣？
- remoteEntry.js 是怎么被加载和解析的？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》工程化-webpack 板块（含「模块联邦」）+ 模型知识。建议结合 webpack Module Federation 文档核验。出处：doc/前端知识体系.md:232

---

## js-principles

### 62. JavaScript 中 `this` 的指向规则是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-001`
> 标签：#this, #call, #apply, #bind, #高频

**💡 一句话速记**

`this` 在函数**调用时**才确定（动态），看「谁调用了函数」。5 种规则按优先级：默认绑定 < 隐式绑定 < 显式绑定(call/apply/bind) < new 绑定；箭头函数没有自己的 this，继承外层（静态，不受上述规则影响）。

**📖 通俗详解**

**`this` 指向规则**（按优先级从低到高）：
1. **默认绑定**：独立函数调用，非严格模式 `this` 是 window/global，严格模式是 undefined。
2. **隐式绑定**：`obj.fn()`，`this` 指向 obj（谁调用指向谁）。注意隐式丢失：`var bar = obj.fn; bar()` 会丢成默认绑定。
3. **显式绑定**：`fn.call(obj)` / `fn.apply(obj)`，强行指定 this（见追问1）。
4. **new 绑定**：`new fn()`，this 指向新创建的对象（优先级最高之一）。
5. **箭头函数**：**没有自己的 this**，继承定义时外层的 this（静态，不可被 call/apply/bind 改变）。

**优先级判断**：new > 显式 > 隐式 > 默认；箭头函数单独一路，一旦确定不可变。

**核心**：除箭头函数外，this 都是「调用时」确定的，不是「定义时」——这是它和大多数语言 this（词法作用域）的根本区别。

**🔧 示例 / 代码**

```javascript
const obj = { name: 'A', fn() { console.log(this.name); } };

// 隐式绑定：obj 调用 → this 是 obj
obj.fn();           // 'A'

// 隐式丢失：赋值后独立调用 → 默认绑定
var bar = obj.fn;
bar();              // undefined（严格模式）

// 显式绑定：call 强行指定 this
bar.call({ name: 'B' });  // 'B'

// new 绑定：this 指向新对象
function Person(name) { this.name = name; }
new Person('C').name;    // 'C'

// 箭头函数：继承外层 this，不受 call 影响
const arrow = () => console.log(this.name);
arrow.call({ name: 'D' }); // 仍是外层的 this，不是 'D'
```

**🔍 常见追问**

- 箭头函数能用 call 改变 this 吗？为什么？（提示：没有自己的 this）
- bind 之后再用 new 调用，this 指向谁？（提示：new 优先级更高）

---

**▶ 追问 1：`call`、`apply`、`bind` 三者有什么区别？**

**💡 一句话速记**

三者都能显式改变 this 指向。`call`/`apply` 立即执行且指定 this，区别仅在传参方式；`bind` 不立即执行，返回一个永久绑定 this 的新函数（还支持偏函数预置参数）。

**📖 通俗详解**

**三者区别**：
| 方法 | 执行时机 | 传参方式 | 返回 |
|---|---|---|---|
| call | 立即执行 | 参数逐个列举 `fn.call(obj, a, b)` | 函数返回值 |
| apply | 立即执行 | 参数数组 `fn.apply(obj, [a, b])` | 函数返回值 |
| bind | **不立即执行** | 参数逐个列举 | 返回新函数 |

**记忆口诀**：call 是「列参数」，apply 是「array 数组」，bind 是「绑定但不马上干」。

**bind 的额外能力**：返回的新函数还能继续传参（柯里化/偏函数），且若被 new 调用，绑定的 this 会让位于 new 的新对象。

**🔧 示例 / 代码**

```javascript
function greet(greeting, punct) {
  return greeting + ', ' + this.name + punct;
}
const obj = { name: 'world' };

greet.call(obj, 'Hello', '!');    // 'Hello, world!'
greet.apply(obj, ['Hi', '.']);    // 'Hi, world.'
const bound = greet.bind(obj, 'Hey');  // 预置 greeting
bound('?');                       // 'Hey, world?'
```

---

**▶ 追问 2：请手写实现 `call`、`apply`、`bind`。**

**💡 一句话速记**

call/apply 核心是「借用对象方法」：把函数临时挂到 context 上作为属性→以 context 调用→删除属性。bind 核心是「闭包 + apply」：返回新函数，内部用 apply 指定 this，并支持预置参数和 new 调用。

**📖 通俗详解**

**call/apply 实现**：
- `this` 指向调用 myCall 的那个函数（如 `fn.myCall(obj)`，this 就是 fn）。
- 把 this 挂到 context 的一个属性上，再 `context[key](...args)` 调用——这样 this 就变成 context 了。
- 用 Symbol 做 key 避免覆盖 context 已有属性。

**bind 实现**：
- 返回一个新函数 F。
- F 内部用 `fn.apply(...)` 指定 this 为绑定的 context，合并预置参数和新传入参数。
- 若 F 被 new 调用（`this instanceof F`），this 指向实例而非 context——还原 new 的优先级。

**🔧 示例 / 代码**

```javascript
// 手写 call
Function.prototype.myCall = function (context = globalThis, ...args) {
  const key = Symbol('fn');
  context[key] = this;       // 把函数挂到 context 上
  const result = context[key](...args);  // 以 context 调用 → this 指向 context
  delete context[key];      // 用完即删
  return result;
};

// apply 仅传参不同
Function.prototype.myApply = function (context = globalThis, args = []) {
  const key = Symbol('fn');
  context[key] = this;
  const result = context[key](...args);
  delete context[key];
  return result;
};

// bind：返回新函数，支持偏函数 + 可作为构造函数
Function.prototype.myBind = function (context = globalThis, ...args) {
  const fn = this;
  return function F(...args2) {
    // 若 new 调用，this 指向实例，不再用绑定的 context
    return fn.apply(this instanceof F ? this : context, [...args, ...args2]);
  };
};
```

**🔍 常见追问**

- 为什么手写 call 要用 Symbol？直接用普通字符串 key 会有什么问题？
- bind 手写里 `this instanceof F` 的判断，能用别的方式替代吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块 + 模型知识扩充，建议结合 MDN「this」「Function.prototype.call」核验。出处指向大纲：doc/前端知识体系.md:3

---

### 63. 什么是防抖（debounce）？它解决什么问题？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-004`
> 标签：#防抖, #debounce, #高频, #手写, #性能

**💡 一句话速记**

防抖：事件频繁触发时，只在「最后一次触发后等一段时间」才执行——连续触发期间一直不执行。核心是「每次触发都清掉上一次的定时器，重新计时」。

**📖 通俗详解**

**解决什么问题**：高频事件（input、resize、按钮连点）每秒触发几十上百次，直接执行会导致频繁请求/DOM 操作，卡顿。

**防抖策略**：**只关心最后一次**。每次触发都清掉上一次的定时器、重新计时；只有当事件「安静」一段时间（超过 delay）没有再触发，才真正执行。

**通俗类比**：电梯等人——有人按按钮就重新等待，直到一段时间没人再按才关门出发。所以防抖适合「用户停下来我再干活」的场景。

**典型场景**：搜索框输入联想（用户打字停了再请求）、窗口 resize（拖动停止后再重算布局）、表单字段校验、提交按钮防重复点击。

**🔍 常见追问**

- 防抖要不要支持「立即执行」版本？怎么实现？（提示：加 immediate 参数，首次触发立即执行，之后进入冷却）
- 节流（throttle）和防抖的区别是什么？（提示：节流是匀速执行，见 fe-js-007）

---

**▶ 追问 1：请手写实现一个 debounce 函数。**

**💡 一句话速记**

用闭包保留一个 timer：每次触发都 clearTimeout 掉上一次的定时器并重新 setTimeout，等 delay 后才真正执行 fn（用 apply 保留 this 和参数）。

**📖 通俗详解**

**实现要点**：
- ①用闭包保留 timer（返回的函数每次访问的是同一个 timer 变量）
- ②每次 clearTimeout 重置，保证只执行最后一次
- ③`fn.apply(this, args)` 保留原函数的 this 和参数
- ④可扩展「立即执行版」（immediate 参数：首次触发立即跑，之后进入冷却）

**注意**：debounce 返回的是一个新函数，原 fn 不会立即执行。

**🔧 示例 / 代码**

```javascript
// 防抖：n 秒后再执行，若 n 秒内再次触发则重新计时
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);             // 每次都清掉上一次
    timer = setTimeout(() => {
      fn.apply(this, args);          // 用 apply 保留 this 和参数
    }, delay);
  };
}

// 场景：搜索框，用户停止输入 300ms 后才请求
input.addEventListener('input', debounce(searchApi, 300));
```

**🔍 常见追问**

- 防抖函数如何支持「取消」？（提示：返回的对象上加 .cancel() 清掉 timer）
- React 里用防抖，函数放进 useEffect 依赖数组要注意什么？（提示：每次重渲染重新 debounce 会让防抖失效，需用 useRef/useMemo 固化同一个实例）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块（含「防抖的实现」高亮项）+ 模型知识。建议结合 Lodash 源码 debounce 或 MDN 核验。出处：doc/前端知识体系.md:46

---

### 64. 请手写一个节流函数（throttle）。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-js-007`
> 标签：#节流, #throttle, #高频, #手写, #性能

**💡 一句话速记**

节流：固定时间间隔只执行一次，期间无视后续触发——匀速执行。和防抖（只执行最后一次）相反，节流保证「按固定节奏」执行。

**📖 通俗详解**

**节流策略**：**保证固定节奏**。第一次触发立即执行，之后进入冷却期；冷却期内无视所有后续触发，冷却结束才允许下一次执行。

**通俗类比**：水龙头滴水——不管你拧多急，每隔固定时间只滴一滴。所以节流适合「持续触发但想匀速处理」的场景。

**与防抖的关键区别**：
- 防抖：连续触发期间**完全不执行**，只等最后一次 → 适合「停下来再干」（搜索联想）。
- 节流：连续触发期间**按固定间隔执行** → 适合「持续触发但要限速」（滚动加载）。

**典型场景**：滚动加载更多（匀速触发加载）、鼠标拖拽（匀速更新位置）、视频播放进度上报、resize 但需要中途也响应。

**🔧 示例 / 代码**

```javascript
// 节流（时间戳版）：n 秒内只执行一次
function throttle(fn, delay) {
  let last = 0;                     // 上次执行时间戳
  return function (...args) {
    const now = Date.now();
    if (now - last >= delay) {       // 距上次执行超过间隔才执行
      last = now;
      fn.apply(this, args);
    }
  };
}

// 场景：滚动时每 200ms 最多触发一次加载
window.addEventListener('scroll', throttle(loadMore, 200));
```

**两种实现版的差异**：
- **时间戳版**（上）：首次立即执行，但停止触发后**最后一次不执行**。
- **定时器版**：首次不立即执行，但停止触发后**会执行最后一次**。
- 实战常用「时间戳 + 定时器」结合版，兼得两者优点。

**🔍 常见追问**

- 节流的时间戳版和定时器版各有什么短板？（提示：时间戳版漏末次，定时器版首次延迟）
- 怎么写一个「首尾都执行」的节流？（提示：时间戳判断 + 定时器兜底末次）
- 防抖和节流怎么选？（提示：看是否需要「过程中也响应」——要则节流，不要则防抖）
- requestAnimationFrame 和节流什么关系？（提示：rAF 相当于 ~16ms 的节流，且跟随刷新率）

---

**▶ 追问 1：节流（throttle）和防抖（debounce）有什么区别？**

**💡 一句话速记**

防抖是「等停下来才执行」（最后一次触发后延时执行）；节流是「固定频率执行」（不管触发多频繁，固定时间间隔执行一次）。

**📖 通俗详解**

**防抖 debounce**：事件频繁触发时，只在最后一次触发后等一段时间才执行。场景：搜索框输入联想（用户停手才请求）。

**节流 throttle**：事件频繁触发时，固定时间间隔执行一次。场景：滚动监听、拖拽、resize（持续触发但不能太频繁）。

**核心区别**：防抖只执行最后一次，节流均匀执行。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块（含「节流的实现」高亮项）+ 模型知识。建议结合 Lodash 源码 throttle 或 MDN 核验。出处：doc/前端知识体系.md:47

---

### 65. `Promise.all`、`Promise.race`、`Promise.allSettled`、`Promise.any` 这四个组合方法各自的行为和适用场景是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-006`
> 标签：#promise, #all, #race, #allSettled, #any, #高频

**💡 一句话速记**

按「等不等全部完成 / 取成功还是失败」分：all 要全部成功，any 要一个成功，race 取最快不管成败，allSettled 等全部完成不管成败。

**📖 通俗详解**

**四个方法的本质差异**（一张表记住）：

| 方法 | 成功条件 | 失败行为 | 适用场景 |
|---|---|---|---|
| `Promise.all` | **全部**成功 | 任一失败→整体失败（短路） | 多个请求都要成功才继续 |
| `Promise.any` | **任一**成功 | 全失败→整体失败 | 取最快的一个成功响应 |
| `Promise.race` | 第一个完成（**不论成败**） | 第一个若是失败→失败 | 超时控制、取最快响应 |
| `Promise.allSettled` | **全部完成**（不论成败） | 永不 reject，返回状态数组 | 批量执行后统一汇总结果 |

**两组易混淆点**：
- `all` vs `any`：all 是「与」（全真才真），any 是「或」（一真即真）。
- `race` vs `any`：race **不在乎成败**只看快慢；any **只认成功**，第一个若是失败会继续等。
- `allSettled` 最特殊：**永不 reject**，返回 `[{status:'fulfilled', value}, {status:'rejected', reason}]`，适合「不管成败都要汇总」。

**🔧 示例 / 代码**

```javascript
// Promise.all：并行请求，全成功才行
const [user, posts] = await Promise.all([getUser(), getPosts()]);

// Promise.race：超时控制（5s 不返回就判超时）
await Promise.race([
  fetch('/api'),
  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
]);

// Promise.any：多源容灾，谁先成功用谁
const data = await Promise.any([primary(), backup1(), backup2()]);

// Promise.allSettled：批量执行不中断，最后汇总成败
const results = await Promise.allSettled(urls.map(u => fetch(u)));
const ok = results.filter(r => r.status === 'fulfilled');
const fail = results.filter(r => r.status === 'rejected');
```

**🔍 常见追问**

- 如何手写 Promise.all？遇到非 Promise 值怎么处理？（提示：用 Promise.resolve 包一层，按索引保证返回顺序）
- 如何手写 Promise.race？（提示：谁先 settle 谁就 resolve/reject 外层 Promise）
- Promise.all 中一个失败后，其他还在 pending 的 Promise 会取消吗？（提示：不会，Promise 无法取消，只是结果被丢弃）
- 为什么没有 `Promise.none` 或 `Promise.first`？实际怎么模拟？（提示：用 allSettled + filter）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块（含「promise.all promise.race实现」高亮项）+ 模型知识，扩展至 allSettled/any 形成完整知识组。建议结合 MDN「Promise」核验。出处：doc/前端知识体系.md:31

---

### 66. 什么是 JavaScript 的作用域和作用域链？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-008`
> 标签：#作用域, #作用域链, #执行上下文, #变量对象, #AO, #VO, #词法作用域

**💡 一句话速记**

作用域是变量/函数的可访问范围（JS 用词法作用域，由代码书写位置决定）；作用域链是当前作用域→外层作用域→...→全局的层层查找路径；变量查找时从内层作用域开始，沿作用域链向外逐层找，找到即停，找不到报 ReferenceError；本质由执行上下文的变量对象（VO/AO）链构成。

**📖 通俗详解**

**作用域（Scope）**：变量和函数的可访问范围。JS 是**词法作用域（静态作用域）**——作用域由代码书写位置决定，而非调用位置。

**作用域类型**：
- 全局作用域：最外层，到处可访问。
- 函数作用域：函数内声明，外部访问不到。
- 块级作用域（ES6 let/const）：{}内有效。

**作用域链（Scope Chain）**：
当前作用域 → 外层作用域 → ... → 全局作用域，形成的层层查找路径。

**变量查找机制**：
访问变量时，从最内层作用域开始，沿作用域链逐层向外查找：
1. 先在当前作用域的变量对象里找。
2. 找不到 → 去外层作用域找。
3. 一直找到全局，找到就用，找不到报 ReferenceError。

**底层原理（执行上下文）**：
JS 代码执行分两阶段：
1. **分析阶段（创建执行上下文）**：
   - 先创建执行上下文再运行。
   - 分析时作用域已确定（词法作用域）。
   - 函数创建时会保存 scope（外层作用域引用）。
2. **执行阶段**：
   - 变量对象（VO）：全局上下文里存变量/函数声明。
   - 活动对象（AO）：函数上下文里，VO 就是 AO（多了 arguments）。
   - **函数激活时，会把自己的 AO 添加到 scope 链的最前面**——所以函数内优先访问自己的局部变量。

**作用域链的本质**：
就是执行上下文中变量对象（VO/AO）的链表。函数调用时，AO 压入链头，形成「当前AO → 外层AO → ... → 全局VO」的查找路径。

**🔧 示例 / 代码**

```javascript
var globalVar = 'global';
function outer() {
  var outerVar = 'outer';
  function inner() {
    var innerVar = 'inner';
    console.log(innerVar);   // 当前AO找到 inner
    console.log(outerVar);   // 当前AO没有→外层outer的AO找到
    console.log(globalVar);  // 一路找到全局VO
  }
  inner();
}
outer();
```

**查找过程**：
```
inner的AO(innerVar) → outer的AO(outerVar) → 全局VO(globalVar)
找不到 → ReferenceError
```

**词法作用域 vs 动态作用域**：
```javascript
var x = 1;
function a() { console.log(x); }  // 这里的x指向全局(书写位置)
function b() { var x = 2; a(); }    // 即使在b里调a，a里的x仍是全局1
b();  // 输出1，不是2(词法作用域看定义不看调用)
```

**🔍 常见追问**

- 词法作用域和动态作用域的区别？this 是哪种？
- let/const 的块级作用域和 var 的函数作用域有什么本质区别？
- 作用域链和原型链有什么区别？（一个查变量，一个查属性）
- 闭包是怎么利用作用域链的？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「作用域和作用域链」红色高频考点），请结合权威资料核验

---

### 67. ES6 的 `class` 和传统构造函数+原型有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-010`
> 标签：#class, #ES6, #构造函数, #原型链, #语法糖, #继承, #extends, #super

**💡 一句话速记**

class 本质是构造函数+原型的语法糖，但更严谨：调用必须用 new、方法默认不可枚举、有 static/extends/super 等清晰语法，让面向对象代码更易读易写，但底层原型机制没变。

**📖 通俗详解**

**class vs 传统模式的核心区别**：

| 特性 | 传统构造函数 | ES6 class |
|---|---|---|
| 调用方式 | 可不用 new（结果异常） | **必须 new**，否则报错 |
| 方法定义 | `Person.prototype.say` | `say() {}` 写在 class 内 |
| 可枚举性 | 方法可枚举 | **方法默认不可枚举** |
| 继承 | 原型链/借用构造函数/组合 | `extends` + `super` |
| 静态方法 | `Person.static` | `static method()` |
| 语法 | 松散 | 集中、清晰 |

**class 的关键约束**：
1. **必须 new 调用**：`Person()` 不带 new 会报错（传统构造函数会污染全局）。
2. **子类 constructor 必须先调 super()**：才能用 this。
3. **方法默认不可枚举**：`for...in` 遍历不到（传统原型方法可枚举）。

**底层机制没变**：class 只是语法糖，JS 依然是基于原型的语言，没有引入新的继承机制。理解原型链（见 fe-js-003）是理解 class 的前提。

**🔧 示例 / 代码**

**继承示例对比**：
```javascript
// 传统组合继承(冗长)
function Animal(name) { this.name = name; }
Animal.prototype.eat = function() {};
function Dog(name) { Animal.call(this, name); }  // 借构造
Dog.prototype = Object.create(Animal.prototype); // 原型链
Dog.prototype.constructor = Dog;
Dog.prototype.bark = function() {};

// ES6 class(简洁)
class Animal {
  constructor(name) { this.name = name; }
  eat() {}
}
class Dog extends Animal {
  constructor(name) { super(name); }
  bark() {}
}
```

**🔍 常见追问**

- class 的 `super()` 为什么必须在 constructor 第一行？
- class 的静态方法和实例方法在原型链上分别在哪？
- class 能实现多继承吗？mix-in 怎么做？
- 私有属性 `#field` 和传统闭包私有化比，有什么优势？

---

**▶ 追问 1：`class` 编译成 ES5 是什么样子的？**

**💡 一句话速记**

class 编译成 ES5 后就是「构造函数 + 原型方法 + Object.create 实现继承」的组合，方法用 Object.defineProperty 设为不可枚举，继承靠原型链 + 借用构造函数。

**📖 通俗详解**

**class 编译成 ES5 的样子**：

```javascript
// ES6 class
class Person {
  constructor(name) { this.name = name; }
  say() { console.log(this.name); }
  static create(name) { return new Person(name); }
}

// 编译成 ES5
function Person(name) {           // constructor → 构造函数
  this.name = name;
}
Person.prototype.say = function() { // 方法 → 原型方法
  console.log(this.name);
};
Object.defineProperty(Person.prototype, 'say', {
  enumerable: false  // class 方法不可枚举
});
Person.create = function(name) {   // static → 构造函数方法
  return new Person(name);
};
```

**继承的编译（extends + super）**：
```javascript
// ES6
class Student extends Person {
  constructor(name, grade) {
    super(name);      // 必须先调 super
    this.grade = grade;
  }
}

// 编译成 ES5
function Student(name, grade) {
  Person.call(this, name);  // 借用构造函数
  this.grade = grade;
}
Student.prototype = Object.create(Person.prototype); // 原型链继承
Student.prototype.constructor = Student;  // 修正 constructor
```

**🔧 示例 / 代码**

```javascript
// 编译后用 Object.defineProperty 保证方法不可枚举
Object.defineProperty(Person.prototype, 'say', { enumerable: false });
// 继承用 Object.create 链接原型
Student.prototype = Object.create(Person.prototype);
```

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「class和传统模式的区别」「class编译成es5」红色高频考点），请结合权威资料核验

---

### 68. 箭头函数和普通函数有哪些区别？为什么箭头函数不能用作构造函数或方法？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-012`
> 标签：#箭头函数, #this, #arguments, #构造函数, #没有prototype, #不能new

**💡 一句话速记**

箭头函数四大区别：①没有自己的 this（继承外层词法 this）②没有 arguments（用剩余参数...args）③不能作构造函数（无 prototype、不能 new）④不能作 Generator（无 yield）；核心是箭头函数设计目标就是「轻量回调」，所以砍掉了 this 绑定等特性，适合纯函数/回调，不适合方法/构造函数。

**📖 通俗详解**

**箭头函数 vs 普通函数的四大区别**：

**1. 没有自己的 this（最关键）**
- 普通函数：this 由调用方式决定（谁调用指向谁，参见 fe-js-001）。
- 箭头函数：**继承外层词法作用域的 this**（定义时确定，不可变）。
```javascript
const obj = {
  name: 'Alice',
  normalFn() {
    setTimeout(function() { console.log(this.name); }, 100); // undefined(this指向window)
  },
  arrowFn() {
    setTimeout(() => { console.log(this.name); }, 100); // 'Alice'(继承外层)
  }
};
```

**2. 没有 arguments**
- 普通函数：有 arguments（类数组，存所有参数）。
- 箭头函数：没有 arguments，用剩余参数 `(...args) =>` 替代。

**3. 不能作构造函数（不能 new）**
- 箭头函数没有 `prototype` 属性。
- `new` 会报错：`TypeError: X is not a constructor`。

**4. 不能作 Generator**
- 箭头函数体内不能用 `yield`。

**其他区别**：
- 没有 `new.target`。
- 没有 `super`（虽然能在对象方法里用，但绑定外层）。
- 不能用 `call`/`apply`/`bind` 改变 this（this 是词法绑定的）。

**为什么这样设计**：
箭头函数的设计目标是**轻量级回调**——解决回调里 this 指向丢失的问题（传统做法是 `var self = this` 或 `.bind(this)`）。所以它：
- 砍掉自己的 this，继承外层——回调里能直接用外层 this。
- 砍掉 prototype、arguments 等——更纯粹，适合纯函数。

**使用场景判断**：

| 场景 | 推荐 | 理由 |
|---|---|---|
| 回调（map/filter/setTimeout） | 箭头 | 继承外层 this |
| 纯函数 | 箭头 | 简洁 |
| 对象方法 | 普通函数 | 需要自己的 this |
| 构造函数/类方法 | 普通函数 | 需 new/prototype |
| 事件监听 | 看需求 | 需 this 指向元素用普通函数 |

**🔧 示例 / 代码**

**回调里 this 问题**：
```javascript
class Counter {
  count = 0;
  // 普通函数回调(this丢失)
  startBad() {
    setInterval(function() {
      this.count++;  // this指向window,报错或无效
    }, 1000);
  }
  // 箭头函数回调(继承this)
  startGood() {
    setInterval(() => {
      this.count++;  // 继承startGood的this(指向实例)
    }, 1000);
  }
}
```

**箭头函数不能 new**：
```javascript
const Foo = () => {};
new Foo(); // TypeError: Foo is not a constructor
Foo.prototype; // undefined
```

**🔍 常见追问**

- 箭头函数的 this 能用 call/apply/bind 改变吗？为什么？
- 对象方法用箭头函数有什么坑？（this 不指向实例）
- React 类组件为什么用箭头函数做事件处理？函数组件呢？
- 箭头函数和普通函数在性能上有差异吗？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「箭头函数和普通函数的区别」高频考点），请结合权威资料核验

---

### 69. JavaScript 的深拷贝和浅拷贝有什么区别？

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-js-013`
> 标签：#深拷贝, #浅拷贝, #JSON.parse, #structuredClone, #递归, #循环引用, #手写

**💡 一句话速记**

浅拷贝只复制一层、嵌套对象仍共享引用；深拷贝递归复制所有层级、新旧完全独立，常用 JSON 序列化、structuredClone 或手写递归三种方案。

**📖 通俗详解**

**浅拷贝 vs 深拷贝**：
- 浅拷贝：只复制一层，嵌套对象仍共享引用。`Object.assign({}, obj)`、扩展运算符 `{...obj}` 都是浅拷贝。
- 深拷贝：递归复制所有层级，新旧对象完全独立。
```javascript
const a = { info: { name: 'Alice' } };
const shallow = { ...a };       // 浅拷贝
shallow.info.name = 'Bob';
console.log(a.info.name);       // 'Bob' (互相影响!)

const deep = structuredClone(a); // 深拷贝
deep.info.name = 'Carol';
console.log(a.info.name);        // 'Bob' (独立)
```

**各种深拷贝方案对比**：
| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| `JSON.parse(JSON.stringify())` | 写法最简单、原生支持 | 丢函数/symbol/undefined；Date 变字符串；RegExp/Map/Set 丢失；循环引用直接报错 | 纯数据、无特殊类型 |
| 手写递归 | 最灵活、可控、可定制 | 代码量大、需自己处理循环引用与特殊对象边界 | 面试/特殊类型（含函数克隆） |
| `structuredClone()` | 原生 API、性能好；支持循环引用/Date/RegExp/Map/Set/ArrayBuffer | 不能克隆函数、DOM 节点；老环境需 polyfill | 现代 Node17+/浏览器纯数据深拷贝 |
| lodash `_.cloneDeep` | 历史最全、边界覆盖最完善 | 体积大、有依赖 | 生产项目兜底方案 |

**手写深拷贝核心**：递归 + `WeakMap` 解决循环引用 + 判断数组/日期/正则等特殊类型。

**🔍 常见追问**

- structuredClone 为什么不能克隆函数？设计原因？
- WeakMap 和 Map 的区别？为什么深拷贝用 WeakMap？
- 如何拷贝一个包含 Symbol 键的对象？
- Immutable.js 的持久化数据结构和深拷贝有什么不同？

---

**▶ 追问 1：请手写一个深拷贝函数。**

**💡 一句话速记**

递归克隆：处理基本类型直接返回，对象/数组递归，注意循环引用（用WeakMap记录已拷贝的）和处理特殊对象（Date/RegExp/Map/Set）。

**📖 通俗详解**

核心是递归 + 处理循环引用。手写时要考虑：①基本类型直接返回 ②Date/RegExp等用构造函数重建 ③普通对象/数组递归 ④循环引用用WeakMap缓存避免栈溢出。

**🔧 示例 / 代码**

**循环引用处理**：
```javascript
const a = { name: 'Alice' };
a.self = a;  // 循环引用

// JSON方案: 直接报错
JSON.parse(JSON.stringify(a)); // TypeError: Converting circular structure

// 手写方案: WeakMap 解决
const cloned = deepClone(a);  // 正常，cloned.self === cloned
```

**实际项目选型**：
- 简单数据（纯值/数组）：`JSON.parse(JSON.stringify())` 或扩展运算符。
- 复杂数据（含日期/循环）：`structuredClone()`（现代浏览器/Node17+）。
- 极端情况（含函数/特殊类型）：lodash `_.cloneDeep`。

---

**▶ 追问 2：各种深拷贝方案有什么优劣？**

**💡 一句话速记**

JSON.parse(JSON.stringify)：简单但丢失函数/undefined/Date；递归手写：可控但要处理边界；structuredClone：原生API，支持大部分类型但不能拷贝函数。

**📖 通俗详解**

三种主流方案对比：JSON序列化最简单但有诸多限制（丢函数、循环引用报错、Date变字符串）；手写递归最灵活但代码量大；structuredClone是现代浏览器原生API，推荐用于纯数据深拷贝。

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「深浅拷贝」高频考点），请结合权威资料核验

---

### 70. 手写 `new` 操作符的实现。`new` 做了哪些事？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-js-002`
> 标签：#new, #原型链, #高频, #手写

**💡 一句话速记**

`new` 做四件事：①创建空对象 ②链接原型（指向构造函数的 prototype）③绑定 this 执行构造函数 ④若构造函数返回对象则用它，否则返回新对象。

**📖 通俗详解**

**`new Foo(...)` 的四步**：
1. **创建对象**：`const obj = {}`，一块新的内存。
2. **绑定原型**：`obj.__proto__ = Foo.prototype`，让新对象能访问原型链上的方法。这是「实例能共享构造函数原型方法」的关键。
3. **改变 this 执行**：`const result = Foo.apply(obj, args)`，构造函数里的 `this` 指向新对象，给新对象添加属性。
4. **处理返回值**：如果构造函数显式 `return` 了一个**对象**（或函数），则用那个返回值；否则返回新创建的 obj。

**为什么第 4 步要判断返回值类型**？因为构造函数默认不写 return 就返回 this（新对象），但若有人手贱写了 `return { x: 1 }`，new 出来的就是这个手写的对象，而不是 this 了。这是 JS 的坑点。

**🔧 示例 / 代码**

```javascript
function myNew(Constructor, ...args) {
  // 1. 创建新对象
  const obj = {};
  // 2. 链接原型（等价于 obj.__proto__ = Constructor.prototype）
  Object.setPrototypeOf(obj, Constructor.prototype);
  // 3. 绑定 this 执行构造函数
  const result = Constructor.apply(obj, args);
  // 4. 构造函数返回对象则用它，否则返回 obj
  return result instanceof Object ? result : obj;
}

// 验证
function Person(name) { this.name = name; }
Person.prototype.sayHi = function () { return `hi, ${this.name}`; };
const p = myNew(Person, 'Lee');
console.log(p.name);     // 'Lee'
console.log(p.sayHi());  // 'hi, Lee' —— 原型方法可用
```

**🔍 常见追问**

- 如果构造函数 return 一个基本类型（如 return 1），new 的结果会变吗？（提示：不变，仍返回 obj）
- `Object.create(Constructor.prototype)` 和 `obj.__proto__ = ...` 有什么区别？（提示：前者更安全，不依赖已废弃的 __proto__）
- class 的 new 和构造函数的 new 底层一样吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块（含「new的实现：创建对象/绑定原型/改变this/返回」）+ 模型知识。建议结合 MDN「new operator」核验。出处：doc/前端知识体系.md:5

---

### 71. 请讲清楚 JavaScript 的原型和原型链。

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-003`
> 标签：#原型链, #高频

**💡 一句话速记**

原型（prototype）是函数的一个属性，指向一个原型对象；实例通过 `__proto__` 指向构造函数的 prototype，从而能访问原型上的方法。原型链是访问属性时沿 `__proto__` 一路向上查找的路径，直到找到或到顶（null）。

**📖 通俗详解**

**原型（Prototype）**：每个函数都有一个 `prototype` 属性，指向它的原型对象。通过 `new Fn()` 创建的实例，有一个 `__proto__`（即 `[[Prototype]]`）指向 `Fn.prototype`，所以实例能访问原型上的方法和属性（方法复用）。

**原型链（Prototype Chain）**：访问实例的属性/方法时，JS 先在实例自身找；找不到，沿 `__proto__` 到原型找；还找不到，继续沿原型的 `__proto__` 向上，直到找到或到顶。这条查找路径就是原型链。

**为什么这么设计**？原型链让所有对象共享 Object.prototype 的方法（如 toString、hasOwnProperty），实现了「方法复用」和「继承」。

**🔧 示例 / 代码**

```javascript
function Animal(name) { this.name = name; }
Animal.prototype.eat = function () { return 'eating'; };

const a = new Animal('cat');
a.eat();                    // 'eating'，沿原型链在 Animal.prototype 找到
a.toString();              // 来自 Object.prototype（原型链再上一层）
a.__proto__ === Animal.prototype;           // true
Animal.prototype.__proto__ === Object.prototype;  // true
Object.prototype.__proto__ === null;       // true，原型链尽头
Animal.prototype.constructor === Animal;   // true，三角关系
```

**🔍 常见追问**

- 箭头函数有 prototype 吗？（提示：没有，不能作为构造函数）
- ES6 class 的 extends 底层是怎么实现原型链继承的？
- `instanceof` 的原理是什么？它和原型链什么关系？（提示：沿 __proto__ 查找右侧的 prototype）
- 为什么 `Object.create(null)` 创建的对象「最干净」？（提示：没有原型链上的方法）

---

**▶ 追问 1：`prototype`、`__proto__`、`constructor` 三者是什么关系？**

**💡 一句话速记**

实例通过 `__proto__` 找原型，原型通过 `constructor` 找回构造函数，构造函数通过 `prototype` 指向原型——三者构成三角。

**📖 通俗详解**

**核心三角关系**：
- 每个函数都有一个 `prototype` 属性，指向它的**原型对象**。
- 原型对象默认有一个 `constructor` 属性，指回函数本身。
- 通过 `new Fn()` 创建的实例，有一个 `__proto__`（即 `[[Prototype]]`）指向 `Fn.prototype`。
```
Fn.prototype ←→ constructor → Fn
      ↑
    __proto__
      ↑
   实例 instance
```

---

**▶ 追问 2：原型链的尽头是什么？**

**💡 一句话速记**

原型链的尽头是 `null`：`Fn.prototype` 的 `__proto__` 指向 `Object.prototype`，而 `Object.prototype.__proto__` 指向 null。

**📖 通俗详解**

**链的尽头**：`Fn.prototype` 本身也是对象，它的 `__proto__` 指向 `Object.prototype`；`Object.prototype.__proto__` 指向 **`null`**。所以原型链的终点是 null。
```
instance → Fn.prototype → Object.prototype → null
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》JS 原理板块（含「函数存在 prototype 指向实例原型/实例 __proto__ 指向原型/原型也是对象」）+ 模型知识。建议结合 MDN「继承与原型链」核验。出处：doc/前端知识体系.md:21

---

### 72. Promise 的 `.then(onFulfilled, onRejected)` 和 `.catch()` 有什么区别？为什么推荐用 `.catch`？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-005`
> 标签：#promise, #async, #高频

**💡 一句话速记**

`.catch()` 等价于 `.then(null, onRejected)`，但它能捕获**整条链**上前面抛的错误（reject + 同步异常）；而 `.then` 的第二参数 onRejected 只能捕获前一个 Promise 的 reject，抓不到 onFulfilled 里抛的错。所以 `.catch` 更全面，推荐用 `.catch`。

**📖 通俗详解**

**`.catch` 比 `.then` 第二参数更强的关键点**：
- `.then(onFulfilled, onRejected)` 的 onRejected **只捕获前一个 Promise 的 reject**，捕获不到**同个 then 里 onFulfilled 抛出的同步错误**。
- `.catch()` 能捕获**它之前整条链**上的所有错误（reject + 抛出的异常），因为 `.catch()` 本质是 `.then(null, onRejected)`，挂在了链的后端。

**所以推荐用 `.catch` 而非 `.then(_, onRejected)`**——后者会留下错误处理的「盲区」。这也是「错误冒泡」的体现：未被捕获的 rejection 会沿链向下传递，直到遇到 `.catch`。

**补充概念**：`reject` 是 `new Promise((resolve, reject) => ...)` 里**让 Promise 变为失败状态**的动作（制造错误），和 `.catch`（捕获错误）不在同一环节，不能直接比较「区别」。

**🔧 示例 / 代码**

```javascript
// ❌ onRejected 抓不到 onFulfilled 抛的错
Promise.resolve()
  .then(() => { throw new Error('oops'); })   // 这里抛错
  .then(
    () => console.log('不会到这'),
    e => console.log('onRejected 抓不到上一行的抛错')  // ❌ 盲区
  );

// ✅ 用 .catch 能捕获整条链
Promise.resolve()
  .then(() => { throw new Error('oops'); })
  .catch(e => console.log('catch 抓到了:', e.message)); // ✅
```

**错误冒泡**：链中任何未处理的 rejection 都会一路向下找最近的 `.catch`。

**🔍 常见追问**

- Promise 的状态一旦改变还能再变吗？（提示：不可逆，pending→fulfilled/rejected 是终态）
- async/await 里怎么捕获 reject？（提示：用 try/catch 包住 await，更同步化）
- 如果一个 Promise 链没有任何 `.catch`，未捕获的 rejection 会怎样？（提示：触发 unhandledrejection 事件，Node 会警告/退出）
- `.catch` 之后还能继续 `.then` 吗？catch 之后的链是什么状态？（提示：能，catch 返回 fulfilled 的 Promise）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。源大纲原文为「promise.catch和reject的区别」，表述有误（reject 是制造失败的动作，.catch 是捕获失败的方法，不构成区别关系，见 ADR-008）；实际考点是 .then 第二参数与 .catch 的区别。依据模型知识修正题干。建议结合 MDN「Promise.prototype.catch」或《你不知道的JavaScript》核验。出处：doc/前端知识体系.md:31

---

### 73. 什么是「闭包（Closure）」？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-009`
> 标签：#闭包, #closure, #作用域链, #内存, #数据私有化, #模块化, #IIFE

**💡 一句话速记**

闭包是函数与其词法环境（外层作用域）的组合——内部函数引用了外部函数的变量，就形成了闭包；本质是作用域链的延伸。

**📖 通俗详解**

**闭包的定义**：函数与其词法环境（外层作用域）的组合。当一个内部函数引用了外部函数的变量，就形成了闭包。

**经典示例**：
```javascript
function createCounter() {
  let count = 0;  // 外层变量
  return function() {  // 内部函数(闭包)
    count++;  // 引用了外层count
    return count;
  };
}
const counter = createCounter();
counter(); // 1
counter(); // 2 —— createCounter已执行完，但count被闭包「记住」
```

**🔧 示例 / 代码**

**闭包模拟私有变量（封装）**：
```javascript
function createUser(name) {
  let _name = name;  // "私有"
  return {
    getName: () => _name,
    setName: (n) => { _name = n; }
  };
}
const u = createUser('Alice');
u.getName();      // 'Alice'
u._name;          // undefined (外部访问不到)
u.setName('Bob');
u.getName();      // 'Bob'
```

**🔍 常见追问**

- 箭头函数的闭包和普通函数有什么不同？（this 绑定）

---

**▶ 追问 1：闭包为什么能「记住」外层作用域的变量？**

**💡 一句话速记**

因为 JS 是词法作用域，函数定义时就保存了对所在作用域的引用；当内部函数被返回并被外部引用时，它持有的对外层变量的引用让这些变量不被 GC 回收——本质是作用域链的延伸。

**📖 通俗详解**

**为什么能「记住」外层变量**：
- JS 是词法作用域，函数在定义时就保存了对所在作用域的引用。
- 正常情况下，函数执行完，其局部变量会被回收。
- 但如果内部函数被返回到外部并被引用，它持有的对外层变量的引用会让这些变量**不被回收**——仿佛被「记住」了。
- 本质：**作用域链的延伸**，内部函数的作用域链包含了外层函数的活动对象。

**注意事项（闭包的代价）**：
- **内存占用**：闭包引用的变量不会被回收，常驻内存。
- **内存泄漏风险**：不必要的闭包引用（如 DOM 事件监听未解绑）会导致内存泄漏。
- 使用后及时解除引用（置 null、removeEventListener）。

**🔍 常见追问**

- 闭包导致的内存泄漏怎么排查和解决？

---

**▶ 追问 2：闭包有哪些典型应用场景？请举例。**

**💡 一句话速记**

典型应用：数据私有化（封装）、模块化（IIFE）、回调/防抖节流中保存状态、迭代器/生成器。

**📖 通俗详解**

**典型应用场景**：

1. **数据私有化（封装）**：用闭包模拟私有变量——外部无法直接访问，只能通过返回的方法操作。

2. **模块化（IIFE 立即执行函数）**：早期 JS 没有模块系统，靠 IIFE+闭包实现模块封装。
   ```javascript
   const module = (function() {
     let private = 'secret';
     return { get() { return private; } };
   })();
   ```

3. **回调中保存状态**：事件监听、setTimeout 回调里访问外层数据。

4. **防抖节流**：debounce/throttle 内部用闭包保存 timer 状态。

5. **迭代器/生成器**：保存遍历位置。

**🔧 示例 / 代码**

**闭包 vs 普通函数**：
| 特性 | 普通函数 | 闭包 |
|---|---|---|
| 外层变量 | 执行完回收 | 被引用不回收 |
| 状态保持 | 无 | 有 |
| 内存 | 即用即释 | 常驻 |

**🔍 常见追问**

- IIFE（立即执行函数）是怎么利用闭包做模块化的？
- 现代 ES Module 出现后，闭包做模块化还有意义吗？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（闭包是 this/作用域的延伸，面试超高频），请结合权威资料核验

---

### 74. JavaScript 的「迭代器（Iterator）」和「生成器（Generator）」是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-011`
> 标签：#迭代器, #Iterator, #生成器, #Generator, #Symbol.iterator, #yield, #可迭代对象

**💡 一句话速记**

迭代器是实现 next() 方法返回 {value, done} 的对象；生成器是 function* + yield 定义的函数，调用返回一个迭代器，能暂停执行。Generator 是创建迭代器的便捷方式，用于惰性求值、异步流程控制。

**📖 通俗详解**

**迭代器（Iterator）**：
一个实现了 `next()` 方法的对象，每次调用返回 `{value, done}`：
```javascript
const iter = {
  i: 0,
  next() {
    if (this.i < 3) return { value: this.i++, done: false };
    return { value: undefined, done: true };
  }
};
iter.next(); // {value:0, done:false}
iter.next(); // {value:1, done:false}
iter.next(); // {value:2, done:false}
iter.next(); // {value:undefined, done:true}
```

**生成器（Generator）**：
用 `function*` 定义，`yield` 暂停执行并返回值。调用生成器函数返回一个迭代器：
```javascript
function* gen() {
  yield 1;
  yield 2;
  yield 3;
}
const g = gen();  // 返回迭代器(非执行函数体)
g.next(); // {value:1, done:false}  遇yield暂停
g.next(); // {value:2, done:false}
g.next(); // {value:3, done:false}
g.next(); // {value:undefined, done:true}
```

**Generator 是创建迭代器的便捷方式**：
手写迭代器要维护状态、写 next()，繁琐。Generator 自动生成符合迭代器协议的对象：
```javascript
// 自定义可迭代对象(用Generator简化)
const range = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  }
};
[...range]; // [1,2,3]  扩展运算符可用
```

**应用场景**：
1. **惰性求值**：用多少生成多少，不一次性占用内存（如无限序列、大数据流）。
2. **自定义可迭代对象**：让自己的对象支持 for...of。
3. **异步流程控制**（Generator + Promise，async/await 的前身）。
4. **状态机**：yield 天然分段执行。

**🔧 示例 / 代码**

**对比：手写迭代器 vs Generator**：
```javascript
// 手写(繁琐)
function makeRangeIter(from, to) {
  let i = from;
  return {
    next() {
      return i <= to ? {value:i++, done:false} : {value:undefined, done:true};
    }
  };
}

// Generator(简洁)
function* makeRangeGen(from, to) {
  for (let i = from; i <= to; i++) yield i;
}
```

**🔍 常见追问**

- 为什么普通对象不能 for...of？怎么让它可迭代？
- Generator 怎么做异步流程控制？（co 库原理）
- async/await 和 Generator 是什么关系？
- yield* 是什么？委托生成器？

---

**▶ 追问 1：它们和 `for...of`、扩展运算符有什么关系？**

**💡 一句话速记**

可迭代对象（实现 Symbol.iterator 方法）才能被 for...of、扩展运算符(...)、解构等消费——它们都调用 `[Symbol.iterator]` 拿迭代器反复 next()。原生可迭代的有 Array、String、Map、Set、arguments、NodeList。

**📖 通俗详解**

**可迭代对象（Iterable）**：
实现了 `[Symbol.iterator]` 方法的对象，该方法返回一个迭代器。原生可迭代对象：Array、String、Map、Set、arguments、NodeList。

**for...of / 扩展运算符 / 解构的本质**：
它们都消费「可迭代对象」——调用 `[Symbol.iterator]` 拿迭代器，反复 `next()` 直到 done。
```javascript
for (const x of [1,2,3]) {}   // 数组可迭代
const [...rest] = [1,2,3];     // 解构
const copy = [...[1,2,3]];     // 扩展运算符
```
普通对象默认不可迭代（没有 Symbol.iterator），所以 `for...of obj` 会报错。

**🔧 示例 / 代码**

```javascript
// 让普通对象可迭代：实现 [Symbol.iterator]
const range = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    let i = this.from;
    return {
      next: () => i <= this.to ? {value: i++, done: false} : {value: undefined, done: true}
    };
  }
};
for (const x of range) console.log(x);  // 1,2,3
const arr = [...range];                 // [1,2,3]
```

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「迭代器」「生成器」红色高频考点），请结合权威资料核验

---

### 75. 什么是「函数柯里化（Currying）」和「偏函数（Partial Application）」？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-js-014`
> 标签：#函数柯里化, #curry, #偏函数, #partial, #高阶函数, #参数复用, #手写

**💡 一句话速记**

柯里化是把多参数函数转成一连串单参数函数（f(a,b,c) → f(a)(b)(c)），参数够了才执行；偏函数是预先固定部分参数返回新函数（f(a,b,c) → f(a)→新函数等b,c）；手写 curry 核心是递归收集参数，长度够了调原函数；应用：参数复用、延迟执行、函数组合；柯里化是偏函数的极端形式（每次只传一个参数）。

**📖 通俗详解**

**柯里化（Currying）**：
把接受多个参数的函数，变换成接受单一参数的函数链。每次传一个参数，返回新函数接收下一个，直到参数够了才执行。
```javascript
// 普通函数
function add(a, b, c) { return a + b + c; }
add(1, 2, 3); // 6

// 柯里化后
function curriedAdd(a) {
  return function(b) {
    return function(c) {
      return a + b + c;
    };
  };
}
curriedAdd(1)(2)(3); // 6
```

**手写通用 curry**：
```javascript
function curry(fn) {
  return function curried(...args) {
    // 参数够了，执行原函数
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    // 参数不够，返回新函数继续收集
    return function(...args2) {
      return curried.apply(this, [...args, ...args2]);
    };
  };
}

const sum = (a, b, c) => a + b + c;
const curriedSum = curry(sum);
curriedSum(1)(2)(3);    // 6
curriedSum(1, 2)(3);   // 6 (支持多参数)
curriedSum(1)(2, 3);   // 6
```

**偏函数（Partial Application）**：
预先固定部分参数，返回接受剩余参数的新函数。
```javascript
// 偏函数:固定a
function partial(fn, ...presetArgs) {
  return function(...laterArgs) {
    return fn(...presetArgs, ...laterArgs);
  };
}
const add = (a, b, c) => a + b + c;
const addTen = partial(add, 10);  // 固定第一个参数
addTen(2, 3);  // 15
```

**柯里化 vs 偏函数的区别**：
| 维度 | 柯里化 | 偏函数 |
|------|--------|--------|
| 形态 | f(a,b,c) → f(a)(b)(c) 一连串单参函数 | f(a,b,c) → f(a,b)(剩 c) 固定部分参数 |
| 接收参数 | 每次只接收一个参数 | 一次固定多个，剩余参数一次性传入 |
| 等待执行条件 | 收满 fn.length 个参数才执行 | 收到剩余参数即执行 |
| 关系 | 柯里化是偏函数的极端形式（每步只传一个） | 偏函数更灵活，允许一次固定多个 |

**应用场景**：
- 柯里化：参数复用、延迟执行、函数组合（如 Ramda/Lodash-FP 的 pipeline）。
- 偏函数：配置预设（如 `createLogger(prefix, level)`）、固定上下文（`bind` 即典型偏函数）。

**手写 curry 核心是递归收集参数，长度够了调原函数**；手写 partial 核心是先固定前缀参数再等待剩余参数。

**🔍 常见追问**

- curry 函数里的 fn.length 是什么？为什么能靠它判断参数够不够？
- 柯里化和 async/await 的链式调用有什么本质不同？
- 函数式编程里的 compose/pipe 和柯里化怎么配合？
- lodash 的 _.curry 和手写的有什么增强？(placeholder)

---

**▶ 追问 1：请手写一个通用 curry 函数。**

**💡 一句话速记**

curry函数接收fn，返回一个curried函数：每次收集参数，参数够了就执行原fn，不够就继续返回函数收集。

**📖 通俗详解**

用递归或arguments.length判断：收集到的参数总数 >= 原函数形参数时执行，否则返回新函数继续收集。

**🔧 示例 / 代码**

**实际应用：灵活的日志函数**：
```javascript
const curriedLog = curry((level, time, msg) => `${level} ${time} ${msg}`);

// 按需固定参数,生成专用函数
curriedLog('INFO')(Date.now())('started');
curriedLog('ERROR')(Date.now())('crashed');

// 或分步
curriedLog('WARN')  // 固定level,返回等time,msg的函数
  ('10:00')        // 再固定time
  ('low memory');  // 最后传msg执行
```

**curry 核心逻辑**：
```
curry(fn) → 返回curried函数
curried(args) →
  if args.length >= fn.length: 执行fn
  else: 返回新函数继续收集
```

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「函数柯里化」「偏函数」红色高频考点），请结合权威资料核验

---

### 76. JavaScript 的「内存泄漏」和「内存溢出」有什么区别？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-js-015`
> 标签：#内存泄漏, #内存溢出, #垃圾回收, #GC, #闭包, #事件监听, #全局变量, #排查

**💡 一句话速记**

内存泄漏是「该回收的没回收」（变量被意外引用导致 GC 无法回收，长期累积）；内存溢出是「分配时内存不够」（运行时申请超可用内存直接报错崩溃）。内存泄漏长期累积，最终可能导致内存溢出。

**📖 通俗详解**

**内存泄漏 vs 内存溢出**：
- **内存泄漏（Memory Leak）**：程序中已不用的内存（变量/对象）因为仍被引用，垃圾回收无法回收，长期占用。累积导致可用内存越来越少。
- **内存溢出（Out of Memory, OOM）**：程序运行时申请的内存超过了可用内存，直接报错崩溃。
- **关系**：内存泄漏长期累积，最终可能导致内存溢出。

**JS 的垃圾回收（GC）机制**：
现代 JS 引擎用「标记-清除」算法——从根（全局对象）出发，遍历引用链，能到达的对象保留，到达不了的回收。**内存泄漏的本质就是：对象本该到达不了，却因为意外引用仍能从根到达。**

**🔧 示例 / 代码**

**内存泄漏的本质（对象仍可达，GC 回收不了）**：
```javascript
let cache = {};
function getData(key) {
  if (!cache[key]) cache[key] = fetchHeavyData();  // 只存不清 → 永久持有
}
// cache 持续增长，对象一直可达，GC 无法回收

// 内存溢出：一次性申请超可用内存
new Array(1e12);  // RangeError: Invalid array length / Out of memory
```

**🔍 常见追问**

- WeakMap/WeakSet 为什么能避免泄漏？和 Map/Set 的区别？
- Vue/React 组件销毁时常见的泄漏有哪些？
- 标记-清除算法具体怎么工作？相比引用计数有什么优势？

---

**▶ 追问 1：常见内存泄漏场景有哪些？**

**💡 一句话速记**

常见泄漏场景：意外的全局变量、未解绑的事件监听/定时器、闭包引用、脱离 DOM 的引用、缓存无限增长。

**📖 通俗详解**

**常见内存泄漏场景**：

1. **意外的全局变量**：
```javascript
function foo() {
  bar = 'leaked';  // 忘记let/var/const,变成全局
  this.baz = 'leaked';  // this指向window
}
```

2. **未解绑的事件监听器**：
```javascript
const btn = document.getElementById('btn');
btn.addEventListener('click', handler);
// 后续移除DOM但没removeEventListener
btn.remove();  // handler仍引用旧DOM,泄漏
```

3. **遗忘的定时器**：
```javascript
setInterval(() => {
  const data = fetchHeavyData();  // data被闭包引用
  render(data);
}, 1000);
// 组件销毁时没clearInterval,持续运行
```

4. **闭包引用**：
```javascript
function outer() {
  const huge = new Array(1e6);
  return function() { console.log('hi'); };  // 没用huge但闭包链含它
}
// huge因闭包不释放
```

5. **脱离 DOM 的引用**：
```javascript
let btn = document.getElementById('btn');
document.body.removeChild(btn);  // DOM树里没了
// 但btn变量还引用它,GC回收不了
```

6. **缓存无限增长**：
```javascript
const cache = {};
function getData(key) {
  if (!cache[key]) cache[key] = fetch(key);  // 只存不清
}
```

**🔧 示例 / 代码**

| 场景 | 原因 | 修复 |
|---|---|---|
| 全局变量 | 忘记声明 | 用 let/const |
| 事件监听 | 未解绑 | removeEventListener |
| 定时器 | 未清除 | clearInterval/timeout |
| 闭包 | 不必要的引用 | 只保留需要的 |
| DOM引用 | 脱离DOM树仍引用 | 置null |
| 缓存 | 无限增长 | 设上限/LRU |

---

**▶ 追问 2：怎么排查内存泄漏？**

**💡 一句话速记**

排查用 Chrome DevTools Memory 面板（堆快照对比/分配时间线），找 Detached DOM 节点和 retained size 大的对象；预防靠严格声明、组件销毁清理、WeakMap 弱引用、缓存设上限。

**📖 通俗详解**

**排查方法（Chrome DevTools）**：
1. **Memory 面板 - Heap snapshot（堆快照）**：
   - 操作前后各拍快照，对比增量。
   - 找出 Detached DOM 节点、retained size 大的对象。
2. **Allocation timeline（分配时间线）**：
   - 录制操作过程，看内存持续增长不回落的区间。
3. **Performance Monitor**：观察 JS heap size 是否持续上涨。

**预防措施**：
- 严格用 let/const 声明，避免全局污染。
- 组件销毁时清理：removeEventListener、clearInterval/clearTimeout、置 null。
- 弱引用用 WeakMap/WeakSet（不阻止 GC）。
- 缓存设上限/过期策略。

**🔧 示例 / 代码**

```javascript
// 经典泄漏 vs 修复：事件监听成对出现
class Component {
  mount() {
    this.handler = () => this.update();
    window.addEventListener('resize', this.handler);
  }
  unmount() {
    // 修复：补上解绑
    window.removeEventListener('resize', this.handler);
    this.handler = null;
  }
}
```

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「内存泄漏和内存溢出」红色高频考点），请结合权威资料核验

---

## methodology

### 77. 你是怎么管理一个前端项目的？从需求到上线的完整流程是怎样的？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-method-001`
> 标签：#项目管理, #方法论, #软技能

**💡 一句话速记**

八步走：需求分析 → 任务分解 → 技术方案设计 → 开发 → 提测 → 风险抛出 → 线上观测 → 复盘。核心是「前期把需求和方案想清楚，过程中持续暴露风险，上线后有监控，做完要复盘」。

**📖 通俗详解**

**完整项目管理流程**：

1. **需求分析**：和产品对齐需求，明确做什么、为什么做、验收标准。主动质疑不合理需求，挖掘真实诉求。
2. **任务分解**：把大需求拆成可执行的小任务（WBS），估工时，排优先级。识别依赖关系。
3. **技术方案设计**：选型、架构、接口约定、风险评估。复杂方案要评审。产出文档。
4. **开发**：按方案实现，写代码 + 自测。遵循规范，及时 commit。
5. **提测**：自测通过后提给 QA，配合修 bug。
6. **风险抛出**：发现延期/技术难点/需求变更，**及时**抛出，不藏。给方案（A/B 选项），不只报问题。
7. **线上观测**：上线后盯监控、错误日志、用户反馈，确认没问题。
8. **复盘**：做完总结——做对了什么、踩了什么坑、下次怎么改进。

**核心原则**：
- 前期想清楚（需求+方案）> 后期返工。
- 风险早抛出，不捂着。
- 有 Owner 意识：对结果负责，不只是完成分配的任务。

**🔧 示例 / 代码**

举例：接一个「用户中心改版」需求。先和产品对齐改哪些模块、目标是什么（需求分析）；拆成「信息展示、编辑、权限」几个子任务并估时（任务分解）；定技术方案——用现有组件库、接口契约、是否复用旧逻辑（方案设计）；开发自测后提测；过程中发现接口字段和约定不符，及时抛出协调后端（风险抛出）；上线盯埋点和报错（观测）；做完总结这次接口对齐慢的原因，下次提前约定（复盘）。

**🔍 常见追问**

- 需求中途变更怎么处理？
- 怎么估算工时比较准？
- 项目要延期了，怎么和上级沟通？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》方法论板块（含「如何管理项目」）+ 模型知识。出处：doc/前端知识体系.md:349-356

---

### 78. 你是怎么带团队/做技术管理的？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 低频 · `fe-method-002`
> 标签：#团队管理, #方法论, #软技能

**💡 一句话速记**

四个抓手：目标对齐（让大家劲往一处使）、模块拆分分配（明确责任）、规范约定（工程化保障质量）、进度跟踪+沟通分享（对齐+成长）。核心是「目标清晰、分工明确、规范兜底、持续沟通」。

**📖 通俗详解**

**团队管理四件事**：

1. **目标对齐**：把团队目标拆解到每个人，让大家知道「整体目标是什么、我负责什么、我怎么贡献」。避免各干各的。
2. **模块拆分与分配**：按能力和成长需求分配模块，明确 owner（谁对这块负责）。边界清晰，避免重叠或真空。
3. **工程化规范与约定**：制定代码规范、code review 流程、CI/CD、提交规范。用工具和流程兜底质量，不靠人盯人。
4. **进度跟踪与沟通**：定期对齐进度（站会/周会），及时发现阻塞。code review 既是质量保障也是知识共享。

**软性管理**：
- 关注成员成长：给挑战性任务、分享机会、定期 1v1。
- 及时反馈：做对了表扬，有问题私下沟通。
- 做技术决策时讲清 why，让大家认同而非被动执行。

**核心理念**：管理不是「管人」，是「赋能」——创造环境让每个人发挥最大价值。

**🔧 示例 / 代码**

举例：带一个 5 人前端团队。月初把季度目标拆到每个人（目标对齐）；按业务模块分 owner——A 负责交易、B 负责用户、C 负责营销（模块分配）；推行 ESLint+Prettier+强制 code review+CI 自动化测试（规范）；每周周会同步进度、双周技术分享（沟通）。成员有成长、质量有保障、交付不延期。

**🔍 常见追问**

- 团队成员能力参差怎么带？
- code review 怎么做才不流于形式？
- 技术管理和个人贡献（写代码）怎么平衡？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》方法论板块（含「如何管理团队」）+ 模型知识。出处：doc/前端知识体系.md:344-348

---

### 79. 对于一个复杂的大型前端项目，你是怎么做架构设计的？出于哪些考虑选择某种架构？

> ⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-method-004`
> 标签：#前端架构, #复杂项目, #系统设计, #高频

**💡 一句话速记**

架构设计从「理解业务复杂度」出发：业务复杂度（功能多）、协作复杂度（人多）、技术复杂度（多端/多技术栈）。根据复杂度类型选方案：单体 SPA、Monorepo、微前端、SSR 等。选型要权衡团队能力、维护成本、演进路径，不盲目追新。

**📖 通俗详解**

**复杂项目的架构设计思路**：

**第一步：识别复杂度来源**：
- **业务复杂度**：功能模块多、业务规则复杂。
- **协作复杂度**：多个团队/多人同时开发。
- **技术复杂度**：多端（Web/小程序/App）、多技术栈、历史包袱（老代码）。
- **性能复杂度**：高并发、弱网、首屏要求高。

**第二步：根据复杂度选架构**：

| 复杂度 | 架构选择 |
|---|---|
| 业务复杂、模块清晰 | 模块化 + 路由分层 |
| 多团队协作、独立部署 | 微前端 |
| 多端复用 | 跨端框架（Taro/uni） |
| 多技术栈并存/老系统迁移 | 微前端（渐进迁移） |
| 首屏/SEO 要求高 | SSR/SSG |
| 多包共享代码 | Monorepo |
| 状态复杂 | 合适的状态管理方案 |

**第三步：选型考虑因素**：
1. **团队现状**：技术栈、能力、学习成本。选团队 hold 得住的。
2. **维护成本**：架构越复杂维护越贵，要有 ROI 意识。
3. **演进路径**：架构要能逐步演进，别一上来就 over-engineering。
4. **生态成熟度**：选生态成熟的方案，踩坑少。
5. **业务匹配**：架构服务业务，不是炫技。

**核心原则**：复杂度是一步一步上升的，架构也该渐进演进。先用简单方案解决当下问题，留好扩展空间，问题真出现了再升级。

**🔧 示例 / 代码**

举例：一个多业务线的企业后台。识别复杂度：多团队协作 + 业务模块多 + 老技术栈要迁移。选型：微前端（主应用+多个子应用，各团队独立开发部署）+ 新业务用 React、老业务保留 Vue 渐进迁移 + Monorepo 管理公共组件库。考虑：qiankun 生态成熟先上，CSS 隔离用约定+scoped，模块共享用 Module Federation。

**🔍 常见追问**

- 微前端是不是 over-engineering？什么规模才需要？
- 架构选型怎么避免「为了用而用」？
- 你做过最有挑战的架构决策是什么？为什么这么选？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》方法论板块（含「系统架构设计」「什么是大型复杂项目」）+ 模型知识。出处：doc/前端知识体系.md:365-375

---

## micro-frontend

### 80. 什么是微前端？它解决什么问题？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-mfe-001`
> 标签：#微前端, #场景, #原理, #高频

**💡 一句话速记**

微前端是把一个大型前端应用拆成多个独立的小应用（可独立开发/部署/技术栈），再整合成一个整体。解决巨石应用的「协作难、部署耦合、技术栈锁定」问题。

**📖 通俗详解**

**微前端解决的核心问题**：

随着项目变大变老，出现「巨石应用」：
1. **构建慢**：代码越堆越多，构建几分钟。
2. **协作冲突**：多团队改同一仓库，互相阻塞。
3. **部署耦合**：改一处要整体重新部署，风险大。
4. **技术栈锁定**：老项目想升级 React/Vue，但牵一发动全身。

**微前端的解法**（借鉴后端微服务思想）：
- 把应用拆成多个**独立的小应用**，每个可：
  - 独立开发、独立部署、独立技术栈。
  - 由不同团队负责。
- 运行时整合成一个整体，用户感觉是「一个应用」。

**🔧 示例 / 代码**

**微前端整合示例**：
```
主应用(容器): 负责导航、鉴权、子应用调度
  ├── 子应用A (React，团队A维护)
  ├── 子应用B (Vue，团队B维护)
  └── 子应用C (老 Angular，团队C维护)
各子应用独立部署，主应用动态加载
```

**🔍 常见追问**

- 微前端和后端微服务有什么对应关系？
- 微前端的「独立部署」具体怎么实现的？

---

**▶ 追问 1：什么场景下需要微前端？**

**💡 一句话速记**

适合超大型项目、多团队协作、老系统渐进迁移；中小项目、单一技术栈无重构需求则不该用——微前端会引入不必要的复杂度。

**📖 通俗详解**

**适用场景**：
1. **超大型企业应用**：多个业务模块、多团队。
2. **渐进式重构**：老系统（Vue2）想逐步迁移到新技术栈，新旧并存。
3. **多业务整合**：不同子公司的系统整合到一个门户。

**不适用**（别滥用）：
- 中小项目：微前端引入复杂度，得不偿失。
- 团队小：没多团队协作需求。
- 单一技术栈且无重构需求。

**🔍 常见追问**

- 什么情况下不该用微前端？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-微前端板块（含红色高亮「微前端的场景和原理」）+ 模型知识。建议结合 qiankun 官方文档核验。出处：doc/前端知识体系.md:180

---

### 81. qiankun 微前端框架的优缺点和核心机制是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-mfe-002`
> 标签：#qiankun, #优缺点, #高频

**💡 一句话速记**

qiankun 基于 single-spa，核心是「HTML Entry」——通过加载子应用的 HTML，解析出 JS/CSS 并在沙箱里执行。优点：接入简单（几行代码）、JS 沙箱隔离、生态成熟。缺点：JS 沙箱有性能开销、CSS 隔离不彻底（默认没做）、子应用要改造、多实例复杂。

**📖 通俗详解**

**qiankun 核心机制**：
1. **HTML Entry**：主应用配置子应用的入口 HTML 地址。qiankun fetch 这个 HTML，解析出里面的 `<script>`、`<style>`、`<link>`。
2. **资源加载执行**：把解析出的 JS 在一个**沙箱环境**里执行，CSS 注入页面。
3. **生命周期**：子应用导出 bootstrap/mount/unmount，qiankun 在对应时机调用，实现挂载/卸载。
4. **JS 沙箱**：隔离子应用的 window，防止互相污染（Proxy 拦截 window 操作）。

**优点**：
- 接入简单：主应用几行配置，子应用导出生命周期即可。
- JS 沙箱：隔离全局变量，子应用之间不冲突。
- 生态成熟：基于 single-spa，社区大、踩坑经验多。
- 预加载：可预加载子应用资源，切换快。

**缺点**：
- **CSS 隔离弱**：默认不做 CSS 隔离（样式可能串），要手动处理（shadowDOM 或 scoped css，都有坑）。
- **JS 沙箱性能**：Proxy 拦截有开销，复杂子应用可能卡。
- **子应用需改造**：要改打包配置、导出生命周期、处理跨域。
- **多实例支持复杂**：同时加载多个相同子应用实例时，沙箱和状态管理麻烦。
- **通信机制简单**：提供 actions 但不够强大，复杂通信要自己设计。

**🔧 示例 / 代码**

**qiankun 接入**：
```javascript
// 主应用：注册子应用
import { registerMicroApps, start } from 'qiankun';
registerMicroApps([
  {
    name: 'react-app',
    entry: '//localhost:7100',  // 子应用 HTML 地址
    container: '#sub-container',
    activeRule: '/react',       // 路由匹配时加载
  },
]);
start();

// 子应用：导出生命周期
export async function bootstrap() {}
export async function mount(props) { ReactDOM.render(<App/>, props.container); }
export async function unmount(props) { ReactDOM.unmountComponentAtNode(props.container); }
```

**🔍 常见追问**

- qiankun 的 JS 沙箱（Proxy）具体怎么实现隔离？
- qiankun 的 CSS 隔离为什么默认不做？shadowDOM 方案有什么坑？
- qiankun 和 wujie/micro-app 相比有什么优劣？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-微前端板块（含红色高亮「qiankun的优缺点」）+ 模型知识。建议结合 qiankun 官方文档核验。出处：doc/前端知识体系.md:179

---

### 82. 微前端项目中，主应用加载子应用资源时的跨域问题怎么解决？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-mfe-004`
> 标签：#微前端, #跨域, #模块共享, #monorepo

**💡 一句话速记**

主应用要动态 fetch 子应用的 JS/CSS，跨域会触发 CORS：子应用服务端配 Access-Control-Allow-Origin 放行主应用域名，或主应用用反向代理把子应用资源代理到同域。qiankun 用 fetch 加载资源，所以 CORS 必须配。

**📖 通俗详解**

**子应用跨域问题**：

主应用要动态加载子应用的 JS/CSS（跨域 fetch），会遇到 CORS：
- **原因**：主应用域名和子应用资源域名不同，浏览器拦截跨域请求。
- **解决**：
  - 子应用服务端配 CORS：`Access-Control-Allow-Origin: 主应用域名`（或 *）。
  - 或主应用用反向代理，把子应用资源代理到同域。
  - qiankun 加载资源用的是 fetch，所以 CORS 必须配。

**对比其它加载方式**：
- `<script src>`/`<link href>` 加载静态资源本身不受同源策略限制（但要防 CSRF），所以 iframe/JS entry 方式跨域压力小。
- 但 qiankun 这种动态 fetch 资源、再 eval 注入的方式，必须配 CORS。

**类比**：CORS 配置像「子应用给主应用发通行证」，反向代理像「主应用自己开个窗口代拿资源」。

**🔧 示例 / 代码**

**CORS 配置（子应用）**：
```
Access-Control-Allow-Origin: https://main-app.com
Access-Control-Allow-Methods: GET
```

**反向代理（主应用 nginx）**：
```nginx
# 主应用把子应用资源代理到同域
location /sub-app/ {
  proxy_pass https://sub-app.example.com/;
}
```

**🔍 常见追问**

- qiankun 加载子应用用 fetch，为什么不用 script 标签？
- 子应用资源配了 CORS=* 有什么风险？怎么收紧？

---

**▶ 追问 1：多个微前端子应用之间如何共享模块（如 React、工具库）？Monorepo 在其中起什么作用？**

**💡 一句话速记**

运行时共享用 webpack Module Federation（一个应用 expose 模块、其他 consume，单例库只加载一次）；简单场景用 externals + CDN。Monorepo 是开发时的代码组织方式（公共组件/工具抽成内部包共享源码），和运行时整合是两回事，两者可结合。

**📖 通俗详解**

**模块共享问题**：多个子应用都引入 React、工具库，会重复加载（体积大，且 React 这种单例库多次加载会报错）。

**方案对比**：
- **webpack Module Federation（模块联邦，主流）**：运行时共享——一个应用 expose（暴露）模块，其他应用 consume（消费）；React 这种单例库可配 singleton 只加载一次。优点：运行时动态共享、版本协商、按需加载；缺点：依赖 webpack5+、配置复杂。
- **externals + CDN**：把 React/Lodash 配成 externals，全部从同一 CDN 加载。优点：简单；缺点：强依赖 CDN、版本要统一、不是真正按需。
- **Monorepo（开发时共享）**：把公共代码抽成独立包，多应用在同一仓库（pnpm workspace）共享源码。注意：Monorepo 是**开发时**的代码组织，和微前端的**运行时**整合是两回事，可结合使用。

**Monorepo 用法**：pnpm workspace / lerna / turborepo，把公共组件、工具、类型抽成内部包，各子应用依赖。优点：代码复用、统一版本、原子化修改；缺点：仓库大、构建配置复杂。

**🔧 示例 / 代码**

**模块联邦配置**：
```javascript
// 子应用A 暴露 React（webpack config）
new ModuleFederationPlugin({
  shared: { react: { singleton: true } }
})

// 子应用B 消费（自动复用A已加载的react，不重复加载）
new ModuleFederationPlugin({
  shared: { react: { singleton: true } }
})
```

**🔍 常见追问**

- 模块联邦的版本冲突（子应用A用React17，B用React18）怎么处理？
- Monorepo 和 Multirepo 各有什么优劣？什么场景选哪个？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-微前端板块（含「子应用的跨域问题」「模块如何共享」「monorepo的用法」）+ 模型知识。建议结合 webpack Module Federation 文档核验。出处：doc/前端知识体系.md:182-185

---

### 83. 微前端的沙盒（隔离）方案有哪些？JS 沙箱和 CSS 隔离分别怎么实现？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-mfe-003`
> 标签：#微前端, #沙盒, #JS沙箱, #CSS隔离, #高频

**💡 一句话速记**

JS 沙箱：Proxy 代理 window（快照沙箱/代理沙箱），拦截子应用对 window 的读写，实现隔离。CSS 隔离：Shadow DOM（彻底但样式难穿透）、scoped CSS（加前缀，有局限）、CSS Modules。没有完美方案，各有取舍。

**📖 通俗详解**

**JS 沙箱方案**（隔离子应用的 window）：

1. **快照沙箱（Snapshot Sandbox）**：
   - 子应用挂载前，快照当前 window。
   - 子应用卸载时，恢复 window 到快照。
   - 缺点：要遍历整个 window，性能差；不支持多实例。

2. **代理沙箱（Proxy Sandbox，qiankun 主用）**：
   - 给子应用一个 Proxy 代理的 fake window。
   - 子应用所有 window 读写都被 Proxy 拦截，写到 fake window 里，不碰真实 window。
   - 优点：性能好（不遍历）、支持多实例（每个子应用一个 fake window）。
   - 这是现代主流方案。

**CSS 隔离方案**（隔离子应用样式）：

1. **Shadow DOM**：
   - 把子应用挂到 Shadow DOM 里，样式天然隔离（进不去也出不来）。
   - 优点：彻底隔离。
   - 缺点：外部全局样式（如 antd 主题）进不去、弹窗 portal 挂到 body 逃出 shadow、第三方库可能不兼容。

2. **Scoped CSS（CSS 作用域）**：
   - 运行时给子应用所有选择器加前缀（`.sub-app .xxx`）。
   - 缺点：运行时改 CSS 有性能开销、动态插入的样式可能漏、!important 冲突。

3. **CSS Modules / 命名约定**：
   - 开发时就用模块化 CSS 避免冲突。
   - 缺点：依赖子应用自觉，第三方库的样式管不了。

**现实**：没有完美方案。Shadow DOM 隔离彻底但兼容坑多；Scoped CSS 兼容好但不彻底。多数项目权衡后用 Scoped CSS + 约定。

**🔧 示例 / 代码**

**Proxy 沙箱核心**：
```javascript
class ProxySandbox {
  constructor() {
    const fakeWindow = Object.create(null);
    this.proxy = new Proxy(fakeWindow, {
      get(target, key) {
        return key in target ? target[key] : window[key]; // 自己有用自己的，没有用全局的
      },
      set(target, key, value) {
        target[key] = value;  // 写到 fakeWindow，不污染真实 window
        return true;
      }
    });
  }
}
// 子应用在这个 proxy 里跑，window 被替换成 proxy
```

**🔍 常见追问**

- Proxy 沙箱能拦住所有对 window 的操作吗？有逃逸的情况吗？
- Shadow DOM 的弹窗逃逸问题（portal 到 body）怎么解决？
- wujie 用 iframe 做隔离，和 Proxy 沙箱比有什么优劣？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-微前端板块（含红色高亮「微前端的沙盒方案」）+ 模型知识。建议结合 qiankun/wujie 源码核验。出处：doc/前端知识体系.md:181

---

## miniprogram

### 84. 微信小程序为什么采用「双线程架构」（视图层和逻辑层分离）？这种架构有什么优缺点？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-mp-001`
> 标签：#小程序, #双线程, #架构, #高频

**💡 一句话速记**

双线程：视图层（WebView 渲染）和逻辑层（JSCore 跑 JS）分离，通过 Native 桥通信。目的是安全和可控——逻辑层拿不到 DOM，防止开发者操作 DOM 跳转/改 UI，便于微信管控；同时多页面复用 WebView。代价是通信有延迟、不能用 DOM API。

**📖 通俗详解**

**双线程架构**：
- **视图层（WebView）**：每个页面一个 WebView，负责渲染 WXML/WXSS。可以有多个（多页面）。
- **逻辑层（JSCore/V8）**：只有一个，跑所有 JS 逻辑（数据、事件处理）。**没有 DOM/BOM API**。
- **Native 层（微信客户端）**：作为中间人，在两个线程间转发数据和事件。

**为什么这么设计**：
1. **安全可控**：逻辑层拿不到 DOM，开发者无法用 JS 直接操作页面、跳转、注入，微信能完全管控小程序行为。如果用单线程（像普通网页），JS 能随意操作 DOM，管控不住。
2. **性能**：多个页面复用 WebView，切换快；逻辑层独立，不阻塞渲染。
3. **一致性**：渲染统一走 WebView，跨平台体验一致。

**代价（缺点）**：
1. **通信延迟**：视图层和逻辑层通信要经过 Native 中转，有延迟。setData 频繁会卡。
2. **不能用 DOM API**：没有 document/window，很多前端库用不了。
3. **调试复杂**：两个线程，调试要分开看。

**🔧 示例 / 代码**

**双线程通信流程**：
```
用户点击按钮
  → 视图层(WebView) 捕获事件
  → 经 Native 转发到 逻辑层(JSCore)
  → 逻辑层处理，调用 setData
  → setData 数据经 Native 回到 视图层
  → 视图层重新渲染
```

**setData 慢的根因**：数据要从逻辑层序列化、跨线程传到视图层，数据量大或频繁调用就卡。所以小程序优化核心是「减少 setData 的数据量和频率」。

**🔍 常见追问**

- setData 为什么慢？怎么优化？（提示：只传变化的数据、合并调用）
- 小程序为什么不能用 jQuery/直接操作 DOM？
- 双线程架构和浏览器的单线程模型比，开发上有什么不便？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-小程序板块（含红色高亮「基本架构，为什么采用这种架构」）+ 模型知识。建议结合微信小程序官方文档核验。出处：doc/前端知识体系.md:167

---

### 85. 小程序的 WXML/WXSS 最终编译成什么？为什么不能直接用 HTML/CSS？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-mp-002`
> 标签：#小程序, #wxml, #编译, #高频

**💡 一句话速记**

WXML 编译成 JS（通过 WCC 编译器转成 render 函数生成虚拟 DOM），不是直接转 HTML；WXSS 编译成 JS 注入的样式。因为双线程架构下视图层要动态生成、要适配多端、要做安全管控（不能让开发者写任意 HTML/JS 操作 DOM），所以用自定义标签再编译。

**📖 通俗详解**

**WXML 的编译产物**：
- WXML 不是直接转成 HTML。它经过 **WCC 编译器**，编译成一个 JS 函数（$gwx）。
- 运行时，逻辑层把数据传给这个函数，函数生成**虚拟 DOM 树（JS 对象）**。
- 虚拟 DOM 树再通过 setData 传到视图层，渲染成实际的渲染层节点（基于 WebView 但做了封装）。

**为什么不能直接用 HTML/CSS**：
1. **安全管控**：直接用 HTML，开发者能写 `<script>`、`onclick` 执行任意 JS 操作 DOM，破坏双线程的安全模型。自定义 WXML 标签（`<view>`、`<text>`）是受控的，编译时能检查。
2. **多端适配**：小程序要跑在 iOS/Android/PC，编译成中间表示（虚拟 DOM）后，各端可以有不同的渲染后端。
3. **数据驱动**：WXML 编译成 render 函数，天然支持数据驱动视图，不用手动操作 DOM。

**WXSS 编译**：
- WXSS ≈ CSS + rpx 单位 + 局部样式作用域。
- 编译时：rpx 换算成 px，样式作用域加 hash 隔离，最终注入到 WebView。

**整体流程**：WXML → WCC → JS render 函数 → 数据传入 → 虚拟DOM → setData → 视图层渲染。

**🔧 示例 / 代码**

**编译流程**：
```
开发：写 WXML (<view>{{msg}}</view>)
  ↓ 编译时（WCC）
生成：$gwx render 函数（JS）
  ↓ 运行时
逻辑层：$gwx({msg:'hi'}) → 生成 vnode {tag:'view', children:['hi']}
  ↓ setData
视图层：渲染成 <view>hi</view>
```

**对比普通网页**：网页是 HTML 直接渲染；小程序是 WXML → JS → vnode → 渲染，多了一层抽象。

**🔍 常见追问**

- WCC 编译器具体做了哪些事？
- rpx 单位是怎么工作的？和 px/rem 有什么区别？
- 小程序的虚拟 DOM 和 Vue/React 的虚拟 DOM 一样吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-小程序板块（含红色高亮「wxml 编译后是什么」）+ 模型知识。建议结合微信小程序官方文档核验。出处：doc/前端知识体系.md:170

---

### 86. 小程序有哪些性能优化手段？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-mp-003`
> 标签：#小程序, #性能优化, #setData, #分包

**💡 一句话速记**

核心优化：减少 setData 的数据量和频率（只传变化的、合并调用）、分包加载（按需加载子包）、长列表虚拟化、图片懒加载、减少节点嵌套层级。

**📖 通俗详解**

**小程序性能优化手段**：

**1. setData 优化（最关键）**：见追问。setData 要跨线程（逻辑层→视图层）传输数据，数据要序列化，开销大。

**2. 分包加载**：
- 把小程序拆成主包 + 多个子包，按需加载子包。
- 减少首次加载体积，加快启动。

**3. 长列表优化**：
- 虚拟列表（recycle-view）：只渲染可视区域的项。
- 避免一次性 setData 上千条数据。

**4. 资源优化**：
- 图片懒加载、用 CDN、压缩、用 WebP。
- 减少包体积（清理无用代码、按需引入）。

**5. 渲染优化**：
- 减少节点嵌套层级。
- 避免频繁变化的动画（用 CSS 动画而非 JS）。
- 合理用 wx:if vs hidden（频繁切换用 hidden，不频繁用 wx:if）。

**6. 启动优化**：
- 主包只放核心页面，其他进分包。
- 减少启动时的同步逻辑。

**🔧 示例 / 代码**

**分包配置**：
```json
{
  "pages": ["pages/index/index"],
  "subpackages": [
    { "root": "moduleA", "pages": ["pages/detail/detail"] }
  ]
}
```

**资源优化**：图片懒加载 `<image lazy-load />`，用 WebP 格式。

**🔍 常见追问**

- 小程序启动慢怎么排查？有哪些指标？
- 分包和独立分包有什么区别？
- recycle-view 虚拟列表原理是什么？

---

**▶ 追问 1：setData 为什么是小程序的性能关键？**

**💡 一句话速记**

因为 setData 要跨线程序列化传输（逻辑层→视图层），数据量大或调用频繁都会导致序列化和通信开销陡增，直接造成卡顿；优化手段是只传变化的数据、合并多次调用。

**📖 通俗详解**

**setData 为什么是关键**：
- setData 要跨线程（逻辑层→视图层）传输数据，数据要序列化，开销大。
- 数据量大或调用频繁，序列化 + 通信耗时陡增，直接卡 UI 线程。

**优化手段**：
- 只传变化的数据（不要整个对象，传 `{list[0].name: 'new'}`）。
- 合并多次 setData 为一次。
- 避免 setData 大量数据（如整个长列表）。
- 避免在滚动等高频事件里频繁 setData。

**🔧 示例 / 代码**

**setData 优化对比**：
```javascript
// ❌ 差：传整个列表
this.setData({ list: newList });

// ✅ 好：只传变化的那一项
this.setData({ ['list[0].name']: newName });

// ❌ 差：多次 setData
this.setData({ a: 1 });
this.setData({ b: 2 });

// ✅ 好：合并一次
this.setData({ a: 1, b: 2 });
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-小程序板块（含「性能优化的手段」）+ 模型知识。建议结合微信小程序性能优化文档核验。出处：doc/前端知识体系.md:169

---

## nodejs

### 87. Node.js 的事件循环和浏览器的事件循环有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-001`
> 标签：#事件循环, #event-loop, #Node.js, #高频

**💡 一句话速记**

Node.js 用 6 个阶段（timers、pending、poll、check、close + 微任务队列），浏览器只有宏任务+微任务两类；Node 11 以前 timers 阶段会一次性清空所有到期回调，11 之后对齐浏览器「每个宏任务后清空微任务」。

**📖 通俗详解**

浏览器的循环模型很简单：执行一个宏任务 → 清空所有微任务 → 渲染 → 取下一个宏任务，循环往复。

Node.js 把宏任务分成 6 个阶段（phase），按固定顺序轮转：

| 阶段 | 处理什么 |
|---|---|
| timers | 到期的 setTimeout/setInterval 回调 |
| pending callbacks | 系统级回调（如 TCP 错误） |
| idle, prepare | 内部使用 |
| poll | 取新的 I/O 回调，会阻塞等待定时器 |
| check | setImmediate 回调 |
| close callbacks | close 事件（如 socket.close） |

两个微任务队列穿插在阶段之间：**Promise.then / queueMicrotask** 和 **process.nextTick**（nextTick 优先级更高，会在每个阶段切换前清空）。

**关键差异**：
1. Node 11 之前，timers 阶段会把所有到期的 timer 回调**一次性执行完**再清微任务；11+ 改成每个回调后清微任务，和浏览器对齐。
2. `setImmediate`（check 阶段）是 Node 独有的，浏览器没有。
3. `process.nextTick` 优先级比 Promise 还高，浏览器没有这个 API。

**类比**：浏览器像「一个窗口排队」；Node 像「6 个窗口轮流开」，每个窗口办完一批才切下一个。

**🔧 示例 / 代码**

```js
// 经典考题：Node 中输出顺序
setTimeout(() => console.log("timer1"), 0);
setTimeout(() => console.log("timer2"), 0);
setImmediate(() => console.log("immediate"));
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));

// 微任务恒优先：nextTick -> promise 永远最先
// （nextTick 优先级高于 Promise）

// ⚠️ 在主模块里，timer1/timer2 与 immediate 的先后「不确定」：
//     受进程启动到事件循环进入 timers 阶段的耗时影响，
//     可能先执行 timers，也可能先执行 check 阶段的 immediate，
//     所以主模块内不要假设 setTimeout(0) 一定先于 setImmediate。
//     这是 Node 经典的「不确定顺序」陷阱。

// 但在 I/O 回调里，顺序是确定的：setImmediate 必先于 setTimeout(0)。
// 因为 I/O 回调在 poll 阶段执行，结束后直接进 check 阶段，
// 之后才轮到下一轮的 timers，故 immediate 一定先于 timer。

fs.readFile(__filename, () => {
  setTimeout(() => console.log("timer"), 0);
  setImmediate(() => console.log("immediate"));
  // 这里输出恒为 immediate -> timer
});
```

**🔍 常见追问**

- `process.nextTick` 和 `queueMicrotask` 哪个先执行？为什么 nextTick 不建议滥用？
- 在 I/O 回调里，`setTimeout(fn,0)` 和 `setImmediate(fn)` 谁先？（提示：I/O 回调后 check 阶段在前）
- Node 11 之后为什么对齐浏览器？解决了什么问题？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:186-192）+ 模型知识。建议结合 Node.js 官方文档「The Node.js Event Loop」核验。出处：doc/前端知识体系.md:187

---

### 88. pm2 在 Node.js 部署中起什么作用？它的核心能力有哪些？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-node-003`
> 标签：#pm2, #守护进程, #进程管理, #部署

**💡 一句话速记**

pm2 是 Node.js 的进程管理器，核心能力：守护进程（崩溃自动重启）、多进程集群（cluster 模式利用多核）、日志管理、零停机重载、状态监控。

**📖 通俗详解**

Node.js 单线程跑业务逻辑，一个未捕获异常就整个进程挂掉；单进程也只能用一个 CPU 核。pm2 解决的就是这两类生产问题：

| 能力 | 说明 |
|---|---|
| 守护进程 | 后台运行，主进程崩了 pm2 自动拉起，不用 nohup |
| 集群模式 | `pm2 start app.js -i max` 用 cluster 起多个 worker，榨干多核 |
| 零停机重载 | `pm2 reload` 一个个重启 worker，请求不中断（graceful reload） |
| 日志管理 | 自动收集 stdout/stderr 到日志文件，支持日志切割 |
| 监控 | `pm2 monit` 看内存/CPU/事件，`pm2 list` 看进程状态 |
| 启动项 | `pm2 startup` + `pm2 save` 让服务开机自启 |

**集群原理**：pm2 内部用 Node 的 `cluster` 模块，主进程（master）监听端口，把连接分发（round-robin）给多个 worker 进程，worker 间共享端口。

**重启策略**：`restart` 是「先停后启」会断请求；`reload` 是「逐个重启」保持可用；`cluster` 模式下 reload 才能零停机。

**类比**：pm2 像「包工头」，你只管把 app.js 交给它，它负责招工人（worker）、盯着干活、谁倒下立刻补人、记录工时日志。

**🔧 示例 / 代码**

```js
// ecosystem.config.js —— 推荐用配置文件而非命令行
module.exports = {
  apps: [{
    name: "api",
    script: "./app.js",
    instances: "max",        // 利用所有 CPU 核
    exec_mode: "cluster",    // 集群模式
    autorestart: true,       // 崩溃自动重启
    max_restarts: 10,        // 1 分钟内重启超 10 次认为有病，停止
    watch: false,            // 文件变化不重启（生产关掉）
    env: { NODE_ENV: "production", PORT: 3000 },
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    max_memory_restart: "1G" // 内存超 1G 自动重启（防内存泄漏）
  }]
};
```

```bash
pm2 start ecosystem.config.js   # 启动
pm2 reload api                  # 零停机重载
pm2 logs api                    # 看日志
pm2 monit                       # 实时监控
pm2 startup                     # 生成开机自启脚本
pm2 save                        # 保存当前进程列表
```

**🔍 常见追问**

- `cluster` 模式下多个 worker 共享一个端口，连接是如何分配给各 worker 的？（提示：master round-robin）
- pm2 reload 是如何做到「零停机」的？（提示：逐个 worker 重启）
- 多 worker 之间如何共享 session/缓存？（提示：用 Redis 等外部存储，进程内存不共享）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:189）+ 模型知识。建议结合 pm2 官方文档核验。出处：doc/前端知识体系.md:189

---

### 89. Node.js 的 Buffer 是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-006`
> 标签：#Buffer, #二进制, #Node.js, #高频

**💡 一句话速记**

Buffer 是 Node 用来存二进制数据的「定长字节序列」，类似 `Uint8Array` 的子类，用于在网络/文件读写时高效处理原始字节，不像字符串需要编码转换。

**📖 通俗详解**

JavaScript 原生没有处理二进制的方便手段（早期），Node 设计 Buffer 来处理 TCP 流、文件 I/O 这类字节流数据。

**为什么需要它**：网络/文件 I/O 来的是字节流，如果都用字符串，每次都要按编码（UTF-8 等）来回转，慢且可能出错（如二进制图片不能当文本）。Buffer 直接搬字节，零拷贝。

**关键点**：
1. Buffer 是 `Uint8Array` 的子类，`buf[i]` 取到 0-255 的数字。
2. 定长，创建后大小不变，`buf.length` 是字节数。
3. 和字符串互转要指定编码：`Buffer.from(str, 'utf8')` / `buf.toString('utf8')`。
4. 旧 API `new Buffer()` 已废弃（有安全问题），改用 `Buffer.alloc(n)` / `Buffer.from(...)`。

**类比**：String 是「翻译好的稿子」（有编码、能读）；Buffer 是「原版胶片」（就是一串字节，要什么编码自己再译）。

**🔧 示例 / 代码**

```js
// 创建
const b1 = Buffer.from("hello", "utf8");   // <Buffer 68 65 6c 6c 6f>
const b2 = Buffer.alloc(8);                // 8 字节，填 0
const b3 = Buffer.allocUnsafe(8);          // 8 字节，未初始化（快但可能含旧数据，要手动填）

// 读写
console.log(b1[0]);        // 104 ('h' 的 ASCII)
console.log(b1.toString()); // "hello"
b2.write("Hi");            // 写入字符串

// Base64 互转（常用于小图、token）
const b64 = b1.toString("base64");  // "aGVsbG8="
const back = Buffer.from(b64, "base64");
```

**🔍 常见追问**

- `Buffer.alloc` 和 `Buffer.allocUnsafe` 有什么区别？为什么不推荐 `new Buffer()`？
- Buffer 和 `Uint8Array` / `ArrayBuffer` 是什么关系？（提示：Buffer 是 Uint8Array 子类，buf.buffer 是底层 ArrayBuffer）

---

**▶ 追问 1：Buffer 和普通字符串/数组有什么区别？**

**💡 一句话速记**

Buffer 存原始字节且定长、内存分配在 V8 堆外（C++ 分配）；String 是 UTF-16 不可变、堆内；Array 存任意 JS 值、动态。Buffer 处理二进制零拷贝，无需编码转换。

**📖 通俗详解**

| 维度 | Buffer | String | Array |
|---|---|---|---|
| 存储内容 | 原始字节（0-255） | UTF-16 码元 | 任意 JS 值 |
| 是否定长 | 创建后长度固定 | 不可变（每次拼接生成新串） | 动态 |
| 内存位置 | V8 堆外（C++ 分配） | V8 堆内 | V8 堆内 |
| 与编码 | 需指定编码转换 | 本身带编码 | 无编码概念 |

**注意**：大数据别用 `Buffer.concat` 拼超多块，会很占内存。

---

**▶ 追问 2：Buffer 有哪些常见使用场景？**

**💡 一句话速记**

常见场景：文件读写（直接拿字节）、网络数据（TCP/HTTP 流）、Base64 编解码（小图、token）、与字符串互转做编码处理。

**📖 通俗详解**

**常见使用场景**：
- **文件读写**：`fs.readFileSync` 直接拿到字节，处理二进制文件（图片、视频）。
- **网络数据**：TCP 流、HTTP 请求/响应体都是字节流，用 Buffer 承载。
- **Base64 编解码**：小图转 base64 内联、token 处理。
- **编码转换**：字符串与 Buffer 互转做 UTF-8/GBK 等编码处理。
- **Stream 处理**：流的数据块都是 Buffer。

**🔧 示例 / 代码**

```js
const fs = require("fs");
const buf = fs.readFileSync("./pic.png"); // 直接拿到字节
fs.writeFileSync("./copy.png", buf);

// 拼接
const out = Buffer.concat([b1, b2]);
console.log(out.length);   // 5 + 8 = 13
```

**🔍 常见追问**

- 大文件用 `readFileSync` 读成 Buffer 有什么问题？应该用什么？（提示：用 Stream 分块读，见 fe-node-007）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:192 红字标注）+ 模型知识。建议结合 Node.js 官方文档「Buffer」核验。出处：doc/前端知识体系.md:192

---

### 90. 什么是服务端渲染（SSR）？它的基本原理是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-008`
> 标签：#SSR, #服务端渲染, #原理, #高频

**💡 一句话速记**

SSR 是在服务器上把组件渲染成 HTML 字符串发给浏览器，用户拿到的是「带内容的完整页面」，而不是 CSR 那种「空 HTML + JS 再渲染」。原理：服务端执行组件代码生成 HTML → 客户端 hydrate（注水）接管交互。

**📖 通俗详解**

对比两种渲染方式：

| 方式 | HTML 返回内容 | 首屏 | SEO | 流程 |
|---|---|---|---|---|
| CSR（客户端渲染） | 空的 `<div id=root></div>` + JS bundle | 慢（要下 JS 再渲染） | 差（爬虫看不到内容） | 服务器给空壳，浏览器跑 JS 渲染 |
| SSR（服务端渲染） | 完整带内容的 HTML | 快（直接看到内容） | 好（HTML 里有内容） | 服务器跑组件出 HTML，浏览器拿到后 hydrate |

**SSR 两步走**：
1. **服务端渲染（render）**：服务器执行 React/Vue 组件（`renderToString`），拿到首屏 HTML 字符串，拼到模板里返回。
2. **客户端注水（hydration）**：浏览器加载 JS 后，不重新渲染 DOM，而是把事件监听「挂」到现有 DOM 上（hydrateRoot），让页面变成可交互应用。

**关键约束**：
- 服务端没有 DOM/window，组件里不能直接用 `document`、`window`，要用生命周期（`onMounted`/`useEffect`）放到客户端执行。
- 服务端是同步的（renderToString），不能渲染异步数据后再返回——数据要先 fetch 完再 render，或用 Next.js 的 `getServerSideProps` 这类方案预取。
- 组件代码要在 Node 和浏览器两边都能跑（同构/通用代码）。

**类比**：CSR 像「给你空盘子和菜谱，你自己炒」（要等）；SSR 像「厨房炒好端上桌，你坐下就能吃，但筷子（交互）稍后给你」。

**🔧 示例 / 代码**

```jsx
// React SSR 最小示例
import { renderToString } from "react-dom/server";
import express from "express";
import App from "./App";

const app = express();
app.get("*", (req, res) => {
  // 1. 服务端把组件渲染成 HTML 字符串
  const html = renderToString(<App />);
  res.send(`
    <html>
      <body>
        <div id="root">${html}</div>
        <script src="/client.js"></script>
      </body>
    </html>
  `);
});
app.listen(3000);
```

```jsx
// client.js —— 客户端注水（不是重新渲染，是接管）
import { hydrateRoot } from "react-dom/client";
import App from "./App";

hydrateRoot(document.getElementById("root"), <App />);
// 注意：用 hydrateRoot 不是 createRoot，避免重新创建 DOM
```

```js
// Vue SSR
import { renderToString } from "@vue/server-renderer";
import { createSSRApp } from "vue";
const app = createSSRApp(App);
const html = await renderToString(app);
```

**🔍 常见追问**

- 什么是 hydration mismatch（注水不匹配）？什么情况下会发生？
- 服务端没有 window/document，组件里用到浏览器 API 怎么办？（提示：用 onMounted/useEffect 或 typeof window 判断）
- SSR 一定要全做吗？有没有折中方案？（提示：部分预渲染、 Islands 架构）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》服务端渲染板块（doc/前端知识体系.md:193-196）+ 模型知识。建议结合 Next.js / Nuxt.js 官方文档核验。出处：doc/前端知识体系.md:194

---

### 91. SSR 相比 CSR（客户端渲染）有哪些优势？又有什么代价？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-009`
> 标签：#SSR, #SEO, #首屏性能, #优势

**💡 一句话速记**

优势：首屏快、SEO 好、利于弱网/低端机；代价：服务器压力增大、开发复杂（要写同构代码）、TTFB 变慢（要等数据请求）、部署需要 Node 环境。

**📖 通俗详解**

**优势**：

| 优势 | 原因 |
|---|---|
| 首屏快（FCP/LCP 优） | 浏览器拿到 HTML 立刻就能显示内容，不用等 JS 下载执行 |
| SEO 友好 | 爬虫直接从 HTML 读到完整内容，CSR 的空 div 爬虫抓不到 |
| 弱网/低端机体验好 | 不依赖客户端 JS 执行能力，老机器也能快速看到内容 |
| 社交分享预览好 | 链接卡片能抓到 og 标签和内容（CSR 抓不到） |

**代价**：
| 代价 | 说明 |
|---|---|
| 服务器 CPU 压力大 | 每个请求都要执行组件渲染，高并发下 CPU 是瓶颈 |
| TTFB 变慢 | 服务器要等数据 fetch 完才能渲染 HTML，首字节时间变长 |
| 开发复杂 | 要写同构代码，注意 window/document 不能在服务端用，数据预取要专门处理 |
| 部署受限 | 要 Node 运行环境，不能丢静态 CDN（除非用 SSG） |
| 缓存策略复杂 | 动态内容难缓存，要按页面/数据维度做缓存 |

**适用判断**：
- 内容型网站（电商、博客、资讯、官网）→ SSR/SSG（重 SEO、重首屏）。
- 后台管理系统、内部工具 → CSR 够用（SEO 无所谓、首屏可接受 loading）。
- 要兼顾 → 用 Next.js 的混合渲染（SSG + SSR + CSR 灵活选）。

**类比**：SSR 像「现点现做的餐厅」（好吃但要等厨房，厨房忙不过来）；CSR 像「快餐店给半成品你自己微波」（厨房轻松但吃得慢）；SSG 像「预制菜」（提前做好囤着，又快又省厨房）。

**🔧 示例 / 代码**

```jsx
// Next.js 数据预取：服务端先拿数据再渲染
export async function getServerSideProps() {
  const res = await fetch("https://api.example.com/products");
  const products = await res.json();
  return { props: { products } }; // 作为 props 传给页面组件
}

// 组件
export default function Page({ products }) {
  return products.map(p => <div key={p.id}>{p.name}</div>);
}
```

```js
// 缓存优化：把渲染结果缓存，减轻服务器压力
const cache = new Map();
async function handler(req, res) {
  const key = req.url;
  if (cache.has(key)) return res.send(cache.get(key));
  const html = await renderApp(req);
  cache.set(key, html);
  res.send(html);
}
```

**🔍 常见追问**

- SSR 的 TTFB 为什么比 CSR 慢？怎么优化？（提示：数据预取并行化、缓存、流式渲染）
- 什么场景下 SSR 反而比 CSR 更慢？（提示：服务器渲染慢 + 数据请求多，没缓存）
- 纯静态内容（公司官网）该用 SSR 还是 SSG？（提示：SSG 构建时生成，更省服务器）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》服务端渲染板块（doc/前端知识体系.md:193-196）+ 模型知识。建议结合 Next.js 官方文档「Rendering」核验。出处：doc/前端知识体系.md:195

---

### 92. 什么是洋葱圈模型？Koa 中间件如何实现请求进、响应出的嵌套执行？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-002`
> 标签：#Koa, #洋葱圈模型, #中间件, #高频

**💡 一句话速记**

洋葱圈是中间件「先进后出」的执行模型：请求从外向内穿过每一层中间件到核心，响应再从内向外穿回去，每层中间件用 `await next()` 把控制权交给下一层，next 之后的代码在响应阶段执行。

**📖 通俗详解**

Express 的中间件是线性的（顺序执行，没有「回来」的概念）；Koa 用 async/await 让中间件形成嵌套结构，看起来像洋葱的横截面——一层包一层。

核心是 `app.use(async (ctx, next) => { ...; await next(); ... })`：
- `next()` 之前的代码：请求阶段执行（从外向内）
- `await next()`：暂停当前中间件，进入下一层
- `next()` 之后的代码：等内层全部执行完，响应阶段执行（从内向外）

执行顺序示意：
```
请求 →  中间件A (next前) → 中间件B (next前) → 中间件C (无next)
响应 ←  中间件A (next后) ← 中间件B (next后) ←
```

**原理**：Koa 用 `koa-compose` 把中间件数组递归串联，本质是 Promise 链。`next()` 返回一个 Promise，resolve 后才继续往下走，所以 `await next()` 能拿到内层结果。

**用途**：响应阶段的代码适合做日志、耗时统计、响应头修改、错误兜底——因为这时已经知道内层有没有抛错。

**🔧 示例 / 代码**

```js
const Koa = require("koa");
const app = new Koa();

// 中间件1
app.use(async (ctx, next) => {
  console.log("1-请求进");
  const start = Date.now();
  await next();               // 交给下一层
  const ms = Date.now() - start;
  console.log("1-响应出，耗时", ms);  // 响应阶段执行
  ctx.set("X-Response-Time", ms + "ms");
});

// 中间件2
app.use(async (ctx, next) => {
  console.log("2-请求进");
  await next();
  console.log("2-响应出");
});

// 核心：真正处理业务
app.use(async (ctx) => {
  console.log("3-处理业务");
  ctx.body = "hello";
});

// 输出顺序：1-请求进 -> 2-请求进 -> 3-处理业务 -> 2-响应出 -> 1-响应出
```

**compose 简化实现**：
```js
function compose(middleware) {
  return function (ctx, next) {
    let index = -1;
    function dispatch(i) {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"));
      index = i;
      let fn = middleware[i];
      if (i === middleware.length) fn = next;
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return dispatch(0);
  };
}
```

**🔍 常见追问**

- 如果某个中间件忘了写 `await next()`，会有什么后果？（提示：响应阶段提前执行、时序错乱）
- Koa 的洋葱圈和 Express 的中间件执行顺序有什么本质区别？
- 如何在洋葱圈里实现统一错误处理？（提示：最外层 try/catch + app.on('error')）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:188 红字标注）+ 模型知识。建议结合 Koa 官方文档「koa-compose」核验。出处：doc/前端知识体系.md:188

---

### 93. Node.js 中 CommonJS 和 ESM 两种模块加载方式有什么区别？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-004`
> 标签：#模块化, #CommonJS, #ESM, #高频

**💡 一句话速记**

CommonJS 用 `require/module.exports`，同步加载、运行时求值、可动态 require、值是拷贝；ESM 用 `import/export`，静态分析（编译期确定依赖）、异步加载、值是实时绑定（live binding），`this` 在顶层是 undefined。

**📖 通俗详解**

两者从语法到运行机制都不同：

| 维度 | CommonJS (CJS) | ES Modules (ESM) |
|---|---|---|
| 语法 | `require()` / `module.exports` | `import` / `export` |
| 加载时机 | 运行时（同步阻塞） | 编译期静态分析 + 运行时异步 |
| 输出值 | 值的拷贝（导出后改了不影响外面） | 值的引用（live binding，源变了同步更新） |
| 是否能动态 | 能 `require(变量)` | 静态 `import` 路径必须是字符串字面量，动态用 `import()` |
| 顶层 this | `module.exports`（对象） | `undefined` |
| 是否提升 | 否，按顺序执行 | `import` 声明会被提升到顶部 |
| 循环引用 | 返回已执行部分的快照，可能拿到空对象 | 用引用避免部分问题，但仍有 TDZ 风险 |

**Node 怎么区分**：看文件后缀和 package.json。
- `.cjs` 或没配 `"type"` → CJS
- `.mjs` 或 `"type": "module"` → ESM

**加载原理**：
- CJS：`require` 内部走 `Module._load`，读文件 → 包成函数 → 执行 → 缓存 `require.cache`。`module.exports` 是函数返回值的出口。
- ESM：Node 用三步走——**Construction（构造）** 解析模块图建立记录 → **Instantiation（实例化）** 建立导入导出的绑定 → **Evaluation（求值）** 执行代码。整个过程异步，所以 ESM 里不能同步 `require`。

**实际选择**：库尽量发布 ESM（支持 tree-shaking），Node 服务看生态，老项目 CJS、新项目可上 ESM。

**类比**：CJS 像「现场点菜现做」（运行时加载，要啥拿啥）；ESM 像「看菜单下单后厨房一次性备齐」（编译期就规划好依赖关系）。

**🔧 示例 / 代码**

```js
// ---- lib.js（CJS）----
let count = 0;
module.exports = {
  count,
  add() { count++; }
};

// main.cjs
const lib = require("./lib");
lib.add();
console.log(lib.count); // 0！导出的是值的拷贝，count 没同步
```

```js
// ---- lib.mjs（ESM）----
export let count = 0;
export function add() { count++; }

// main.mjs
import { count, add } from "./lib.mjs";
add();
console.log(count); // 1！ESM 是 live binding，引用同步更新
```

```json
// package.json —— 让 .js 走 ESM
{ "type": "module" }
```

```js
// 动态 import（两种模块通用）
import("./heavy.mjs").then(mod => mod.run());
```

**🔍 常见追问**

- CJS 中循环引用（A require B、B require A）会怎样？（提示：B 拿到 A 未完成的部分导出）
- ESM 的 tree-shaking 为什么对 CJS 不起作用？（提示：CJS 导出是运行时求值，静态分析不出未用）
- `import()` 动态导入和 `require()` 有什么区别？（提示：异步 vs 同步、返回 Promise）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块「模块化加载的方式和区别」（doc/前端知识体系.md:190）+ 模型知识。建议结合 Node.js 官方文档「ECMAScript Modules」核验。出处：doc/前端知识体系.md:190

---

### 94. Node.js 的 EventEmitter 是同步还是异步？请手写一个简易 EventEmitter（含 on/emit/off/once）。

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-node-005`
> 标签：#EventEmitter, #发布订阅, #手写, #同步异步, #高频

**💡 一句话速记**

EventEmitter 的 `emit` 是**同步**的——它按注册顺序逐个同步调用回调，不是放进事件循环队列。回调本身可以是异步函数，但触发机制是同步遍历。手写核心就是一个 `{ 事件名: [回调数组] }` 的 Map。

**📖 通俗详解**

常见误区：以为「事件」就是异步。其实 EventEmitter 的本质是**发布订阅模式**，`emit` 触发时直接同步 for 循环调用所有 listener，跟 `setTimeout` 那种异步队列没关系。

```js
ee.on("x", () => console.log("a"));
ee.on("x", () => console.log("b"));
console.log("before");
ee.emit("x");        // a, b 同步执行
console.log("after"); // 输出: before a b after
```

如果回调里写了异步代码（如 setTimeout），那部分异步，但「调用 listener 这个动作」是同步的。

**手写要点**：
1. 用对象/Map 存 `事件名 -> 回调数组`。
2. `on` 往数组 push；`emit` 遍历数组调用。
3. `off` 找到索引 splice 删除。
4. `once` 包一层包装函数：调用后自动 off。需要保存原函数引用才能 off，所以用 `fn.raw = callback` 记一下。
5. `emit` 时遍历要用副本（`[...list]`），防止回调里 off 导致数组变化、跳过元素。

**类比**：EventEmitter 像「微信群」，`on` 是拉人进群，`emit` 是发消息——消息一发出，群里所有人**当下同时**收到（同步），不是排队等通知。

**🔧 示例 / 代码**

```js
class MyEventEmitter {
  constructor() {
    this.events = new Map(); // 事件名 -> 回调数组
  }

  on(event, listener) {
    if (!this.events.has(event)) this.events.set(event, []);
    this.events.get(event).push(listener);
    return this;
  }

  emit(event, ...args) {
    const list = this.events.get(event);
    if (!list) return false;
    // 用副本遍历，防止回调里 off 导致数组变动跳过元素
    [...list].forEach(fn => fn.apply(this, args));
    return true;
  }

  off(event, listener) {
    const list = this.events.get(event);
    if (!list) return this;
    this.events.set(event, list.filter(fn => fn !== listener && fn.raw !== listener));
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      listener.apply(this, args);
      this.off(event, listener); // 用原 listener，wrapper.raw 已记录
    };
    wrapper.raw = listener; // 保留原引用，方便 off(原函数) 也能删掉
    this.on(event, wrapper);
    return this;
  }
}

// 验证
const ee = new MyEventEmitter();
ee.on("data", x => console.log("a", x));
ee.on("data", x => console.log("b", x));
ee.once("data", x => console.log("once", x));
console.log("before");
ee.emit("data", 1); // before -> a 1 -> b 1 -> once 1
console.log("after");
ee.emit("data", 2); // a 2 -> b 2（once 已删除）
```

```js
// Node 内置 EventEmitter 用法
const { EventEmitter } = require("events");
const ee = new EventEmitter();
ee.on("tick", count => console.log("收到", count));
ee.emit("tick", 1); // 同步触发
```

**🔍 常见追问**

- 如果一个 listener 里抛错，后续 listener 还会执行吗？（提示：Node 默认会抛出，用 `ee.emit('error')` 走 error 事件）
- 如何在 `emit` 遍历时安全移除监听器而不跳过元素？（提示：遍历副本）
- EventEmitter 和 Promise/async 在处理异步流程时各有什么取舍？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:191 红字标注）+ 模型知识。建议结合 Node.js 官方文档「Events」核验。出处：doc/前端知识体系.md:191

---

### 95. Node.js 的 Stream（流）是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-007`
> 标签：#Stream, #流, #Node.js, #高频

**💡 一句话速记**

Stream 是「分块处理数据」的抽象，数据像水流一样一段段过来，边到边处理，不必把整个数据加载进内存。分 4 种：Readable（可读）、Writable（可写）、Duplex（双工）、Transform（转换）。

**📖 通俗详解**

**4 种流**：
| 类型 | 含义 | 例子 |
|---|---|---|
| Readable | 只能读（产生数据） | fs.createReadStream、HTTP 请求体 |
| Writable | 只能写（消费数据） | fs.createWriteStream、HTTP 响应 |
| Duplex | 可读可写，两端独立 | TCP socket（收发独立） |
| Transform | 可读可写，写进去经变换再读出 | zlib（压缩）、加密 |

**两种模式**（Readable）：
- **流动模式（flowing）**：有数据就主动推给监听器（`data` 事件）。
- **暂停模式（paused）**：要主动 `read()` 才取数据，用 `pipe` 或 `on('data')` 切到流动模式。

**背压（backpressure）**：写得太慢、读得太快，数据堆积内存爆。用 `pipe()` 自动处理背压（读快了就暂停），手动要监听 `drain` 事件。

**核心 API**：
- `stream.pipe(dest)`：把可读流接到可写流，自动处理背压。
- 事件：`data`（来数据）、`end`（读完）、`error`、`drain`（可继续写）。

**类比**：一次性读像「用大桶接水，等水满才用」；流像「用水管边接边用」，水池（内存）永远不溢。

**🔧 示例 / 代码**

```js
const fs = require("fs");
const zlib = require("zlib");

// 1. pipe 链式：文件读取 -> gzip 压缩 -> 写文件（全程内存恒定）
fs.createReadStream("big.log")
  .pipe(zlib.createGzip())           // Transform 流
  .pipe(fs.createWriteStream("big.log.gz"))
  .on("finish", () => console.log("done"));

// 2. 手动监听 data/end（注意不自动背压）
const rs = fs.createReadStream("a.txt", { highWaterMark: 64 * 1024 });
let chunks = [];
rs.on("data", chunk => {
  chunks.push(chunk);
  console.log("收到", chunk.length, "字节");
});
rs.on("end", () => {
  const all = Buffer.concat(chunks);
  console.log("总计", all.length);
});
rs.on("error", err => console.error(err));

// 3. HTTP 响应本身就是 Writable 流，可直接 pipe
const http = require("http");
http.createServer((req, res) => {
  fs.createReadStream("video.mp4").pipe(res); // 边读边发，省内存
});
```

**🔍 常见追问**

- `pipe` 是如何处理背压的？手动 `on('data')` 会有什么问题？（提示：不背压，要用 pause/resume 或 pipeline）
- Duplex 和 Transform 流的区别是什么？各自典型场景？
- 为什么推荐用 `stream.pipeline` 替代 `pipe`？（提示：错误处理 + 资源清理）

---

**▶ 追问 1：为什么处理大文件/网络数据要用流而不是一次性读取？**

**💡 一句话速记**

一次性读取（如 `fs.readFile`）会把整个文件占满内存；用流每次只读一小块（默认 64KB highWaterMark），处理完即释放，内存占用恒定，且可以边到边处理。

**📖 通俗详解**

如果用 `fs.readFile` 读一个 5GB 文件，整个文件会先占满内存再处理；用流则每次只读一小块（默认 64KB highWaterMark），处理完这块就释放，内存占用恒定。

对于网络数据同理：流式响应可以边读边发送（如视频流），不必等整个文件读完才响应，首字节时间（TTFB）更短，体验更好。

**🔧 示例 / 代码**

```js
// HTTP 响应本身就是 Writable 流，可直接 pipe 边读边发
const http = require("http");
const fs = require("fs");
http.createServer((req, res) => {
  fs.createReadStream("video.mp4").pipe(res); // 边读边发，省内存
});
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》nodeJS 板块（doc/前端知识体系.md:186-192，buffer 衍生考点）+ 模型知识。建议结合 Node.js 官方文档「Stream」核验。出处：doc/前端知识体系.md:191-192

---

### 96. 现代框架（Next.js/Nuxt）有哪几种渲染模式？它们各是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-node-010`
> 标签：#SSR, #SSG, #ISR, #Next.js, #Nuxt, #渲染模式

**💡 一句话速记**

主要有 4 种：CSR（客户端渲染）、SSR（请求时服务端渲染）、SSG（构建时生成静态 HTML）、ISR（增量静态再生成，定时更新静态页）。Next.js/Nuxt 都支持按页面混用。

**📖 通俗详解**

| 模式 | 何时生成 HTML | 特点 | 适用 |
|---|---|---|---|
| **CSR** | 浏览器（运行时） | 首屏慢、SEO 差、服务器零压力 | 后台系统、强交互应用 |
| **SSR** | 每次请求时（服务器实时） | 首屏快、SEO 好、服务器压力大、内容实时 | 电商详情页、个性化内容、动态数据 |
| **SSG** | 构建时一次性生成 | 首屏最快、SEO 好、可全 CDN、内容固定 | 博客、文档、官网、营销页 |
| **ISR** | 构建+按需定时重新生成 | 兼具 SSG 的快和内容的更新 | 大量页面、内容偶尔变化的站点（如博客、商品列表） |

**Next.js 对应 API**：
- SSG：默认（静态导出）或 `getStaticProps` + `getStaticPaths`
- SSR：`getServerSideProps`
- ISR：`getStaticProps` 加 `revalidate: 60`（60 秒后台重新生成）
- CSR：组件内 `useEffect` + fetch / `"use client"`
- App Router 还有 Streaming SSR（React Suspense 流式渲染）。

**Nuxt 对应**：`nuxt generate`（SSG）、`server routes`（SSR）、`routeRules` 里按路由配 ISR/SSR/SSG。

**🔧 示例 / 代码**

```jsx
// Next.js Pages Router —— SSG
export async function getStaticProps() {
  const posts = await getAllPosts();
  return { props: { posts } };
}

// Next.js —— ISR：60 秒后台重新生成
export async function getStaticProps() {
  return {
    props: { products },
    revalidate: 60  // 用户访问时若超过 60s，先返回旧的，后台重新生成
  };
}

// Next.js —— SSR：每次请求都重新渲染
export async function getServerSideProps(context) {
  const user = await getUser(context.req);  // 个性化数据
  return { props: { user } };
}

// Next.js App Router —— 路由段配置
export const dynamic = "force-dynamic"; // 强制 SSR
export const revalidate = 60;            // ISR
export const dynamicParams = true;
```

**🔍 常见追问**

- ISR 的 `revalidate` 是如何做到「先返回旧的、后台生成新的」？（提示：stale-while-revalidate 策略）
- Next.js 的 React Server Component（RSC）和传统 SSR 有什么区别？（提示：RSC 是组件级、零 JS 下发）

---

**▶ 追问 1：如何选择渲染模式（CSR/SSR/SSG/ISR）？**

**💡 一句话速记**

按「内容更新频率」和「SEO/性能需求」选：内容基本不变→SSG；实时/千人千面→SSR；海量页面偶尔更新→ISR；不要 SEO 重交互→CSR；现代项目常用「混合」模式按页面混用。

**📖 通俗详解**

**选择思路**：
1. 内容基本不变 → SSG（最快最省）。
2. 内容实时、千人千面 → SSR。
3. 海量页面 + 偶尔更新 → ISR（不用每次构建全站）。
4. 不要 SEO、重交互 → CSR。
5. 现代项目常用「混合」：首页 SSG、详情页 SSR/ISR、后台 CSR。

**类比**：SSG 像「出书」（一次性印好，快但内容定死）；SSR 像「现场直播」（实时但贵）；ISR 像「杂志」（定期更新重印）；CSR 像「游戏机」（给你机器自己玩）。

**🔧 示例 / 代码**

```ts
// Nuxt 3 —— routeRules 混合配置
export default defineNuxtConfig({
  routeRules: {
    "/": { prerender: true },           // SSG
    "/blog/**": { isr: 60 },            // ISR 60s
    "/dashboard/**": { ssr: false },     // CSR
    "/product/**": { swr: 300 }         // SSR + stale-while-revalidate 缓存
  }
});
```

**🔍 常见追问**

- SSG 适合内容会变的网站吗？怎么解决？（提示：重新构建部署，或改用 ISR）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》服务端渲染板块（doc/前端知识体系.md:193-196「有几种模式」）+ 模型知识。建议结合 Next.js 官方文档「Rendering Fundamentals」和 Nuxt 文档「Rendering Modes」核验。出处：doc/前端知识体系.md:196

---

## react

### 97. 项目中常用的 React Hook 有哪些？各自的使用场景和注意事项是什么？

> ⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-006`
> 标签：#hooks, #useState, #useEffect, #useRef, #useMemo, #useCallback, #useContext

**💡 一句话速记**

常用 Hook：`useState`(状态)、`useEffect`(副作用)、`useRef`(可变值/DOM引用)、`useMemo`(缓存计算结果)、`useCallback`(缓存函数引用)、`useContext`(跨层传值)、`useReducer`(复杂状态)。核心原则：按需用，别过度 memo。

**📖 通俗详解**

| Hook | 用途 | 关键注意 |
|---|---|---|
| useState | 基础状态 | setState 是异步批处理；函数式更新 `setX(prev => prev+1)` 避免闭包旧值 |
| useEffect | 副作用（请求、订阅、定时器） | 依赖数组必须写全；清理函数 return；空数组只跑一次 |
| useRef | 存可变值不触发重渲染 / 获取 DOM | 改 `.current` 不重渲染；不要在渲染中读写 |
| useMemo | 缓存昂贵计算结果 | 别滥用，缓存本身有开销；依赖变化才重算 |
| useCallback | 缓存函数引用（传给子组件防重渲染） | 配合 React.memo 才有意义 |
| useContext | 消费 Context，跨层共享 | Context 值变化会让所有消费者重渲染 |
| useReducer | 复杂状态（多字段联动） | 替代多个 useState，逻辑集中 |

**常见坑**：
1. useEffect 忘记写依赖 → 闭包捕获旧值，看到「数据没更新」。
2. useMemo/useCallback 滥用 → 每次都要比较依赖，比直接新建还慢。
3. useRef 当 state 用 → 改了不重渲染，UI 不更新。
4. useState 直接存对象还整体替换 → 用函数式更新或拆分 state。

**🔧 示例 / 代码**

```jsx
import { useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer } from 'react';

function Demo({ userId }) {
  // 1. useState
  const [name, setName] = useState('');

  // 2. useEffect（依赖写全 + 清理）
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/user/${userId}`, { signal: ctrl.signal })
      .then(r => r.json()).then(d => setName(d.name));
    return () => ctrl.abort(); // 清理：取消未完成请求，防竞态
  }, [userId]);

  // 3. useRef：拿 DOM + 存不触发渲染的值
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // 4. useMemo：缓存昂贵计算
  const sorted = useMemo(() => heavySort(bigList), [bigList]);

  // 5. useCallback：缓存传给 memo 子组件的函数
  const handleClick = useCallback(() => console.log(userId), [userId]);

  // 6. useContext
  const theme = useContext(ThemeContext);

  // 7. useReducer：复杂状态
  const [form, dispatch] = useReducer((s, a) => {
    if (a.type === 'set_name') return { ...s, name: a.value };
    return s;
  }, { name: '', age: 0 });

  return <MemoChild onClick={handleClick} />;
}
```

**🔍 常见追问**

- useMemo 和 useCallback 的关系？（提示：useCallback(fn, dep) === useMemo(() => fn, dep)）
- useEffect 的依赖数组写错会有什么后果？
- 什么时候该用 useReducer 而不是 useState？（提示：状态多、转换逻辑复杂、下一个状态依赖前一个）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「项目中使用了哪些hook」）+ 模型知识。建议结合 React 官方文档「Hooks API Reference」核验。出处：doc/前端知识体系.md:146

---

### 98. `useEffect` 和 `useLayoutEffect` 有什么区别？分别在什么场景下使用？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-001`
> 标签：#useEffect, #useLayoutEffect, #hooks, #高频

**💡 一句话速记**

`useEffect` 在浏览器**绘制之后**异步执行（不阻塞页面）；`useLayoutEffect` 在 DOM 变更后、绘制前**同步**执行（阻塞绘制）。绝大多数副作用用 useEffect，只有会引起「视觉闪烁」的 DOM 测量/布局操作才用 useLayoutEffect。

**📖 通俗详解**

**执行时机对比**（一次渲染的生命周期）：
```
state 变化 → React 计算 VDOM → 提交到真实 DOM
         → useLayoutEffect 同步执行（此时还没绘制，可读 DOM 尺寸）
         → 浏览器绘制画面
         → useEffect 异步执行（用户已经看到画面了）
```

**为什么需要两种**？
- useEffect 异步：避免副作用阻塞渲染，性能好。但问题是用户可能先看到「错误的状态」再看到「修正后的状态」（闪烁）。比如要根据 DOM 宽度计算 tooltip 位置，useEffect 执行时画面已绘制，用户会看到 tooltip 先在 (0,0) 再跳到正确位置。
- useLayoutEffect 同步：在绘制前读完 DOM、算好布局再让浏览器一次性绘制，避免闪烁。代价是会阻塞绘制，用多了会卡。

**类比**：useEffect 像「拍完照后再修图」（异步，用户先看到原图）；useLayoutEffect 像「拍照前就把构图对好」（同步，用户直接看到成品）。

**SSR 注意**：服务端渲染时两者都不执行，但 useLayoutEffect 会报警告。可用 `typeof window === 'undefined' ? () => {} : useLayoutEffect` 封装 useIsomorphicLayoutEffect。

**🔧 示例 / 代码**

```jsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// 场景1：副作用不涉及布局 → useEffect
function App() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api').then(r => r.json()).then(setData); // 异步请求，不阻塞绘制
  }, []);
  return <div>{data ? 'loaded' : 'loading...'}</div>;
}

// 场景2：需要测 DOM 防止闪烁 → useLayoutEffect
function Tooltip({ children }) {
  const ref = useRef();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    // 在浏览器绘制前读取尺寸并定位，用户不会看到位置跳变
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({ x: width / 2, y: height });
  }, [children]);
  return <div ref={ref} style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>{children}</div>;
}
```

**🔍 常见追问**

- useEffect 的清除函数（return）在什么时机执行？（提示：下次 effect 执行前 + 组件卸载时）
- useLayoutEffect 里调用 setState 会怎样？（提示：会在浏览器绘制前再触发一次同步渲染）
- 如何在 SSR 中安全使用 useLayoutEffect而不报警告？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块 + 模型知识。建议结合 React 官方文档「useEffect」「useLayoutEffect」核验。出处：doc/前端知识体系.md:140

---

### 99. React Hook 相比 Class 组件有哪些优势？为什么 React 团队要推 Hook？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-003`
> 标签：#hooks, #class, #优势, #高频

**💡 一句话速记**

Hook 解决了 Class 的三大痛点：①**逻辑复用难**（HOC/渲染 props 嵌套地狱）→ 自定义 Hook 直接复用；②**生命周期拆散相关逻辑**（同一逻辑分散在 didMount/didUpdate/willUnmount）→ useEffect 聚合；③**this 指向和绑定心智负担重**。Hook 让函数组件也能有 state 和副作用，代码更简洁。

**📖 通俗详解**

**Class 组件的三大痛点**：
1. **逻辑复用难**：早期复用状态逻辑只能靠 HOC（高阶组件）或 render props，结果是组件树层层嵌套（「wrapper hell」），调试时 React DevTools 里一长串匿名组件。
2. **生命周期割裂相关逻辑**：比如「订阅 + 取消订阅」要拆到 `componentDidMount` 和 `componentWillUnmount`，而「订阅依赖 id 变化时重新订阅」又要加 `componentDidUpdate` 比较 props——一个完整逻辑被切到三个地方，难维护。
3. **this 麻烦**：事件处理函数要手动 `bind(this)` 或用箭头函数，初学者经常踩 `this is undefined` 的坑。

**Hook 的优势**：
1. **自定义 Hook 复用逻辑**：`useWindowSize()`、`useFetch()` 等自定义 Hook，调用处就是普通函数，DevTools 清晰，无嵌套。
2. **相关逻辑聚合**：`useEffect(() => { subscribe(); return () => unsubscribe(); }, [id])`，订阅、依赖、清理写在一起。
3. **无 this**：函数组件天然没有 this 绑定问题。
4. **更易做静态分析和 tree-shaking**。

**类比**：Class 像把「一个功能拆到三个抽屉」，Hook 像把「一个功能打包成一个工具箱」，要用直接拿。

**代价/限制**：Hook 不能在条件/循环里调用（依赖调用顺序，详见 Hook 实现原理题）；Class 的一些边界场景（error boundary）目前仍需 Class（React 19 前）。

**🔧 示例 / 代码**

```jsx
// ❌ Class：逻辑被生命周期拆散
class Profile extends React.Component {
  componentDidMount() { this.subscribe(this.props.id); }
  componentDidUpdate(prev) { if (prev.id !== this.props.id) { this.unsubscribe(prev.id); this.subscribe(this.props.id); } }
  componentWillUnmount() { this.unsubscribe(this.props.id); }
  subscribe(id) { /* ... */ }
  unsubscribe(id) { /* ... */ }
  render() { return <div>{this.state.data}</div>; }
}

// ✅ Hook：同一逻辑聚合在 useEffect
function Profile({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const unsub = subscribe(id, setData); // 订阅
    return () => unsub();                 // 清理（卸载或 id 变化时）
  }, [id]);                               // 依赖变化自动重订阅
  return <div>{data}</div>;
}

// ✅ 自定义 Hook 复用逻辑（无需 HOC）
function useWindowSize() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ w: innerWidth, h: innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}
// 任何组件直接用：const { w } = useWindowSize();
```

**🔍 常见追问**

- 为什么自定义 Hook 能复用，但 state 不会互相干扰？（提示：每个组件独立 fiber，独立 hook 链表）
- Hook 能完全替代 Class 吗？哪些场景还必须用 Class？（提示：React 19 前 error boundary）
- 为什么 Hook 不能在 if 里调用？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「hook的优势」）+ 模型知识。建议结合 React 官方文档「Hooks 简介」「动机」核验。出处：doc/前端知识体系.md:143

---

### 100. `useRef` 有哪些使用场景？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-010`
> 标签：#useRef, #DOM, #可变值, #高频

**💡 一句话速记**

`useRef` 两大用途：①**获取 DOM 元素引用**（focus、测量尺寸、播放媒体）；②**存放不触发重渲染的可变值**（定时器 id、上次值、缓存）。它返回一个 `{ current: 初始值 }` 对象，整个组件生命周期里引用稳定，改 `.current` 不触发重渲染。

**📖 通俗详解**

**useRef 返回什么**：一个 `{ current: 初始值 }` 对象，整个组件生命周期里**始终是同一个对象**（引用稳定），改 `.current` 不会触发重渲染。

**两大场景**：
1. **访问 DOM**：`<input ref={inputRef}>`，React 在挂载后把 DOM 节点赋给 `inputRef.current`，可以调用 `focus()`、读 `getBoundingClientRect()`、控制 `<video>` 等。
2. **存可变值但不影响渲染**：比如定时器 id、上一次的 props/state（用于比较）、计数器（不想因为计数重渲染）。这类值如果用 useState 会导致不必要的重渲染。

**重要注意**：
1. **不要在渲染阶段读写 ref.current**（应该只在事件处理、effect 里写）。渲染期写会导致不一致。
2. **ref 改变不触发重渲染**，所以「用 ref 存要显示的值」是错的（UI 不更新）——要显示的数据用 useState（见追问对比）。
3. **避免把 ref 当成「避免重渲染的万能缓存」**——能用 useMemo/useState 解决的就别用 ref。

**类比**：useRef 像「口袋」（随手放/取，不影响账本画面）。

**🔧 示例 / 代码**

```jsx
import { useRef, useState, useEffect } from 'react';

// 场景1：获取 DOM，自动聚焦
function AutoFocusInput() {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current.focus(); // 挂载后自动聚焦
  }, []);
  return <input ref={inputRef} />;
}

// 场景2：存定时器 id，卸载时清理
function Timer() {
  const timerRef = useRef(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    timerRef.current = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(timerRef.current); // timerRef 在卸载时仍可用
  }, []);
  return <div>{count}</div>;
}

// 场景3：保存「上一次的值」（usePrevious）
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }); // 每次渲染后更新（不能在渲染期写）
  return ref.current;
}

// forwardRef：把 ref 透传给子组件的 DOM（React 19 可直接传 ref prop）
const FancyInput = React.forwardRef((props, ref) => (
  <input ref={ref} className="fancy" />
));
```

**🔍 常见追问**

- 为什么 useRef 改了不重渲染？底层 ref 对象存在哪？（提示：存在 fiber 的 hook 链表，不触发 scheduleUpdate）
- useEffect 里读写 ref 安全吗？useLayoutEffect 呢？
- React 19 里 ref 作为 prop 传递，forwardRef 还需要吗？

---

**▶ 追问 1：它和 `useState` 有什么区别？**

**💡 一句话速记**

核心区别：修改 `ref.current` **不会触发重渲染**，而 `setState` 会。useState 用来存「驱动 UI 的状态」，useRef 用来存「不驱动 UI 的辅助数据」（DOM 引用、定时器 id、上次值）。

**📖 通俗详解**

**和 useState 的区别**：
| 维度 | useState | useRef |
|---|---|---|
| 改变后是否重渲染 | 是 | 否 |
| 用途 | 驱动 UI 的状态 | 不驱动 UI 的辅助数据 |
| 更新方式 | setX(新值) | x.current = 新值 |
| 渲染期可读可写 | 只读（闭包值） | 读写都行（但避免渲染期写） |

**怎么选**：要显示在 UI 上、变了要刷新画面的值用 useState；只是辅助逻辑要用、变了不需要重新渲染的值用 useRef。

**🔧 示例 / 代码**

```jsx
// ❌ 错误：用 ref 存要显示的数据（UI 不更新）
function Bad() {
  const data = useRef(null);
  // 点击后 data.current 变了，但 UI 不会重渲染，看不到变化
  return <button onClick={() => { data.current = 'new'; }}>show</button>;
}

// ✅ 正确：要显示的数据用 useState
function Good() {
  const [data, setData] = useState(null);
  return <button onClick={() => setData('new')}>{data}</button>;
}
```

**类比**：useState 像「记账本」（改了要重新核对、刷新画面）；useRef 像「口袋」（随手放/取，不影响账本画面）。

**🔍 常见追问**

- 为什么 useRef 改了不触发重渲染，而 useState 会？（提示：ref 改值不调 scheduleUpdate）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「useRef的使用」）+ 模型知识。建议结合 React 官方文档「useRef」核验。出处：doc/前端知识体系.md:151

---

### 101. React Router 的原理是什么？`history` 模式和 `hash` 模式有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-011`
> 标签：#react-router, #history, #hash, #路由, #高频

**💡 一句话速记**

React Router 监听 URL 变化→匹配路由→渲染组件，全程不刷新页面。hash 模式靠 `hashchange` 事件、URL 带 # 但无需后端配置；history 模式靠 `pushState/popstate`、URL 干净但刷新需后端回退到 index.html。

**📖 通俗详解**

**前端路由的本质**：监听 URL 变化 → 改变视图，不向服务器发请求。

**两种实现模式**：
1. **Hash 模式**：URL 形如 `http://site/#/home`。
   - 原理：`#` 后面的部分叫 hash，改变 hash **不会触发请求**，但会触发 `hashchange` 事件。Router 监听该事件，匹配路由渲染组件。
   - 优点：无需后端配置，兼容性好（IE8+）。
   - 缺点：URL 丑（带 #），SEO 不友好，不能利用锚点定位。
2. **History 模式**（HTML5）：URL 形如 `http://site/home`。
   - 原理：用 `history.pushState(state, title, url)` 改 URL 但不刷新页面，`popstate` 事件监听浏览器前进/后退。Router 自己包装了 push/replace/go，触发后重新匹配。
   - 优点：URL 干净、SEO 友好。
   - 缺点：用户刷新或直接访问 `/home` 时，浏览器会向服务器请求该路径，**服务器必须配置回退到 index.html**（否则 404）。

**React Router 实现要点**：
- `<BrowserRouter>` 用 History API；`<HashRouter>` 用 hash。
- 内部维护一个 `history` 对象（listen/push/replace），`<Route>` 根据 `location.pathname` 匹配渲染。
- `<Link>` 点击时调 `history.push`，阻止默认 a 标签跳转，只改 URL + 通知 Router。

**🔧 示例 / 代码**

```jsx
// 极简手写 hash router 原理
function MiniHashRouter() {
  const [path, setPath] = useState(location.hash.slice(1) || '/');
  useEffect(() => {
    const onHash = () => setPath(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return path === '/about' ? <About/> : <Home/>;
}

// history 模式后端配置（nginx）
// location / { try_files $uri $uri/ /index.html; }
```

**🔍 常见追问**

- history 模式刷新 404 怎么解决？后端怎么配？
- React Router v6 相比 v5 有哪些变化？
- 如何实现路由懒加载？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「react router的原理」「如何实现页面切换的动画」）+ 模型知识。建议结合 React Router 官方文档核验。出处：doc/前端知识体系.md:152-153

---

### 102. React Context 的使用场景是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-013`
> 标签：#context, #跨层传值, #性能, #高频

**💡 一句话速记**

Context 用于**跨多层组件共享数据**（主题、用户信息、国际化、路由），免去逐层 prop 透传（prop drilling）。

**📖 通俗详解**

**什么时候用 Context**：
- 全局/半全局数据：主题（dark/light）、当前用户、i18n 语言包、路由状态、UI 配置。
- 数据变化频率不高、消费组件不多。

**什么时候不该用**：
- 高频变化的状态（如鼠标位置、拖拽坐标）——会导致大量组件重渲染。
- 复杂的状态管理（多模块、需要 selector/派生）——用 Zustand/Redux 更合适。

**prop drilling 的问题**：把 user 从 App 传到深层 Profile，中间 5 层组件都要接收并转发 user prop，即使它们不用 user。Context 让深层组件直接 `useContext`。

**🔧 示例 / 代码**

```jsx
import { createContext, useContext, useState } from 'react';

// 基础用法：跨层传值
const UserContext = createContext(null);
function App() {
  const [user, setUser] = useState({ name: 'Lee' });
  return (
    <UserContext.Provider value={user}>
      <DeepTree />
    </UserContext.Provider>
  );
}
function DeepTree() {
  return <Profile />; // 中间层不用透传 user
}
function Profile() {
  const user = useContext(UserContext); // 直接拿
  return <div>{user.name}</div>;
}
```

**🔍 常见追问**

- Context 和 Redux/Zustand 的本质区别？（提示：Context 是依赖注入机制，不是状态管理库）

---

**▶ 追问 1：Context 有哪些性能陷阱？**

**💡 一句话速记**

**Context 值变化会让所有消费它的组件重渲染**，即使它们只用了 value 的一部分；且 React.memo 拦不住，因为 context 变化绕过 props 比较。

**📖 通俗详解**

**性能陷阱**：
```jsx
const Ctx = createContext({ user: {}, theme: '' });
// Provider 给 value={{ user, theme }}，每次 value 是新对象
// → user 或 theme 任一变化，所有 useContext(Ctx) 的组件全部重渲染
// → 即使某组件只用 theme，user 变了它也重渲染
```
原因：useContext 不做依赖追踪，Context value 引用变化就触发所有消费者重渲染（且 React.memo 拦不住，因为 context 变化绕过 props 比较）。

**类比**：Context 像「公司大喇叭广播」——只要喇叭一响（value 变），所有听广播的人都得停下手里的活（重渲染），哪怕广播的内容跟他无关。

**🔧 示例 / 代码**

```jsx
// ❌ 性能陷阱：value 是新对象 + 多字段
const AppCtx = createContext();
function BadProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  return (
    <AppCtx.Provider value={{ user, theme, setUser, setTheme }}>
      {/* user 或 theme 任一变 → 所有消费者全重渲染 */}
      {children}
    </AppCtx.Provider>
  );
}
```

**🔍 常见追问**

- React.memo 能阻止 Context 变化导致的重渲染吗？（提示：不能，context 变化绕过 props 比较）

---

**▶ 追问 2：如何优化 Context 的性能？**

**💡 一句话速记**

主要手段：拆分 Context（各自变化只影响各自消费者）、value 用 useMemo 包裹避免新引用、selector 模式（use-context-selector）、复杂场景直接换 Zustand 做精准订阅。

**📖 通俗详解**

**优化方案**：
1. **拆分 Context**：把 user 和 theme 分到两个 Context，各自变化只影响各自消费者。
2. **value 用 useMemo 包裹**：避免每次渲染都生成新引用。
3. **selector 模式**：用 `use-context-selector` 库，让消费者只订阅部分字段。
4. **复杂场景换 Zustand**：天然支持 selector + 精准订阅，性能更好。

**🔧 示例 / 代码**

```jsx
import { createContext, useContext, useMemo, useState } from 'react';

// ✅ 优化1：拆分 Context
const UserCtx = createContext();
const ThemeCtx = createContext();
function GoodProvider({ children }) {
  return (
    <UserCtx.Provider value={user}><ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider></UserCtx.Provider>
  );
}

// ✅ 优化2：value 用 useMemo
function StableProvider({ children }) {
  const [user, setUser] = useState(null);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return <UserCtx.Provider value={value}>{children}</UserCtx.Provider>;
}

// ✅ 优化3：复杂场景直接用 Zustand（精准订阅）
import { create } from 'zustand';
const useStore = create((set) => ({ user: null, theme: 'light', setUser, setTheme }));
// 组件只订阅需要的字段，其他字段变化不触发重渲染
function Name() {
  const name = useStore(s => s.user?.name); // 只订阅 user.name
  return <div>{name}</div>;
}
```

**🔍 常见追问**

- use-context-selector 库是怎么实现精准订阅的？（提示：用 useSyncExternalStore + selector）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「context的使用场景」）+ 模型知识。建议结合 React 官方文档「Context」核验。出处：doc/前端知识体系.md:155

---

### 103. React 列表渲染时 `key` 的作用是什么？默认行为是什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-015`
> 标签：#key, #diff, #列表, #性能, #高频

**💡 一句话速记**

`key` 是 React diff 列表时识别元素身份的标识——帮助 React 判断「这个节点是移动了还是新建了」，从而复用 DOM、减少重渲染。没写 key 默认用数组 index 匹配，遇到列表增删会导致后续元素错位重渲染。key 必须稳定、唯一。

**📖 通俗详解**

**key 的作用**：在 reconcile 阶段，React 对比新旧 children 列表时，靠 key 把新列表的元素和旧列表的元素对应起来。有 key 才能判断「A 元素从位置 3 移到了位置 0」，于是只移动 DOM 节点而不是销毁重建。

**默认行为**：不传 key 时，React 用数组索引（index）作为 key。这等价于「按位置匹配」，列表尾部追加没问题，但中间插入/删除/排序就会出问题。

**正确做法**：用数据的**业务唯一 id**（如 `item.id`）作为 key。

**什么时候用 index 反而 OK**：列表纯展示、永不变动顺序、不增删、无受控 state、项内组件无副作用——此时 index 不会引发上述问题。但生产环境仍建议用稳定 id。

**类比**：key 像快递单号——有单号才能跟踪「这个包裹到哪了」（移动），没单号只看「架子上第几个」（位置），包裹一挪位置就乱套。

**🔧 示例 / 代码**

```jsx
// ✅ 用业务 id 做 key
function GoodList({ items }) {
  return items.map(item => (
    <li key={item.id}><input /> {item.name}</li>
  ));
  // 删除 B 后：React 知道 id=2 的节点要卸载，id=1 和 id=3 复用，只删一个 DOM
}

// ❌ 反例：key 不能用随机数（每次渲染都变，等于每次都重建）
items.map(item => <li key={Math.random()}>{item.name}</li>);
// 每次渲染 key 都变 → React 认为全是新节点 → 全部卸载重建，性能极差

// ✅ key 不需要全局唯一，只需「兄弟节点间唯一」
// 下面两组 key 都是 1/2/3 也没关系，因为它们不在同一个兄弟列表
function App() {
  return (
    <ul>{posts.map(p => <li key={p.id}>{p.title}</li>)}</ul>
    <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>
  );
}
```

**🔍 常见追问**

- 用 Math.random() 做 key 会怎样？为什么？（提示：每次渲染 key 变 → 全部重建）
- key 必须全局唯一吗？（提示：不需要，只需兄弟节点间唯一）
- 删除列表中间一项，有 key 和无 key 分别发生什么？（提示：有 key 只删一个 DOM，无 key 全部重渲染）

---

**▶ 追问 1：用 index 做 key 会有什么问题？**

**💡 一句话速记**

用 index 做 key 会导致性能差（中间增删引发后续全部重渲染）、state 错乱（受控组件 state 跟着 fiber 节点走，身份错位后输入框内容串到错误的项上）、动画/过渡失效。

**📖 通俗详解**

**用 index 做 key 的危害**：
1. **性能差**：列表头部插入一项，React 误认为「位置 0 的内容从 A 变成了新项、位置 1 从 B 变成了 A…」，导致所有后续元素都重渲染（实际只需插入一项）。
2. **state 错乱**：受控组件（输入框）的 state 跟着 fiber 节点走，节点身份错位后，输入框内容会串到错误的项上。
3. **动画/过渡失效**：很多动画库靠 key 识别元素身份，key 用 index 会让动画对应错乱。

**🔧 示例 / 代码**

```jsx
// ❌ 用 index 做 key：删除中间项导致错乱
function BadList({ items }) {
  // items = [{id:1,name:'A'}, {id:2,name:'B'}, {id:3,name:'C'}]
  // 删除 B 后变 [A, C]：
  // React 按 index 判断：位置0原来是 A 还是 A（复用）、位置1从 B 变成 C（重渲染）、位置2的 C 没了（卸载）
  // → 输入框里 B 的内容会串到 C 上（state 错乱）
  return items.map((item, index) => (
    <li key={index}><input /> {item.name}</li>
  ));
}
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「key的默认值，默认行为」）+ 模型知识。建议结合 React 官方文档「Lists and Keys」核验。出处：doc/前端知识体系.md:158

---

### 104. React 19 有哪些重要新特性？项目中如何使用？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-002`
> 标签：#react19, #新特性, #actions, #use, #compiler

**💡 一句话速记**

React 19 三大类特性：①**Actions**（`useTransition` + 异步表单，自动处理 pending/error）；②新 hooks（`use`、`useActionState`、`useFormStatus`、`useOptimistic`、`use`）；③编译器（React Compiler 自动 memo，不用手写 useMemo/useCallback）；外加 ref 作为 prop、Document Metadata、Server Components 稳定。

**📖 通俗详解**

**1. Actions（异步动作）**：把异步操作（提交表单、请求接口）用 `useTransition` 包裹，自动给 pending 状态、错误处理、乐观更新。

**2. 新 Hook 全家桶**：
- `useActionState(action, initial)`：管理表单/异步动作的 state（返回 [state, formAction, isPending]）。
- `useFormStatus()`：在子组件里读父级 `<form>` 的 pending 状态（无需 prop 透传）。
- `useOptimistic(state, reducer)`：乐观更新，请求发出后先展示「假设成功」的状态，失败再回滚。
- `use(promise/context)`：能在条件/循环里读取 Promise 或 Context，配合 Suspense 实现更细粒度异步。

**3. React Compiler**：编译时自动插入 memoization，告别手写 useMemo/useCallback/useMemo。开启后大部分场景不需要手动优化。

**4. 其他**：`<Context>` 可直接当 Provider（不用 `Context.Provider`）；`ref` 可作为普通 prop 传递（不再需要 forwardRef）；`<title>`、`<meta>` 可直接写在组件里自动提升到 `<head>`。

**类比**：React 19 像把「手动挡」变「自动挡」——以前要自己 memo、自己管 pending、自己包 Provider，现在编译器和 hooks 都替你干了。

**🔧 示例 / 代码**

```jsx
import { useActionState, useOptimistic } from 'react';

// Actions：异步提交表单，自动给 pending 和错误
async function addTodo(prevState, formData) {
  const text = formData.get('text');
  try {
    await api.create(text);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function TodoForm() {
  const [state, formAction, isPending] = useActionState(addTodo, { ok: false });
  return (
    <form action={formAction}>
      <input name="text" />
      <button disabled={isPending}>{isPending ? '提交中...' : '添加'}</button>
      {!state.ok && <p style={{ color: 'red' }}>{state.error}</p>}
    </form>
  );
}

// useOptimistic：乐观更新
function Likes({ likes, addLike }) {
  const [optimisticLikes, addOptimistic] = useOptimistic(likes, (cur, v) => cur + v);
  return (
    <button onClick={async () => {
      addOptimistic(1);          // 立即 +1（不等接口）
      await addLike();           // 真实请求
    }}>
      ❤ {optimisticLikes}
    </button>
  );
}

// use：在条件里读 Promise（配 Suspense）
function Message({ messagePromise }) {
  if (someCondition) {
    const msg = use(messagePromise); // 像 await 但在渲染里
    return <p>{msg}</p>;
  }
  return null;
}
```

**🔍 常见追问**

- React Compiler 开启后，是不是就完全不用写 useMemo/useCallback 了？（提示：少数复杂计算仍需）
- useOptimistic 失败后状态如何回滚？（提示：重新渲染用真实 state 覆盖）
- Server Components 在 React 19 是 stable 了吗？和 Client Component 怎么区分？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「react 19新特性的使用」）+ 模型知识。建议结合 React 官方博客「React 19」核验。出处：doc/前端知识体系.md:141

---

### 105. React 的 diff 算法是怎么工作的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-005`
> 标签：#diff, #虚拟DOM, #reconcile, #高频

**💡 一句话速记**

React diff 基于**三个假设**把树对比从 O(n³) 降到 O(n)：①同层 diff（跨层级移动直接丢弃重建）；②同类型才 diff（不同类型直接替换整棵子树）；③靠 `key` 标识同层列表元素。

**📖 通俗详解**

**为什么需要 diff**：状态变化后 React 拿到新 VDOM，要和旧 VDOM 对比，找出最小变更再去更新真实 DOM。朴素对比两棵树是 O(n³)，工程不可用。

**三个假设（把复杂度降到 O(n)）**：
1. **只对同层节点 diff**：一个节点跨层级移动（比如从父级 A 移到父级 B），React 不会复用，而是直接在旧位置删除、在新位置创建。绝大多数业务场景跨层级移动很少见。
2. **不同类型的节点直接替换**：`<div>` 变 `<span>`、`<CompA>` 变 `<CompB>`，直接销毁旧的、创建新的整棵子树，不做深层 diff。
3. **同类型节点才细 diff**：`<div>` 还是 `<div>`，则复用 DOM 节点，只更新变化的属性；列表元素靠 `key` 判断「是不是同一个」。

**key 的作用**：列表更新时，React 用 key 匹配新旧节点。没 key 默认按 index 匹配，遇到「插入/删除中间项」会导致后面所有项错位重渲染（性能差 + 可能 state 错乱）。有 key 则能精确定位「移动」而非「重建」。

**类比**：diff 像「快递分拣」——只在一层仓库里找同名包裹（同层），换了仓库（跨层）就直接退回重发；不同公司（不同类型）的件直接整批换；同公司的件按单号（key）一一对应。

**Fiber 时代**：diff 过程可被拆成多个可中断的小任务（performUnitOfWork），不再是同步递归。

**🔧 示例 / 代码**

```jsx
// 假设2演示：不同类型直接替换
// 渲染 <div> → 改成 <span>：旧 div 整棵卸载，新建 span，子树全重建
function Toggle({ as }) {
  const Tag = as;  // 'div' 或 'span'
  return <Tag className="box">hello</Tag>;
}

// 假设3 + key 的重要性：列表中间插入
// ❌ 无 key（按 index 匹配）
// 数据 [A, B, C] → 头部插入 X 变 [X, A, B, C]
// React 误判：位置0的 A 变成了 X、位置1的 B 变成了 A... 全部重渲染
// 且如果每项是受控组件，输入框内容会错位

// ✅ 有 key：React 知道 X 是新增、A/B/C 只是位移，只插入 X 一项，其余复用
function List({ items }) {
  return items.map(it => <li key={it.id}>{it.name}</li>);
}

// 简化 reconcileChildren 逻辑（伪代码）
function reconcileChildrenArray(returnFiber, newChildren, oldChildren) {
  // 1. 从左往右对齐 diff（同 key 复用）
  // 2. 把剩余旧节点存进 Map（key → fiber）
  // 3. 继续遍历新节点，从 Map 里找同 key 复用，找不到则新建
  // 4. 剩余没匹配的旧节点标记为删除
}
```

**🔍 常见追问**

- 用 index 做 key 会出什么问题？什么时候用 index 做 key 反而 OK？（提示：纯展示、无增删、无受控 state）
- 为什么跨层级移动不复用？（提示：复用成本高于重建，且场景罕见）
- Vue 的 diff 和 React 的 diff 有何区别？（提示：Vue3 双端 diff + 最长递增子序列优化移动）

---

**▶ 追问 1：为什么说 React 的 diff 是 O(n) 的？**

**💡 一句话速记**

三个假设把朴素的 O(n³) 树对比降到 O(n)：只同层比较、不同类型直接替换整棵子树、列表靠 key 一一对应，避免了对所有节点做任意位置的配对。

**📖 通俗详解**

**为什么是 O(n)**：
- 朴素对比两棵树要找「最优节点配对」，是 O(n³)，工程不可用。
- React 三个假设（同层 diff、同类型才 diff、key 标识）直接砍掉了跨层、跨类型的配对计算。
- 结果：只需要同层按顺序/key 线性遍历一遍，复杂度降到 O(n)。

---

**▶ 追问 2：diff 的三层分别指什么？**

**💡 一句话速记**

三层指 tree 层（跨层级）、component 层（组件类型）、element 层（同类型节点的属性/子节点）。

**📖 通俗详解**

**三层 diff（针对三个假设的具体实现）**：
- **Tree 层**：递归对比两棵树，只走同层。发现跨层移动 → 删除+新建。
- **Component 层**：组件类型相同（都是 `<List/>`）→ 继续对它的 children diff；不同 → 整棵替换。React 会调用 `getDerivedStateFromProps` / 重渲染。
- **Element 层**：同类型 DOM 节点 → 对比 props（className、style、属性），只 set 变化的；对比 children（递归 + key 复用）。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「diff算法」）+ 模型知识。建议结合 React 官方文档「Reconciliation」核验。出处：doc/前端知识体系.md:145

---

### 106. 什么是 React 的合成事件（SyntheticEvent）？为什么不直接用原生事件？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-009`
> 标签：#合成事件, #事件系统, #SyntheticEvent, #高频

**💡 一句话速记**

合成事件是 React 对浏览器原生事件的**跨浏览器封装**，提供统一 API 和属性。React 不在 DOM 节点上直接绑定事件，而是在根容器上挂一个**统一的事件委托监听器**，事件冒泡到根时再按映射找到对应组件的回调执行——省内存、性能好、能统一兼容处理。

**📖 通俗详解**

**为什么不直接用原生事件**：
1. **浏览器兼容性**：IE 和 Chrome 事件对象差异大（`e.target` vs `e.srcElement`、阻止默认行为 API 不同），合成事件抹平这些差异。
2. **性能（事件委托）**：原生事件每个元素每个事件都要 addEventListener 一个监听器，列表 1000 项就有 1000 个监听器，内存大。React 只在根上挂一个，通过事件委托统一处理。
3. **统一的事件流控制**：React 能在合成事件层实现自己的「事件优先级」（discrete/continuous）、与 fiber 调度整合、批处理 setState。
4. **更安全**：合成事件对象是池化的（React 16 及以前），避免每次创建对象的开销（React 17 移除了事件池）。

**事件委托机制**：
- 你写 `onClick={handle}` 时，React **不会**在真实 DOM 上 addEventListener。
- React 在根容器（root）上挂 `click` 的监听器。用户点击 → 浏览器派发原生 click → 冒泡到 root → React 拿到原生事件，找到触发事件的 DOM → 映射到对应 fiber → 构造 SyntheticEvent → 按虚拟 DOM 树的层级**模拟冒泡**执行各层 onClick。

**注意事项**：
1. 合成事件的 `e.stopPropagation()` 只能阻止 React 合成事件的冒泡，**不能阻止原生 document 上的监听器**（因为原生事件已经冒泡到 root 了）。要阻止原生监听得用 `e.nativeEvent.stopImmediatePropagation()` 或在 capture 阶段处理。
2. 合成事件回调里 setState 是批处理的（React 18 后原生事件里也批处理了）。

**类比**：合成事件像「公司前台统一收快递」（事件委托到 root）——每个员工不用各自留地址（省内存），前台还能登记、转派（统一处理兼容和优先级）。

**🔧 示例 / 代码**

```jsx
import { useEffect, useRef } from 'react';

// React 合成事件 vs 原生事件的冒泡差异
function Demo() {
  const ref = useRef();
  useEffect(() => {
    // 原生事件，挂在 document 上（注意：合成事件 stopPropagation 拦不住它）
    document.addEventListener('click', () => {
      console.log('document 原生 click');
    });
  }, []);

  const handleParent = (e) => {
    console.log('parent 合成 click');
    // e.stopPropagation() 只能拦住其他合成事件，拦不住上面的 document 原生监听
  };

  return (
    <div onClick={handleParent}>
      <button onClick={(e) => {
        e.stopPropagation();
        console.log('child 合成 click');
      }}>click</button>
    </div>
  );
}

// SyntheticEvent 关键属性（跨浏览器统一）
// e.target / e.currentTarget / e.preventDefault() / e.stopPropagation()
// e.nativeEvent  → 拿到底层原生事件
```

**🔍 常见追问**

- React 16 的合成事件对象池（event pooling）是什么？为什么 17 移除了？（提示：异步访问 e.target 为 null 的坑）
- 原生事件里的 setState 和合成事件里的 setState 有什么区别？（提示：React 18 后都是批处理）
- 如果想阻止合成事件冒泡到原生 document，怎么做？

---

**▶ 追问 1：React 17 后事件挂载位置有什么变化？**

**💡 一句话速记**

React 17 前事件挂在 document 上，会互相干扰（多 React 应用、第三方库）；17 后挂在 root 容器 DOM 节点上，每个 React 应用隔离自己的事件。

**📖 通俗详解**

**React 17 的重大变化**：
- 之前：事件挂在 `document` 上。问题是一个页面有多个 React 应用（微前端、多 root）会互相干扰，且 document 上监听太多影响第三方库。
- 17 后：挂在 **root 容器 DOM 节点**（`createRoot(container)` 的 container）上，每个 React 应用隔离自己的事件。

**🔧 示例 / 代码**

```jsx
// React 16: ReactDOM.render(<App/>, root) → 事件挂在 document
// React 17+: createRoot(root).render(<App/>) → 事件挂在 root 节点（隔离多应用）
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「合成事件」）+ 模型知识。建议结合 React 官方博客「事件委托变化（v17）」核验。出处：doc/前端知识体系.md:150

---

### 107. 在 React Router 中如何实现页面切换动画？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-react-017`
> 标签：#react-router, #动画, #framer-motion, #transition

**💡 一句话速记**

用 `react-transition-group` 的 `<CSSTransition>` 或 framer-motion 的 `<AnimatePresence>`，关键是把路由的 `location.key`/`location.pathname` 作为列表项 key，让旧组件退场、新组件进场。

**📖 通俗详解**

**核心难点**：路由切换时，旧组件直接卸载、新组件直接挂载，默认没有过渡。要做动画，必须让「旧组件还能存活一小段时间执行退场动画」。

**关键技巧**：用 `location.pathname` 作为 `<Routes>` 或动画容器的 key。当路由变化：
1. AnimatePresence/TransitionGroup 检测到 key 变了。
2. 旧的路由树被标记为「退场中」，仍保留在 DOM 里执行 exit 动画。
3. 新的路由树挂载，执行 enter 动画。
4. 旧组件退场动画结束才真正卸载。

**坑**：必须把 `location` 对象显式传给 `<Routes location={location}>`，否则 Routes 内部用的 location 不会随动画容器变化，导致动画失效。

**🔧 示例 / 代码**

```jsx
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
            <Home />
          </motion.div>
        } />
        <Route path="/about" element={
          <motion.div initial={{opacity:0,x:50}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-50}}>
            <About />
          </motion.div>
        } />
      </Routes>
    </AnimatePresence>
  );
}
```

**🔍 常见追问**

- 为什么要把 location 传给 Routes？不传会怎样？
- mode="wait" 和默认模式有什么区别？
- 不用第三方库，纯 CSS transition 怎么做路由动画？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「如何实现页面切换的动画」）+ 模型知识。建议结合 framer-motion/react-transition-group 官方文档核验。出处：doc/前端知识体系.md:153

---

### 108. React 中异步请求的竞态条件（Race Condition）是什么？

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-react-012`
> 标签：#竞态条件, #useEffect, #请求, #AbortController, #高频

**💡 一句话速记**

竞态条件：先发的慢请求后返回，覆盖了后发的快请求结果，UI 显示「过时」数据。

**📖 通俗详解**

**什么是竞态**：用户快速切换 id（1→2→3），三次请求发出。若请求 1 最慢，最后返回，它的结果会覆盖最新的请求 3 的结果，UI 显示了 id=1 的数据，但当前页是 id=3——数据错乱。

**为什么 useEffect 里特别容易出**：
```jsx
useEffect(() => {
  fetchData(id).then(setData); // 没有 cleanup，旧请求仍在飞
}, [id]);
```
用户切换 id 时，上一次的 Promise 没被取消，依然会 then(setData)。

**类比**：竞态像「同时点了好几次外卖，最后送达的不是最新那单」。

**🔍 常见追问**

- useEffect 的 cleanup 执行时机是什么？（提示：下次 effect 执行前 + 卸载时）

---

**▶ 追问 1：如何解决竞态条件？**

**💡 一句话速记**

三种主流解法：①AbortController 取消未完成请求；②用标志位/请求 id 忽略过期响应；③React Query / SWR 这类库自带竞态处理。

**📖 通俗详解**

**三种解法**：
1. **AbortController（推荐）**：在 cleanup 里 `ctrl.abort()`，组件卸载或依赖变化时真正取消 HTTP 请求（fetch 原生支持 signal）。
2. **忽略过期响应（flag/id）**：用一个布尔标志或自增 id，cleanup 时置 false/id+1，then 里判断「我还是不是最新的」。
3. **用 React Query / SWR / useRequest**：这些库内部处理了竞态（基于 query key，自动去重、只保留最新）。

**类比延续**：解法要么「打电话取消老订单」（AbortController），要么「送到了也拒收」（flag 忽略）。

**🔧 示例 / 代码**

```jsx
import { useEffect, useState } from 'react';

// ❌ 有竞态：快速切换 id 会显示旧数据
function Bad({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetchData(id).then(setData); // 旧请求没取消，后返回的会覆盖
  }, [id]);
  return <div>{data}</div>;
}

// ✅ 解法1：AbortController（推荐，真正取消请求）
function Good1({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/${id}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(setData)
      .catch(e => { if (e.name !== 'AbortError') throw e; }); // 忽略取消错误
    return () => ctrl.abort(); // cleanup：取消未完成请求
  }, [id]);
  return <div>{data}</div>;
}

// ✅ 解法2：忽略过期响应（不依赖 fetch 取消能力）
function Good2({ id }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchData(id).then(d => {
      if (!cancelled) setData(d); // 只在仍是最新的时才更新
    });
    return () => { cancelled = true; };
  }, [id]);
  return <div>{data}</div>;
}

// ✅ 解法3：用 React Query（自带竞态处理）
import { useQuery } from '@tanstack/react-query';
function Good3({ id }) {
  const { data } = useQuery({
    queryKey: ['item', id],   // key 变化自动重取，旧请求结果被丢弃
    queryFn: () => fetchData(id),
  });
  return <div>{data}</div>;
}
```

**🔍 常见追问**

- AbortController 能取消 axios 请求吗？（提示：能，axios 支持 CancelToken 或 signal）
- 如果不取消请求只是忽略结果，会有什么副作用？（提示：浪费带宽、占用连接数）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「竞态条件如何解决」「请求的时机-react-query」）+ 模型知识。建议结合 React 官方文档「Effect 同步」核验。出处：doc/前端知识体系.md:142,154

---

### 109. 请手写一个简化版的 `useState`。

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-react-014`
> 标签：#useState, #实现, #闭包, #fiber, #手写

**💡 一句话速记**

简化版 useState 用「**模块级变量 + hook 链表索引**」模拟：把 state 存在 fiber 的链表节点上，setState 把更新 push 到队列，下次渲染时按队列算新值。

**📖 通俗详解**

**简化版实现要点**：
1. 用一个模块级变量 `state`（或链表节点）+ `index` 指针。
2. useState 首次调用初始化 state，后续调用读已有值，然后 index++。
3. setState 把新值/更新函数记下来，标记组件需要重渲染。
4. 重渲染时 index 归零，重新按顺序读。

**setState 的两种形式**：
- 值：`setCount(1)` —— 直接覆盖。
- 函数式：`setCount(prev => prev + 1)` —— 基于队列里上一个值计算，多次连续调用也能正确累加（解决闭包捕获旧值问题）。

**React 真实实现差异**：state 不是全局数组，而是挂在 fiber.memoizedState 的链表上；setState 不立即改值，而是 push 到 fiber 的 update queue；批处理由 scheduler 调度，不是立即 render()。

**🔧 示例 / 代码**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';

// 简化版 useState（单组件、单 hook，演示原理）
let state = [];
let setters = [];
let stateIndex = 0;

function createSetter(index) {
  return function (newVal) {
    // 支持函数式更新
    state[index] = typeof newVal === 'function' ? newVal(state[index]) : newVal;
    render(); // 触发重渲染
  };
}

function myUseState(initialValue) {
  // 用闭包锁定当前 index（关键：避免闭包捕获错误的 index）
  const currentIndex = stateIndex;
  if (setters[currentIndex] == null) {
    state[currentIndex] = typeof initialValue === 'function' ? initialValue() : initialValue;
    setters[currentIndex] = createSetter(currentIndex);
  }
  stateIndex++;
  return [state[currentIndex], setters[currentIndex]];
}

// 模拟渲染（每次重置 index 指针）
function render() {
  stateIndex = 0; // 关键：每次渲染从链表头开始
  ReactDOM.createRoot(document.getElementById('root')).render(<Counter />);
}

function Counter() {
  const [count, setCount] = myUseState(0);
  const [text, setText] = myUseState('hi');
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      {/* 函数式更新解决连续调用闭包问题 */}
      <button onClick={() => { setCount(c => c + 1); setCount(c => c + 1); }}>+2</button>
    </div>
  );
}
```

**🔍 常见追问**

- useState 的初始值传函数 `useState(() => init())` 有什么好处？（提示：惰性初始化，避免每次渲染都跑）

---

**▶ 追问 1：useState 如何解决「函数组件没有实例存 state」的问题？**

**💡 一句话速记**

核心思路是**把 state 挂在 fiber 节点的链表上**：函数组件每次渲染重新执行，普通变量存不住 state；React 让函数重新执行时从 fiber 链表对应位置把上次的 state 读回来。

**📖 通俗详解**

**核心问题**：函数组件每次渲染都重新执行函数，普通变量存不住 state（每次都是新的）。

**React 的解法**：把 state 挂在 fiber 节点的链表（memoizedState）上，函数重新执行时从链表对应位置读回来。具体见主问的实现原理——通过 index 指针 + 闭包锁定当前 hook 的位置，保证每次渲染读到的是同一个 state 节点。

---

**▶ 追问 2：setState 为什么是异步的？**

**💡 一句话速记**

setState 异步是为了**批处理**（多次 setState 合并成一次渲染），性能更好且避免中间态闪烁；同时配合 Fiber 调度实现按优先级插队、时间片切片。

**📖 通俗详解**

**setState 为什么异步**：
1. **批处理**：一次事件里多次 setState（`setA(1); setB(2);`）合并成一次渲染，避免中间态多次 DOM 操作。
2. **避免不一致**：同步更新会让 props/state 在同一次事件里前后不一致（前半段旧值后半段新值），容易出 bug。
3. **配合 Fiber 调度**：异步才能按优先级插队、时间片切片。

**注意**：异步不是「setTimeout 那种宏任务异步」，而是「本次事件循环内不立即更新，事件结束时统一 flush」。React 18 后**所有事件（包括原生、promise、setTimeout）都自动批处理**。

**🔍 常见追问**

- 为什么 setState 后立即读 state 拿到的是旧值？（提示：本次渲染的 state 是闭包里的快照）
- 连续三次 `setCount(count+1)`，count 只加了 1，为什么？怎么修？（提示：闭包旧值，改用函数式更新）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「useState hook的实现」）+ 模型知识。建议结合 React 源码 ReactFiberHooks.js 核验。出处：doc/前端知识体系.md:157

---

### 110. 对比 Redux、Zustand、MobX 三种状态管理方案，它们的核心思想和适用场景有什么不同？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-016`
> 标签：#状态管理, #zustand, #mobx, #redux, #对比, #高频

**💡 一句话速记**

Redux=不可变+纯函数reducer+单一store，强约束可回溯，适合大型项目；Zustand=极简，基于 useSyncExternalStore 精准订阅，灵活轻量；MobX=可变数据+Proxy自动追踪依赖，写法像普通对象全自动响应。

**📖 通俗详解**

**Redux 核心思想**：
- 单一全局 store，state 不可变（每次返回新对象）。
- `reducer(state, action) => newState` 纯函数。
- 通过 `dispatch(action)` 触发，所有变化可追溯（时间旅行）。
- 缺点：样板代码多（action/reducer/types）、异步要 middleware。
- 性能：需手写 selector（reselect）避免不必要渲染。

**🔧 示例 / 代码**

| 维度 | Redux | Zustand | MobX |
|---|---|---|---|
| 状态变更 | 不可变+reducer | 可变 setState | 可变(自动响应) |
| 响应式 | 手动 selector | useSyncExternalStore | Proxy 依赖追踪 |
| 样板量 | 多 | 极少 | 少 |
| 适合 | 大型可追溯 | 中小型灵活 | 中小型数据驱动 |

**类比**：Redux 像「政府公文」（按流程走、留痕、规范但慢）；Zustand 像「微信消息」（轻量直接通知订阅者）；MobX 像「智能水龙头」（水压变自动出水，全自动追踪）。

**🔍 常见追问**

- 为什么 Zustand 不像 Redux 强调不可变？（见 fe-react-018）
- MobX 的响应式和 Vue 有什么关系？（见 fe-react-019）
- 什么时候该用 Context 而不是状态管理库？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「状态管理」「zustand是如何工作的，在非react中的hook写法」「mobx的实现与工作原理」）+ 模型知识。建议结合各库官方文档核验。出处：doc/前端知识体系.md:156,159,160

---

### 111. Zustand 是如何工作的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-018`
> 标签：#zustand, #状态管理, #useSyncExternalStore, #高频

**💡 一句话速记**

Zustand 的 store 本质是个带 `subscribe/getSnapshot` 的普通对象，用 React 18 的 `useSyncExternalStore` 让组件订阅；setState 时遍历所有订阅者，逐个跑 selector 比对，决定谁要更新。

**📖 通俗详解**

**工作原理**：
- `create((set,get)=>({...}))` 返回一个 hook，内部维护 state + 订阅者列表。
- 组件调 `useStore(s => s.count)` 时，底层走 `useSyncExternalStore(subscribe, getSnapshot)`。
- `setState` 时遍历所有订阅者，逐个跑 selector 比对，决定谁要更新。

**🔍 常见追问**

- Object.is 比 === 有什么区别？为什么用它做比较？（提示：区分 +0/-0、NaN）
- 多个 selector 组合怎么避免重复渲染？（提示：shallow 比较）

---

**▶ 追问 1：为什么它的 selector 能做到精准订阅？**

**💡 一句话速记**

组件用 selector 只取关心的字段，Zustand 用 `Object.is` 比较 selector 的新旧返回值——只有该字段变了才触发重渲染，其他字段变化无感。

**📖 通俗详解**

**精准订阅**：selector 只取关心的字段，Zustand 用 `Object.is` 比较 selector 的新旧返回值——只有该字段变了才触发重渲染，其他字段变化无感。

**🔧 示例 / 代码**

```jsx
import { create } from 'zustand';
const useStore = create((set, get) => ({
  count: 0, user: { name: 'Lee' },
  inc: () => set(s => ({ count: s.count + 1 })),
}));

// React 里：selector 精准订阅
function Counter() {
  const count = useStore(s => s.count); // 只订阅 count
  return <button onClick={useStore(s=>s.inc)}>{count}</button>;
}
```

---

**▶ 追问 2：在非 React 环境中怎么使用 Zustand？**

**💡 一句话速记**

store 就是个普通 JS 对象（hook 上挂了 getState/subscribe/setState），不依赖 React 生命周期，所以在工具函数、测试、Node 脚本里都能直接操作。

**📖 通俗详解**

**非 React 用法**：store 就是个普通 JS 对象（hook 上挂了 getState/subscribe/setState），不依赖 React 生命周期，所以在工具函数、测试、Node 脚本里都能直接操作。

**🔧 示例 / 代码**

```javascript
// 非 React 里：store 是普通对象
useStore.getState().inc();                    // 改
console.log(useStore.getState().count);       // 读
useStore.subscribe(s => console.log(s));      // 订阅
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「zustand是如何工作的，在非react中的hook写法」）+ 模型知识。建议结合 Zustand 官方文档核验。出处：doc/前端知识体系.md:159

---

### 112. React 做了哪些性能优化？开发者层面有哪些常用优化手段？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-020`
> 标签：#性能优化, #memo, #useMemo, #useCallback, #并发渲染, #自动批处理, #虚拟化列表, #懒加载

**💡 一句话速记**

React 性能优化分两层：框架层（Fiber 可中断渲染、并发渲染、自动批处理、diff 算法）和开发者层（React.memo 避免子组件重渲染、useMemo/useCallback 缓存值和函数、虚拟化长列表、路由/组件懒加载、合理用 key、状态下沉/拆分）；核心思想是「减少不必要的渲染」和「减少渲染的成本」。

**📖 通俗详解**

React 性能优化可分**框架内置**和**开发者手段**两层：

**一、框架层（React 内置优化）**：

1. **Fiber 架构 + 可中断渲染**（见 fe-react-007）：把渲染拆成小单元（Fiber），可暂停/恢复，不阻塞主进程。
2. **并发渲染（Concurrent Rendering）**（React 18+）：
   - 渲染过程可被中断，让位给高优先级任务（如用户输入）。
   - useTransition/useDeferredValue 让开发者标记低优先级更新。
3. **自动批处理（Automatic Batching）**（React 18+）：
   - 多次 setState 自动合并成一次重渲染，减少渲染次数。
   - React 17 只在事件处理函数里批处理；React 18 在 Promise/setTimeout/原生事件里也自动批处理。
4. **diff 算法 O(n)**（见 fe-react-005）：通过同层比较+类型判断+key 复用，把树对比从 O(n³) 降到 O(n)。
5. **Tree Shaking**：未用到的 API 不打包。

**二、开发者层（常用优化手段）**：

1. **React.memo（组件记忆）**：
   - 包裹函数组件，props 不变时跳过重渲染。
   - 类似 PureComponent（浅比较 state+props）。
```javascript
const Child = React.memo(({ data }) => <div>{data}</div>);
```

2. **useMemo（缓存计算值）**：
   - 缓存昂贵计算结果，依赖不变时复用。
```javascript
const result = useMemo(() => heavyCompute(a, b), [a, b]);
```

3. **useCallback（缓存函数）**：
   - 缓存函数引用，配合 React.memo 避免子组件因新函数引用而重渲染。
```javascript
const handler = useCallback(() => doSomething(id), [id]);
```

4. **虚拟化长列表（Virtual List）**：
   - 万级数据只渲染可视区域的几行（react-window/react-virtualized）。
   - 避免一次性渲染过多 DOM。

5. **懒加载（Code Splitting）**：
   - 路由懒加载：`const Home = lazy(() => import('./Home'))`。
   - 组件懒加载：按需加载大组件，减小首屏 bundle。

6. **合理用 key**（见 fe-react-015）：列表用稳定唯一 key，帮 diff 精准复用，避免不必要的 DOM 重建。

7. **状态下沉/拆分**：
   - 把只有子树用的状态下沉到子组件，避免高频变化的 state 在顶层导致整棵树重渲染。
   - Context 按需拆分（见 fe-react-013 性能陷阱）。

**核心思想总结**：
- **减少不必要的渲染**：memo/useCallback/useMemo/状态拆分。
- **减少渲染的成本**：虚拟化列表、懒加载、key 复用。
- **避免阻塞主线程**：并发渲染、useTransition 标记低优先级。

**性能优化原则**：先测量（React DevTools Profiler）找瓶颈，再针对性优化，避免过早优化。

**🔧 示例 / 代码**

**优化前后对比**：
```javascript
// 未优化:每次父组件渲染,子组件都重渲染(即使props没变)
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(c => c+1)}>+</button>
      <Child data={fixedData} onClick={fixedHandler} />
    </>
  );
}

// 优化后:子组件在props没变时跳过
function Parent() {
  const [count, setCount] = useState(0);
  const handler = useCallback(() => {...}, []);  // 稳定引用
  return (
    <>
      <button onClick={() => setCount(c => c+1)}>+</button>
      <MemoChild data={fixedData} onClick={handler} />
    </>
  );
}
const MemoChild = React.memo(Child);
```

| 优化手段 | 解决问题 | 场景 |
|---|---|---|
| React.memo | 子组件无谓重渲染 | props 稳定 |
| useMemo | 重复昂贵计算 | 计算耗时 |
| useCallback | 函数引用变化致重渲染 | 传给memo组件 |
| 虚拟列表 | 长列表渲染慢 | 大量数据 |
| 懒加载 | 首屏bundle大 | 路由/重组件 |
| 并发渲染 | 阻塞主线程 | 用户交互响应 |

**🔍 常见追问**

- React.memo 的浅比较有什么局限？怎么自定义比较？
- useMemo/useCallback 滥用会有什么问题？（记忆本身有成本）
- useTransition 和 useDeferredValue 有什么区别？
- React Profiler 怎么看哪个组件渲染慢？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md「react做了哪些性能优化」红色高频考点），请结合权威资料核验

---

### 113. React Hook 的实现原理是什么？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-004`
> 标签：#hooks, #实现原理, #链表, #fiber, #高频

**💡 一句话速记**

Hook 的实现核心是**函数组件 fiber 上的单向链表**：每次渲染时按调用顺序把每个 Hook 串成链表节点挂在 fiber 上。React 靠「调用顺序」定位每个 Hook 对应的 state。

**📖 通俗详解**

**数据结构**：每个函数组件对应的 fiber 节点上有个 `memoizedState` 字段，指向一条**单向链表**。链表每个节点对应一次 Hook 调用：
```
fiber.memoizedState → Hook0(useState) → Hook1(useEffect) → Hook2(useMemo) → null
                       {memoizedState, next} ...
```

**两阶段执行**：
1. **mount（首次渲染）**：React 遇到一个 Hook 就 new 一个 hook 节点，按调用顺序尾插到链表，同时初始化 state。
2. **update（更新）**：React 从 `fiber.memoizedState` 头部开始，每调用一个 Hook 就取当前指针的节点读 state，然后指针后移一位（`hook = hook.next`）。

**为什么靠顺序定位**：因为函数组件每次渲染都是「重新执行一遍函数」，React 没法给某个 Hook 起名字定位，只能约定「第 N 个调用的 Hook 就用链表第 N 个节点」。

**useState 在链表里存什么**：`{ memoizedState: 当前值, queue: { pending: 更新队列 }, next }`。setState 不是直接改值，而是往 queue 里 push 一个 update，下次渲染时 reducer 按队列算出新值。

**🔍 常见追问**

- useEffect 和 useState 在链表节点里存的数据结构有何不同？（提示：useState 存 state+queue，useEffect 存 effect 对象+依赖）
- 为什么自定义 Hook 不会产生新的链表节点？（提示：自定义 Hook 内部的 Hook 仍归属宿主组件）
- useMemo 的依赖数组是怎么和链表节点关联的？（提示：存在 hook 节点上，下次渲染比较决定是否重算）

---

**▶ 追问 1：为什么 Hook 不能写在 `if` 条件里？**

**💡 一句话速记**

因为 React 靠「调用顺序」定位每个 Hook 对应的链表节点；条件调用会破坏顺序，导致后面的 Hook 错位读到别的节点的 state，整个组件状态错乱。

**📖 通俗详解**

**为什么不能放 if 里**：
```
// 第一次渲染（条件 true）：调用顺序 [useState, useEffect]
// 第二次渲染（条件 false）：调用顺序 [useEffect]  ← useEffect 错位成了链表第 0 个节点（其实是 useState 的）
```
React 把 useEffect 读到的 state 当成 useState 的，整个组件状态错乱。

**类比**：Hook 链表像「按取餐号发餐」——你必须按顺序报号（顺序调用），如果有人插队/跳号（条件调用），后面的号全对不上。

**正确做法**：Hook 始终在顶层调用，把判断逻辑放进 Hook 内部。

**🔧 示例 / 代码**

```jsx
// ❌ 错误：条件调用导致顺序不稳定
function Bad({ cond }) {
  let name, setName;
  if (cond) [name, setName] = useState('a');  // 有时是第 0 个，有时不存在
  const [age, setAge] = useState(0);          // 有时是第 1 个，有时是第 0 个
  // 第二次渲染 cond 变了 → age 读到的是 name 的节点 → bug
}

// ✅ 正确：始终顶层调用，需要条件时把判断放进 Hook 内部
function Good({ cond }) {
  const [name, setName] = useState('a');
  const [age, setAge] = useState(0);
  useEffect(() => {
    if (cond) doSomething();  // 条件写在 effect 内部
  }, [cond]);
}

// 简化版 useState 链表演示（伪代码，真实更复杂）
function renderFunctionComponent(fiber) {
  let hookIndex = 0;
  let currentHook = fiber.memoizedState; // update 时从头遍历

  function useState(initial) {
    let hook;
    if (currentHook) {            // update：复用已有节点
      hook = currentHook;
      currentHook = currentHook.next;
    } else {                      // mount：新建节点挂到链表
      hook = { memoizedState: initial, next: null };
      // ...尾插到 fiber.memoizedState
    }
    return [hook.memoizedState, (v) => { hook.memoizedState = v; }];
  }

  fiber.componentInstance = Component(props); // 执行函数组件
}
```

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「hook的实现」）+ 模型知识。建议结合 React 官方文档「Hooks 规则」及源码 ReactFiberHooks 核验。出处：doc/前端知识体系.md:144

---

### 114. 什么是 React Fiber 架构？为什么需要它？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-007`
> 标签：#fiber, #架构, #可中断渲染, #高频

**💡 一句话速记**

Fiber 是 React 16 引入的**新协调架构**：把组件树重写成可中断、可恢复的链表结构（每个组件一个 fiber 节点），渲染过程被拆成无数小任务（fiber unit of work），可以被浏览器事件（用户输入）打断，让高优先级更新插队，从而保证动画和交互流畅。

**📖 通俗详解**

**为什么需要 Fiber（要解决的问题）**：
React 15（Stack Reconciler）的渲染是**同步递归**的——一旦开始 reconcile 一棵大树，必须一口气跑完才能让出主线程。大树更新可能占用主线程几百毫秒，期间动画掉帧、用户点击无响应（卡顿）。

**Fiber 的解法**：
1. **数据结构改造**：把原来树状 VDOM 改造成「链表式 fiber 节点」。每个 fiber 节点有 `child`、`sibling`、`return` 三个指针，可以按链表线性遍历（而非递归）。
2. **双缓冲（double buffering）**：维护两棵 fiber 树——`current`（当前屏幕）和 `workInProgress`（正在构建的新树）。中断恢复时基于 workInProgress 继续，构建完一次性替换（commit），避免中间状态闪烁。
3. **优先级调度**：每个更新带优先级（lane），高优先级（用户输入）可以打断低优先级（数据加载），先渲染。

**两阶段渲染**：
- **Render 阶段**（可中断）：构建 workInProgress 树，计算变更，纯计算无副作用。
- **Commit 阶段**（不可中断）：把变更同步应用到真实 DOM、跑生命周期/useEffect，必须一口气完成。

**时间切片**：基于 MessageChannel / requestAnimationFrame 实现 cooperative scheduling，每帧给 React ~5ms 时间片。

**🔍 常见追问**

- 为什么 commit 阶段不能中断？（提示：DOM 操作必须一致，否则 UI 闪烁）
- 双缓冲（current/workInProgress）解决了什么问题？

---

**▶ 追问 1：Fiber 是如何实现可中断渲染的？**

**💡 一句话速记**

靠「任务拆分（work loop）」：渲染拆成一个个小工作单元（performUnitOfWork），每处理完一个 fiber 节点就检查时间片是否用完（shouldYield），用完就把当前 fiber 指针存起来让出主线程，下次从断点恢复。

**📖 通俗详解**

**任务拆分（work loop）**：渲染拆成一个个小工作单元（performUnitOfWork），每处理完一个 fiber 节点就检查「时间片用完没」（shouldYield）。用完了就把当前 fiber 指针存起来，让出主线程，下次从断点恢复。

**类比**：Stack Reconciler 像「一口气把一锅菜全做完才上桌」（期间没人能插话）；Fiber 像「切一个番茄 → 看看有没有更急的订单 → 没有就继续切」（随时可打断、可插队）。

**业务感知**：useTransition 让开发者主动把更新标记为低优先级，配合 Fiber 的优先级调度实现「高优先级插队」。

**🔧 示例 / 代码**

```jsx
// 工作循环伪代码（React 源码 simplified）
function workLoopConcurrent() {
  while (nextUnitOfWork !== null && !shouldYield()) {
    // shouldYield：检查当前时间片（~5ms）是否用完
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  if (nextUnitOfWork !== null) {
    // 时间片用完，让出主线程，下一帧继续（通过 MessageChannel 调度）
    scheduleCallback(workLoopConcurrent);
  } else {
    commitRoot(); // 全部处理完，进入 commit 阶段（不可中断）
  }
}

// 每个 fiber 节点结构（简化）
const fiber = {
  type: 'div',
  stateNode: dom,         // 真实 DOM
  child: childFiber,      // 第一个子节点
  sibling: nextFiber,     // 兄弟节点
  return: parentFiber,    // 父节点
  alternate: oldFiber,    // 指向 current 树对应节点（双缓冲）
  effectTag: 'UPDATE',    // 标记需要做的 DOM 操作
  lanes: 0b0001,          // 优先级（lane model）
};

// useTransition 让开发者主动把更新标记为低优先级
import { useTransition } from 'react';
function Search() {
  const [isPending, startTransition] = useTransition();
  const onChange = e => {
    setQuery(e.target.value);           // 高优先级：输入框立即更新
    startTransition(() => {
      setResults(filter(e.target.value)); // 低优先级：大列表可被输入打断
    });
  };
}
```

**🔍 常见追问**

- useTransition 和 useDeferredValue 是怎么利用 Fiber 的优先级能力的？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「fiber架构」）+ 模型知识。建议结合 React 官方文档「Fiber Principles」及源码 ReactFiber 核验。出处：doc/前端知识体系.md:148

---

### 115. React 的更新调度策略（Lane Model）是怎样的？不同更新的优先级如何区分？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-react-008`
> 标签：#lane, #调度, #优先级, #scheduler, #fiber

**💡 一句话速记**

Lane Model 是 React 18 引入的**优先级模型**：用 32 位二进制表示一组「车道（lane）」，每个 lane 代表一种优先级。更新被挂到对应优先级的 lane 上，Scheduler 按优先级调度——高优先级（用户输入、离散事件）插队，低优先级（数据加载、transition）延后，让交互流畅。

**📖 通俗详解**

**优先级演进**：React 15 无优先级（同步）；React 16 expirationTime（单一数值，粒度粗）；React 18 改成 **Lane Model**（位运算，可批量、可重叠）。

**Lane Model 核心**：用一个 32 位整数表示「一组 lane」，每一位代表一个优先级：
```
// 简化示意
SyncLane          = 0b00000001  // 同步（最高，必须立即执行）
InputContinuousLane= 0b00000010  // 连续输入（拖拽、滚动）
DefaultLane       = 0b00010000  // 默认（普通 setState）
TransitionLane    = 0b00100000  // 过渡（useTransition，低优先级）
IdleLane          = 0b10000000  // 空闲（最低）
```

**为什么用位运算**：
1. **批量合并**：多个 lane 用按位或 `|` 合并成一个数，一次调度处理多类更新。
2. **快速判断**：`lanes & SyncLane` 检查是否含某优先级，O(1)。
3. **细粒度**：32 位可以表示 31 种优先级，比 expirationTime 灵活得多。

**调度流程**：
1. 触发更新（setState/事件）→ React 根据来源分配 lane（点击是 SyncLane，transition 是 TransitionLane）。
2. 更新挂到 fiber 节点的 `lanes` 字段 + root 的 `pendingLanes`。
3. Scheduler（基于时间片 + 优先级队列）按优先级取出任务执行 work loop。
4. 高优先级更新来时，中断当前低优先级 workInProgress，先处理高优先级（部分场景会复用、部分会重启）。

**两类优先级**：
- **事件优先级（React 内部）**：discrete（click）、continuous（mousemove、drag）、idle（空闲）、default。
- **Lane（更新优先级）**：由事件优先级转换而来，最终挂在 fiber 上。

**类比**：Lane 像高速公路的多车道——救护车（SyncLane）走应急车道直接插队，货车（TransitionLane）走慢车道， Scheduler 是交警按车道放行。

**与 batch 的关系**：React 18 自动批处理（Automatic Batching）也依赖 lane——同一事件里多个 setState 合并到同一批 lane，一次渲染处理。

**🔧 示例 / 代码**

```jsx
import { startTransition, useState } from 'react';

// 实战：用 transition 把重计算降级为低优先级，保证输入流畅
function FilterableList({ allItems }) {
  const [query, setQuery] = useState('');
  const [list, setList] = useState(allItems);

  const onChange = e => {
    setQuery(e.target.value);                    // 高优先级：输入框立即响应
    startTransition(() => {
      setList(allItems.filter(i => i.includes(e.target.value))); // 低优先级：可被打断
    });
  };

  return (
    <>
      <input value={query} onChange={onChange} />
      <BigList items={list} />
    </>
  );
}

// 源码里的 lane 定义（简化）
// react-reconciler/src/ReactFiberLane.js
const TotalLanes = 31;
const SyncLane = 0b0000000000000000000000000000001;     // 1
const InputContinuousLane = 0b0000000000000000000000000000010; // 2
const DefaultLane = 0b0000000000000000000000000001000;  // 8
const TransitionLanes = 0b0000000000000001111111111100000; // 一段区间
const IdleLanes = 0b1111111000000000000000000000000;    // 空闲区间

// 合并 lanes：root.pendingLanes = SyncLane | DefaultLane
// 判断是否含：if (lanes & SyncLane) { /* 有同步任务 */ }
```

**🔍 常见追问**

- React 18 的 Automatic Batching 和 lane 有什么关系？
- startTransition 标记的更新被打断后，之前的计算结果会丢吗？（提示：会，需要重跑，但 React 会尽量复用）
- lane 用 31 位有什么限制？为什么不直接用数组存优先级？（提示：位运算 O(1)，数组开销大）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「更新调度策略」）+ 模型知识。建议结合 React 官方源码 ReactFiberLane.js 及「Scheduling in React」核验。出处：doc/前端知识体系.md:149

---

### 116. MobX 的响应式原理是什么？

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-react-019`
> 标签：#mobx, #状态管理, #响应式, #Proxy, #高频

**💡 一句话速记**

MobX 用 Proxy（或旧版 defineProperty）把数据变成可观察值；组件 render 时访问这些属性会自动注册依赖；属性变化时 MobX 通知所有依赖它的组件重渲染——全自动追踪，无需手动订阅。

**📖 通俗详解**

**三步响应式机制**：
1. **可观察化（Observable）**：`makeAutoObservable(this)` 用 Proxy 拦截对象属性的 get/set。读属性时收集「谁在读」，写属性时通知「读过的那些人」。
2. **依赖收集（组件 render 时）**：`observer(Component)` 包裹的组件，每次 render 时 MobX 在全局维护一个「当前正在执行的 reaction」。组件访问 `store.count` 时，Proxy 的 get 拦截器把这个属性记到当前 reaction 的依赖列表里。
3. **触发更新（数据变化时）**：当 `store.count` 被 set，Proxy 拦截到变化，查找依赖该属性的 reaction 列表，逐个标记为 dirty → 触发组件重渲染。

**与 Vue 响应式的渊源**：原理几乎一样（都是依赖收集 + 派发更新），但 MobX 更细粒度——精确到单个属性，而 Vue2 是整个对象。MobX 的 computed 也是惰性缓存：依赖没变就不重算。

**🔧 示例 / 代码**

```jsx
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
class Store {
  count = 0;
  constructor() { makeAutoObservable(this); }  // Proxy 拦截所有属性
  inc() { this.count++; }                        // action
  get double() { return this.count * 2; }        // computed（惰性缓存）
}
const store = new Store();
```

**🔍 常见追问**

- makeAutoObservable 和 makeObservable 有什么区别？装饰器怎么用？

---

**▶ 追问 1：MobX 的 computed 为什么是惰性缓存的？和 Redux selector 有什么不同？**

**💡 一句话速记**

computed 只在被读取时才求值，且依赖未变时直接返回缓存结果；依赖的任一 observable 改变才标记为 stale，下次读取才重算。这是「惰性求值 + 缓存」，而 Redux selector 通常要靠 reselect 手动 memo。

**📖 通俗详解**

**惰性 + 缓存原理**：
- **惰性求值**：computed 在定义时并不计算，只有外部 reaction（如组件 render）读取它时才执行求值函数；没人读就永远不算。
- **缓存**：首次求值后结果被缓存，同时记录它读了哪些 observable。
- **失效**：当这些依赖 observable 被修改，computed 被标记为 stale（脏），但不立即重算；下次有人读它才重新求值并更新缓存。
- **无依赖读取**：依赖未变时，无论读多少次都直接返回缓存，不重算。

**与 Redux selector 的区别**：
- MobX computed：响应式自动追踪依赖 + 自动缓存，依赖变才失效。
- Redux selector：默认每次调用都重算；要缓存得用 reselect 之类库**手动**声明依赖（输入参数），依赖靠函数签名而非自动追踪。
- 本质：MobX 是「按属性访问追踪」的 push 模型；Redux 是「按引用比较」的 pull 模型。

**🔧 示例 / 代码**

```jsx
class Store {
  price = 100;
  count = 3;
  constructor() { makeAutoObservable(this); }
  // computed：只有被读取时才算；price/count 没变就读缓存
  get total() { console.log('calc'); return this.price * this.count; }
}
const s = new Store();
console.log(s.total); // 输出 calc，300
console.log(s.total); // 不再输出 calc，仍是 300（命中缓存）
s.count = 5;          // 标记 total 为 stale
console.log(s.total); // 输出 calc，500（依赖变了，重算）
```

**🔍 常见追问**

- computed 能否有副作用？为什么推荐保持纯净？
- 为什么 MobX 不需要像 Redux 那样不可变？（提示：它追踪的是属性访问，不是引用变化）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》React 板块（含「mobx的实现与工作原理」）+ 模型知识。建议结合 MobX 官方文档核验。出处：doc/前端知识体系.md:160

---

## scenario

### 117. 实现一个并发请求控制器（limitConcurrency）：给定一组异步任务和最大并发数，控制同时最多只有 N 个在执行。

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 🔥高频 · `fe-scene-001`
> 标签：#并发控制, #promise, #场景题, #高频

**💡 一句话速记**

核心思路：维护一个「正在执行的 Set」和「等待队列」。有任务要执行时，若正在执行数 < 上限就放进去跑，否则入队等待；每个任务完成后从 Set 移除，并从队列取下一个执行。

**📖 通俗详解**

**并发控制要解决的问题**：一次性发起几百个请求会把浏览器/服务器打垮（浏览器同域并发限制、服务器限流）。需要限制同时只跑 N 个，跑完一个再放下一个。

**实现要点**：
1. 维护一个 pool（Set/数组）记录正在执行的任务。
2. 维护一个 queue（队列）记录等待的任务。
3. 调度逻辑：当 pool 大小 < limit，从 queue 取一个任务放入 pool 执行。
4. 任务完成（无论成功失败）：从 pool 移除，触发下一次调度。
5. 返回 Promise：所有任务完成后 resolve。

**关键**：用递归/循环触发调度，每个任务结束都尝试调度下一个，保证 pool 始终满载（不超过 limit）。

**🔧 示例 / 代码**

实现思路：定义 limitConcurrency(tasks, limit) 函数，内部用 index 跟踪下一个要执行的任务、用 activeCount 记录活跃数。run 函数：若还有任务且活跃数未满，取出一个任务执行，任务 then/finally 里 activeCount-- 并递归调用 run 继续调度。所有任务完成后 resolve 最终结果数组（按原顺序）。

**🔍 常见追问**

- 如果要支持任务优先级怎么做？
- 任务失败后要不要重试？怎么实现重试？
- Promise 池（如 p-limit 库）还做了哪些优化？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「实现并发请求控制」）+ 模型知识。出处：doc/前端知识体系.md:317

---

### 118. 实现一个模板字符串编译器：把模板里的插值（如 user.name）替换成真实数据。例如 Hello, {{user.name}}! 和 {user:{name:'Alice'}} → Hello, Alice!

> ⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 📈中频 · `fe-scene-002`
> 标签：#模板编译, #mustache, #场景题

**💡 一句话速记**

核心思路：用正则匹配出所有 {{...}} 占位符，对每个占位符，按点号分割路径（user.name → [user, name]），从数据对象里逐层取值，最后替换占位符。

**📖 通俗详解**

**实现步骤**：
1. 用正则 /{{(.+?)}}/g 找出所有 {{xxx}} 占位符。
2. 对每个占位符 xxx：
   - 按 . 分割成路径数组（user.name → ['user', 'name']）。
   - 从 data 对象逐层取值：data['user']['name']。
3. 用取到的值替换原占位符。
4. 支持嵌套（a.b.c 多层）、支持默认值（取不到给空串）。

**关键点**：路径取值要处理「中间层 undefined」的情况（如 data.user 不存在就别再往下取了，直接返回 undefined，避免报错）。

**🔧 示例 / 代码**

实现思路：getByPath(obj, path) 辅助函数，path 按 . split 后 reduce 逐层取值（遇到 undefined 就停止）；render(template, data) 用 replace 加正则，对每个匹配到的 key 调 getByPath 取值替换。进阶可支持循环 {{#list}}...{{/list}}、条件 {{#if}} 等（就是 mustache/handlebars 的能力）。

**🔍 常见追问**

- 怎么支持 {{#each list}} 循环语法？
- 取值时遇到函数要不要执行？（mustache 会执行）
- Vue 的模板编译比这个复杂在哪？（指令、事件、双向绑定）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「模板字符串编译」）+ 模型知识。出处：doc/前端知识体系.md:315

---

### 119. 实现一个 sum 函数，支持链式调用：sum(1,2).sumOf() 返回 3；sum(1,2)(3).sumOf() 返回 6；sum(1)(2,3,4).sumOf() 返回 10。

> ⭐⭐⭐⭐ · ✍️ 手写代码 · 🟡 待核 · 📈中频 · `fe-scene-003`
> 标签：#链式调用, #sum, #柯里化, #场景题

**💡 一句话速记**

核心：sum 返回一个函数（支持继续调用），这个函数内部累加所有参数，并挂一个 sumOf 方法返回总和。关键点：函数也是对象，可以挂属性；用闭包保存累加值；函数 toString/valueOf 可让隐式转换时也能返回值。

**📖 通俗详解**

**解题关键**：
1. sum 要返回一个**函数**（这样才能 sum(1,2)(3) 链式调用）。
2. 这个函数每次被调用，把新参数累加进闭包变量 total。
3. 这个函数要挂一个 sumOf 方法，调用时返回 total。
4. 闭包：用一个外部变量（或函数属性）累加所有调用传入的值。

**实现细节**：
- sum(...args) 第一次调用：初始化 total = sum(args)，返回一个 inner 函数。
- inner(...args)：每次调用累加 args 到 total，返回 inner 自己（支持继续链式）。
- inner.sumOf()：返回 total。

**进阶**：还可以重写 inner.valueOf / toString 返回 total，这样 +0 或隐式转换时也能得到数值。

**🔧 示例 / 代码**

实现思路：用一个闭包变量 total 累加。sum 函数返回 inner；inner 每次调用把参数 reduce 累加进 total 并返回自身；inner.sumOf 返回 total。关键技巧是「返回函数本身」实现无限链式，外加挂载 sumOf 方法作为终止符。

**🔍 常见追问**

- 怎么让 sum(1,2) + 0 也能等于 3？（提示：重写 valueOf）
- 这种链式调用和 Promise 的链式有什么本质区别？
- 怎么限制最多调用 N 次？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「实现函数 sum 链式调用」）+ 模型知识。出处：doc/前端知识体系.md:320-330

---

### 120. 如何实现 token 的无感刷新（过期时自动续期，用户无感知）？token 怎么安全存储？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-scene-004`
> 标签：#token, #无感刷新, #认证, #高频

**💡 一句话速记**

双 token 方案：短期的 access token（用于请求）+ 长期的 refresh token（用于续期）。请求遇 401（过期）时，用 refresh token 换新 access token，重发失败的请求，用户全程无感。存储：access token 放内存（短期），refresh token 放 HttpOnly cookie（安全），不要放 localStorage（XSS 能偷）。

**📖 通俗详解**

**双 token 无感刷新流程**：
1. 登录拿到 access token（短期，如 2 小时）+ refresh token（长期，如 7 天）。
2. 正常请求带 access token。
3. 某次请求返回 401（access token 过期）：
   - 拦截这个 401，暂停后续请求。
   - 用 refresh token 调刷新接口，拿新的 access token。
   - 用新 token 重发刚才失败的请求。
   - 用户全程无感知。
4. 如果 refresh token 也过期了 → 跳登录页。

**关键工程点**：
- **并发刷新控制**：多个请求同时 401，只能刷新一次（用一个 isRefreshing 标记 + 队列暂存其他请求，刷新完一起重发）。
- **请求拦截**：在 axios interceptor 里统一处理 401。
- **重试限制**：刷新失败要跳登录，不能无限重试。

**token 安全存储**：
- **access token**：放**内存（JS 变量）**，短期有效，丢了影响小。刷新机制能随时补回。
- **refresh token**：放 **HttpOnly + Secure + SameSite cookie**（JS 读不到，防 XSS 偷），长期但安全。
- **不要**把 access/refresh token 放 localStorage 或 sessionStorage（都能被 XSS 读取）。
- **CSRF 考虑**：refresh token 在 cookie 里要配 SameSite 防 CSRF。

**🔧 示例 / 代码**

实现要点：axios 响应拦截器里判断 401；维护 isRefreshing 标志位防止并发刷新；刷新期间其他请求存入队列，刷新成功后统一重发；刷新失败则清除 token 跳登录。存储上 access token 用内存，refresh token 用 HttpOnly+Secure+SameSite 的 cookie。

**🔍 常见追问**

- 多个请求同时 401 怎么保证只刷新一次？（提示：isRefreshing + 请求队列）
- refresh token 放 cookie，怎么防 CSRF？
- token 续期失败（refresh 也过期）怎么处理？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「token如何做到无感延续」「如何安全的存储」）+ 模型知识。出处：doc/前端知识体系.md:337-338

---

### 121. 移动端弱网环境下，如何保证首屏渲染速度在 1 秒内？

> ⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-scene-005`
> 标签：#弱网, #首屏, #性能, #场景题, #高频

**💡 一句话速记**

弱网核心瓶颈是资源传输慢，策略：①减少首屏要传的数据量（代码分割、按需加载、SSR/骨架屏）②提前加载关键资源（preload/preconnect）③缓存最大化（强缓存/Service Worker）④传输优化（gzip/brotli、HTTP2、图片优化）。目标是首屏只加载最少必要内容。

**📖 通俗详解**

**弱网首屏优化策略（按优先级）**：

**1. 减少首屏数据量**：
- **代码分割**：首屏只加载首屏路由的代码，其他路由懒加载。
- **Tree shaking**：删掉没用到的代码。
- **首屏数据精简**：首屏接口只返回必要字段，别一次返回一大坨。

**2. 加速资源传输**：
- **SSR/预渲染**：服务端渲染好 HTML 直接给，不用等 JS 下载执行再渲染。弱网下 SSR 优势巨大。
- **骨架屏**：先显示骨架，给用户「正在加载」的感知，降低白屏焦虑。
- **preload/prefetch**：preload 关键资源（字体、首屏 CSS）提前加载；dns-prefetch/preconnect 提前建连。
- **HTTP2**：多路复用，减少连接数。
- **CDN**：资源离用户近。

**3. 传输压缩**：
- gzip/brotli 压缩文本。
- 图片：WebP/AVIF、响应式图片（srcset）、懒加载非首屏图片。

**4. 缓存最大化**：
- 强缓存（Cache-Control）+ 协商缓存（ETag）。
- Service Worker 离线缓存——弱网甚至无网都能秒开。

**5. 渐进式渲染**：
- 关键 CSS 内联（首屏样式直接写在 HTML，不额外请求）。
- 非关键 CSS/JS 延迟加载。

**衡量**：用 LCP（最大内容绘制）指标，目标 < 1s。弱网下要实测（Chrome devtools 的 Network throttling 模拟弱网）。

**🔧 示例 / 代码**

优化组合拳：SSR 直出首屏 HTML + 关键 CSS 内联 + 非首屏路由懒加载 + Service Worker 缓存 + 图片 WebP+懒加载 + HTTP2+CDN。弱网下首屏只需传输最小 HTML+关键 CSS，1 秒内可渲染出内容；JS 异步加载后续增强交互。

**🔍 常见追问**

- SSR 在弱网下一定比 CSR 快吗？什么情况反而慢？
- Service Worker 缓存更新策略怎么设计？
- 骨架屏和首屏内容不一致会闪，怎么处理？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「移动端弱网环境下，如何保证首屏渲染速度在1s内」）+ 模型知识。出处：doc/前端知识体系.md:340

---

### 122. 一个大型列表（上千条），如何避免某一项数据变化导致整个列表重新渲染？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-scene-006`
> 标签：#大列表, #局部渲染, #性能, #场景题, #高频

**💡 一句话速记**

核心是「精确更新」：①每项用稳定唯一 key 让框架只更新变化的项 ②把每项拆成独立子组件 + memo，props 没变就不重渲染 ③用 selector/响应式精准订阅，只有变化那一项的组件订阅对应数据 ④虚拟列表只渲染可视区。目标是「数据变 A，只有 A 对应的组件更新」。

**📖 通俗详解**

**问题本质**：React/Vue 默认父组件重渲染会带着所有子组件重渲染。一个大列表，改一项，整个列表重渲染，卡。

**解决方案（组合用）**：

**1. 稳定唯一 key**：
- 列表项必须用稳定唯一的 id 做 key（不能用 index）。
- 让 diff 能精确识别「哪一项变了」，只更新那一项。

**2. 子组件 memo 化**：
- 把每项拆成独立的 ListItem 子组件。
- 用 React.memo / Vue 的合理响应式，props 没变就不重渲染。
- 父列表重渲染时，props 没变的 ListItem 直接跳过。

**3. 精准数据订阅（状态管理）**：
- 别把整个 list 传给列表组件（那样 list 变全更新）。
- 用 selector / 响应式，让每个 ListItem 只订阅自己的那一项数据。
- 数据变 A 项，只有 A 的 ListItem 被通知更新。
- Redux/Zustand/MobX 都支持这种精准订阅。

**4. 虚拟列表**：
- 上千条全渲染 DOM 本身就卡。
- 用虚拟列表（react-window）只渲染可视区的几十条。

**5. 不可变更新**：
- 更新时返回新数组/新对象，但只对变化的那项创建新引用，其他保持原引用。
- 这样 memo 才能正确判断「其他项 props 没变」。

**🔧 示例 / 代码**

优化组合：ListItem 用 memo 包裹 + 每项用 zustand selector 只订阅自己的数据（useStore(s => s.items[id])）+ key 用 id + 不可变更新（只给变化项新引用）。改 item[5]，只有第 5 个 ListItem 重渲染，其余因 props 引用不变被 memo 跳过。

**🔍 常见追问**

- memo 的浅比较（shallow compare）在嵌套对象时会失效，怎么办？
- Redux 的 useSelector 怎么实现精准订阅？
- 虚拟列表 + memo，性能还能再优化吗？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》场景题板块（含「一个大型列表，如何避免某一项的变化导致整个列表重新渲染」）+ 模型知识。出处：doc/前端知识体系.md:341

---

## security

### 123. 什么是 CSRF（跨站请求伪造）攻击？它是怎么发生的？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-security-001`
> 标签：#CSRF, #跨站请求伪造, #高频

**💡 一句话速记**

CSRF 是攻击者诱导已登录用户在不知情下，用其登录凭证（cookie 自动携带）向目标网站发起恶意请求。

**📖 通俗详解**

**CSRF 攻击原理**：
1. 用户登录银行网站 A，浏览器存了 A 的 cookie。
2. 用户没退出 A，又访问了恶意网站 B。
3. B 页面里藏了一个向 A 发请求的表单/图片（如转账请求）。
4. 浏览器发起对 A 的请求时**自动带上 A 的 cookie**（这是关键——cookie 会自动随请求发送）。
5. A 收到带合法 cookie 的请求，以为是用户本人操作，执行了转账。

**本质**：攻击者没有偷到 cookie，但利用了「浏览器会自动带 cookie」这个机制，借用户的身份发请求。

**🔧 示例 / 代码**

**攻击示例**：恶意网站 B 的页面里藏一个图片，用户访问 B 时自动向银行 A 发转账请求，浏览器自动带上 A 的 cookie。

**🔍 常见追问**

- CSRF 和 XSS 有什么区别？（XSS 是偷数据，CSRF 是借身份）
- 用了 JWT（不放 cookie）还会受 CSRF 攻击吗？

---

**▶ 追问 1：如何防御 CSRF 攻击？**

**💡 一句话速记**

防御核心：让请求带一个攻击者无法伪造的凭证（Token / SameSite Cookie / 校验 Referer）。

**📖 通俗详解**

**防御手段**：
1. **CSRF Token**：服务端下发一个随机 token，每次请求要带上这个 token。攻击者无法获取（跨域读不到），请求被拒。最主流。
2. **SameSite Cookie**：设置 cookie 的 SameSite=Lax/Strict，限制跨站请求携带 cookie。现代浏览器默认 Lax，已挡掉大部分 CSRF。
3. **校验 Referer/Origin**：服务端检查请求来源是不是自己的域名，不是就拒。
4. **关键操作二次验证**：转账等敏感操作要求再输密码/验证码。

**🔧 示例 / 代码**

**防御 - CSRF Token 流程**：服务端生成 token 存 session + 下发给前端 → 前端每次请求带上 token（header/form）→ 服务端校验 token 是否匹配 → 攻击者拿不到 token（跨域读不到）→ 请求被拒。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》安全板块（含「csrf 跨站请求伪造攻击」）+ 模型知识。建议结合 MDN/OWASP 核验。出处：doc/前端知识体系.md:133

---

### 124. 什么是 XSS（跨站脚本）攻击？有哪些类型？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-security-002`
> 标签：#XSS, #跨站脚本, #高频

**💡 一句话速记**

XSS 是攻击者把恶意脚本注入到网页里，在其他用户浏览器执行，从而偷 cookie、篡改页面、盗号。分存储型/反射型/DOM 型。

**📖 通俗详解**

**XSS 攻击原理**：攻击者把恶意 JS 代码注入到页面，受害者浏览器执行了这段代码，导致 cookie 被偷、会话被劫持、页面被篡改。

**三种类型**：
1. **存储型 XSS**：恶意代码存进数据库（如评论里藏 script 标签），所有访问该页面的用户都中招。危害最大。
2. **反射型 XSS**：恶意代码在 URL 参数里，用户点击恶意链接，服务端把参数原样返回到页面。需诱导点击。
3. **DOM 型 XSS**：纯前端漏洞，JS 直接把用户输入插入 DOM（如 innerHTML），不经过服务端。

**🔧 示例 / 代码**

**漏洞场景**：直接 innerHTML 拼接用户输入 → 攻击者输入 img 标签带 onerror 脚本 → 脚本执行偷 cookie。

**🔍 常见追问**

- 存储型 XSS 和反射型 XSS 哪个危害大？为什么？

---

**▶ 追问 1：如何防御 XSS 攻击？**

**💡 一句话速记**

防御核心：对用户输入做转义（输出到 HTML 时编码），用 CSP，cookie 设 HttpOnly，避免 innerHTML。

**📖 通俗详解**

**防御手段**：
1. **输入输出转义**：最根本。输出到 HTML 时把小于号、大于号、引号等特殊字符转义成 HTML 实体，让脚本变纯文本。不同上下文（HTML/JS/URL/属性）要用不同转义规则。
2. **CSP（内容安全策略）**：限制只执行白名单来源的脚本，阻止内联脚本执行。
3. **HttpOnly Cookie**：cookie 设 HttpOnly，JS（document.cookie）读不到，即使 XSS 也偷不到会话 cookie。
4. **避免 innerHTML**：用 textContent 或框架的自动转义（React/Vue 默认转义）。
5. **富文本用白名单过滤**：允许的标签放行，其他全部转义。

**🔧 示例 / 代码**

**防御**：用 escape 函数把特殊字符转义，或直接用 textContent（不解析 HTML）。React/Vue 默认对插值做转义，除非显式用 dangerouslySetInnerHTML / v-html 才有风险。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据模型知识扩充（XSS 与 CSRF 同属 Web 安全基础）。建议结合 MDN/OWASP 核验。出处：doc/前端知识体系.md:132

---

### 125. cookie 有哪些重要的安全属性？分别防止什么？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-security-003`
> 标签：#cookie, #属性, #SameSite, #HttpOnly, #高频

**💡 一句话速记**

核心安全属性：HttpOnly（防 JS 读取，挡 XSS 偷 cookie）、Secure（只走 HTTPS，防中间人窃听）、SameSite（防 CSRF）、Domain/Path（缩小作用域）。

**📖 通俗详解**

**Cookie 重要安全属性**：

1. **HttpOnly**：设了后 JS（document.cookie）读不到这个 cookie。**防 XSS 偷会话 cookie**——攻击者注入脚本也拿不到。会话 cookie 必设。
2. **Secure**：只在 HTTPS 下发送。**防中间人窃听**。
3. **SameSite**：控制跨站请求是否带 cookie。
   - Strict：完全不带（即使从别的站点点链接过来也不带）。最安全但影响体验。
   - Lax：大部分跨站不带，但顶层导航的 GET 请求带。现代浏览器默认值，平衡安全和体验。
   - None：都带（需配合 Secure）。**容易受 CSRF**，尽量别用。
   **主要防 CSRF**。
4. **Domain / Path**：限制 cookie 的作用域，缩小暴露范围。

**Cookie 读取限制**：
- HttpOnly 的 cookie：JS 完全读不到。
- 非 HttpOnly：document.cookie 能读（但只能读到当前域的）。
- 跨域 cookie：受同源策略限制，读不到别的域的 cookie。

**🔍 常见追问**

- 为什么 HttpOnly 只能服务端设？这样设计有什么好处？
- SameSite=Lax 为什么是默认值而不是 Strict？
- token 放 cookie 和放 localStorage 各有什么优劣（XSS/CSRF 角度）？

---

**▶ 追问 1：通过哪些方式设置 cookie 的安全属性？**

**💡 一句话速记**

两种：服务端 Set-Cookie 响应头（推荐，可设全部属性）、前端 document.cookie（无法设 HttpOnly）。

**📖 通俗详解**

**Cookie 的设置方式**：
1. **服务端 Set-Cookie 响应头**（最推荐）：服务端登录后下发，可设全部属性。例如：Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
2. **前端 document.cookie**：能设，但**无法设 HttpOnly**（HttpOnly 只能服务端设），且非 HttpOnly 的 cookie 才能被 JS 写。
3. **注意**：敏感 cookie（会话 token）一定要服务端设 HttpOnly，前端设不了这个属性。

**🔧 示例 / 代码**

**服务端设置（推荐）**：通过 HTTP 响应头 Set-Cookie 下发，可同时指定 HttpOnly、Secure、SameSite、Path、Max-Age 等全部属性。

**前端设置（局限）**：document.cookie 只能设非 HttpOnly 的 cookie，适合存非敏感偏好（如主题），不适合存会话 token。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》安全板块（含「cookie 属性」「通过哪些方式设置」「读取有哪些限制」）+ 模型知识。建议结合 MDN「Set-Cookie」核验。出处：doc/前端知识体系.md:134-136

---

### 126. 除了 XSS 和 CSRF，前端还有哪些常见安全威胁？点击劫持怎么防？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-security-004`
> 标签：#点击劫持, #CSP, #安全, #综合

**💡 一句话速记**

常见还有：点击劫持（用透明 iframe 诱骗点击）、中间人攻击、依赖供应链攻击、开放重定向。点击劫持靠 X-Frame-Options 或 CSP frame-ancestors 禁止页面被嵌套来防御。CSP 是缓解多种威胁的万能基石。

**📖 通俗详解**

**其他常见前端安全威胁**：

1. **点击劫持（Clickjacking）**：
   - 攻击者用透明 iframe 把目标网站盖在自己页面上，诱导用户点击看似正常的按钮，实际点的是目标网站的敏感按钮（如点赞、授权）。
   - 防御：X-Frame-Options: DENY/SAMEORIGIN 禁止被嵌套；或 CSP 的 frame-ancestors 指令。

2. **中间人攻击（MITM）**：
   - 攻击者截获/篡改通信内容。
   - 防御：全站 HTTPS、HSTS（强制 HTTPS）、证书钉扎。

3. **依赖供应链攻击**：
   - npm 包被植入恶意代码，装了就中招。
   - 防御：锁定依赖版本（lock 文件）、审查依赖、用 SRI（子资源完整性）校验 CDN 资源。

4. **开放重定向**：
   - 跳转参数可控，攻击者构造恶意跳转链接钓鱼。
   - 防御：校验重定向地址白名单。

5. **信息泄露**：
   - 报错信息、注释、源码、sourcemap 暴露敏感信息。
   - 防御：生产环境关 sourcemap、脱敏日志。

**CSP（内容安全策略）**是万能防御基石：限制脚本来源、禁止内联脚本、限制资源加载，能同时缓解 XSS、点击劫持等多种威胁。

**🔧 示例 / 代码**

**点击劫持防御**：通过响应头 X-Frame-Options: DENY 禁止页面被 iframe 嵌套；或用更灵活的 CSP: frame-ancestors 限制可嵌套的来源。

**CSP 防 XSS**：设置 Content-Security-Policy: script-src 只允许白名单脚本来源，禁止内联脚本执行，这样即使有注入也跑不起来。

**🔍 常见追问**

- CSP 能完全替代 HttpOnly 吗？
- SRI（子资源完整性）怎么工作？
- 生产环境前端的 sourcemap 怎么处理才安全？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据模型知识扩充（Web 安全综合）。建议结合 OWASP 核验。出处：doc/前端知识体系.md:132

---

## software-design

### 127. 如何从零设计一个前端监控系统？需要采集哪些数据？错误怎么采集上报？整体架构是怎样的？

> ⭐⭐⭐⭐⭐ · 🏗️ 系统设计 · 🟡 待核 · 🔥高频 · `fe-sd-001`
> 标签：#前端监控, #错误采集, #Sentry, #Performance, #行为埋点, #系统设计, #SDK

**💡 一句话速记**

前端监控系统采集三类数据：①错误监控（JS异常 try/catch + window.onerror + unhandledrejection + 资源加载错误）②性能监控（Performance API 拿 FP/FCP/LCP/CLS/TTFB）③用户行为（PV/UV/点击/路由跳转埋点）；架构：SDK 嵌入采集 → 上报（sendBeacon/img/批量合并）→ 服务端收集存储 → 数据清洗分析 → 可视化看板 + 告警；核心难点是采集的全面性+上报不影响性能+海量数据处理。

**📖 通俗详解**

前端监控系统从零设计，分**采集什么、怎么采集、怎么上报、整体架构**四块：

**一、采集什么（三类数据）**：

**1. 错误监控（最核心）**：
- **JS 运行时异常**：
  - 同步错误：`window.onerror`（捕获全局错误）。
  - Promise 未处理拒绝：`window.addEventListener('unhandledrejection')`。
  - 框架错误：React 的 ErrorBoundary、Vue 的 `app.config.errorHandler`。
- **资源加载错误**：`<img>/<script>/<link>` 加载失败，用 `addEventListener('error', ..., true)` 捕获阶段监听。
- **接口错误**：劫持 fetch/XHR，记录非 2xx 响应或超时。
- **白屏检测**：采样 DOM 关键节点是否渲染。

**2. 性能监控**：
用 **Performance API** 采集核心指标：
- `performance.getEntriesByType('navigation')`：TTFB、DOM 解析时间。
- `PerformanceObserver` 监听 paint：FP（首次绘制）、FCP（首次内容绘制）。
- Web Vitals：LCP（最大内容绘制）、CLS（布局偏移）、FID/INP（交互响应）。
- 资源加载耗时：各 JS/CSS/图片的加载时间。

**3. 用户行为监控**：
- PV/UV：页面访问、独立用户。
- 点击埋点：关键按钮点击。
- 路由跳转：SPA 路由变化（监听 history/popstate）。
- 滚动深度、停留时长。

**二、怎么采集（SDK 实现）**：
```javascript
// 1. JS错误
class Monitor {
  init() {
    window.onerror = (msg, url, line, col, error) => {
      this.report({ type: 'js_error', msg, stack: error?.stack, url, line, col });
    };
    window.addEventListener('unhandledrejection', e => {
      this.report({ type: 'promise_error', reason: e.reason });
    });
    // 2. 资源错误(捕获阶段)
    window.addEventListener('error', e => {
      const target = e.target;
      if (target && (target.tagName === 'IMG' || target.tagName === 'SCRIPT')) {
        this.report({ type: 'resource_error', src: target.src });
      }
    }, true);
    // 3. 劫持fetch
    const origFetch = window.fetch;
    window.fetch = (...args) => origFetch(...args).then(res => {
      if (!res.ok) this.report({ type: 'api_error', url: args[0], status: res.status });
      return res;
    });
  }
}
```

**三、怎么上报（关键考虑性能）**：
上报方式选择：
- **sendBeacon**（首选）：浏览器空闲时异步发送，页面卸载也不丢。`navigator.sendBeacon(url, data)`。
- **img 的 src**：简单 GET，跨域友好，但只能 GET 且数据量受限。`new Image().src = url + '?data=' + data`。
- **fetch keepalive**：类似 sendBeacon，请求在页面关闭后仍发完。
- **批量合并**：不是每个事件立即上报，攒一批（如每 10 条或 30 秒）合并发送，减少请求数。
- **采样率**：海量流量时按比例采样（如 10%），降低服务端压力。

**四、整体架构**：
```
[浏览器] SDK嵌入采集
    ↓ 批量上报(sendBeacon)
[网关] 接收/限流/鉴权
    ↓ 消息队列(Kafka)
[消费服务] 数据清洗/聚合/采样
    ↓ 存储
[存储] 时序数据库(InfluxDB)/ES/ClickHouse
    ↓ 查询
[分析服务] 计算指标/告警判断
    ↓ 可视化
[看板] Grafana/自研Dashboard + 告警通知(钉钉/邮件)
```

**核心难点**：
1. **采集全面**：覆盖各种错误来源（同步/异步/资源/接口/白屏）。
2. **不影响性能**：SDK 要小、上报要异步、不能阻塞主线程。
3. **SourceMap 还原**：生产代码是压缩的，错误栈需用 SourceMap 反解回源码行号（服务端处理，不泄露 SourceMap）。
4. **海量数据**：高并发上报需消息队列削峰，存储用列式数据库（ClickHouse）。
5. **实时告警**：错误率突增要能及时告警（滑动窗口判断）。

**成熟方案**：Sentry（开源错误监控）、自研（阿里 ARMS、腾讯 TAM）。

**🔧 示例 / 代码**

**SDK 初始化使用**：
```javascript
import Monitor from '@my/monitor';

Monitor.init({
  appId: 'my-app',
  reportUrl: 'https://monitor.example.com/report',
  // 采样率
  sampleRate: 1.0,
  // 开启哪些监控
  jsError: true,
  resourceError: true,
  apiError: true,
  performance: true,
  behavior: ['click', 'routeChange']
});

// 主动上报
Monitor.report({ type: 'custom', msg: 'checkout_failed', userId: '123' });
```

**错误还原流程**：
```
上报: line 1, col 5000 (压缩后)
服务端: 用SourceMap反解
结果: src/cart.js, line 45 (源码位置)
```

**🔍 常见追问**

- SourceMap 怎么反解压缩代码的错误栈？安全吗？
- sendBeacon 和 fetch keepalive 有什么区别？什么时候用哪个？
- 白屏检测有哪些方案？怎么准确判断？
- SDK 怎么保证自身报错不影响业务代码？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md软件设计板块「监控系统：如何设计/采集错误方式/常见方案」），请结合权威资料核验

---

## ssr

### 128. 前端渲染有哪几种模式？各自的工作原理是什么？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ssr-001`
> 标签：#SSR, #服务端渲染, #CSR, #客户端渲染, #SSG, #静态生成, #同构, #Next.js, #Nuxt

**💡 一句话速记**

三种主流渲染模式：①CSR 客户端渲染（浏览器拉 JS 后渲染，首屏慢但交互流畅，SPA 典型）②SSR 服务端渲染（服务器拼好 HTML 返回，首屏快利于 SEO，但服务器压力大）③SSG 静态站点生成（构建时预生成 HTML，最快最省，适合内容不变页面）。

**📖 通俗详解**

**一、CSR（Client-Side Rendering，客户端渲染）**

**原理**：服务器返回空 HTML + JS bundle，浏览器下载 JS 后执行，在客户端渲染出页面。
```
浏览器请求 → 服务器返回空HTML+JS链接 → 浏览器下载JS → 执行JS渲染页面
```

**适用**：后台管理系统、Web App（不需 SEO 的交互型应用）。典型：传统 React/Vue SPA。

---

**二、SSR（Server-Side Rendering，服务端渲染）**

**原理**：每次请求时，服务器执行组件渲染逻辑，拼好完整 HTML 返回给浏览器。
```
浏览器请求 → 服务器执行React组件 → 生成完整HTML → 返回 → 浏览器直接显示 → hydrate注水激活交互
```

**关键概念 - 同构（Isomorphic）**：
- 同一套 React 代码既能在服务器渲染（生成 HTML），又能在浏览器运行（绑定事件）。
- **Hydration（注水）**：浏览器拿到 HTML 后，React 在客户端「注水」——把事件监听绑定到已渲染的 DOM 上，使其可交互。这步叫 hydration。

**适用**：内容型网站（电商、博客、新闻）、需 SEO 的应用。典型：Next.js、Nuxt.js。

---

**三、SSG（Static Site Generation，静态站点生成）**

**原理**：构建时（build time）预生成所有页面的 HTML，部署为静态文件，请求时直接返回。
```
构建时: 执行组件 → 生成HTML文件 → 部署到CDN
请求时: CDN直接返回预生成HTML (服务器零计算)
```

**适用**：文档站、博客、营销页（内容不常变）。Next.js 的 `getStaticProps`。

**现代趋势 - 混合渲染**：
框架（如 Next.js）支持一个项目里不同页面用不同模式：首页 SSG、商品页 SSR、后台 CSR，按需选择最优方案。

**🔧 示例 / 代码**

**Next.js 三种模式的代码**：
```javascript
// CSR (客户端渲染,纯React组件)
export default function Page() {
  const [data, setData] = useState();
  useEffect(() => { fetch('/api').then(setData); }, []);
  return <div>{data}</div>;
}

// SSR (每次请求服务端渲染)
export async function getServerSideProps() {
  const data = await fetchData();  // 服务端执行
  return { props: { data } };
}

// SSG (构建时预生成)
export async function getStaticProps() {
  const data = await fetchData();  // 构建时执行一次
  return { props: { data } };
}
```

**Hydration 过程**：
```
服务器: <div>hello</div> (HTML字符串)
         ↓ 浏览器接收
显示: hello (立即可见,但点击无响应)
         ↓ JS加载执行React
Hydrate: React把onClick绑定到div (可交互)
```

**🔍 常见追问**

- Hydration mismatch（注水不一致）是什么？怎么避免？
- Next.js 的 App Router 和 Pages Router 在渲染模式上有什么区别？
- React Server Component（RSC）和 SSR 是一回事吗？

---

**▶ 追问 1：这几种渲染模式各自的优缺点和适用场景是什么？**

**💡 一句话速记**

选型看 SEO 要求/首屏速度/内容动态性/服务器成本：CSR 首屏慢 SEO 差但服务器零压力适合后台；SSR 首屏快 SEO 好但服务器压力大适合内容站；SSG 最快最省但内容固定适合文档博客。

**📖 通俗详解**

**CSR 优缺点**：
- 优点：交互流畅（首次加载后 SPA 局部刷新）、服务器压力小（只提供静态 JS）、开发体验好（前后端分离）。
- 缺点：首屏慢（要等 JS 下载+执行）、SEO 差（爬虫拿到空 HTML）。
- 适用：后台管理系统、Web App。

**SSR 优缺点**：
- 优点：首屏快（服务器直接返回可见 HTML）、SEO 好（爬虫拿到完整 HTML）。
- 缺点：服务器压力大（每次请求都要执行渲染）、开发复杂（要考虑同构，window/document 在服务端不存在）、TTFB 可能慢。
- 适用：内容型网站（电商、博客、新闻）。

**SSG 优缺点**：
- 优点：最快（CDN 直接返回静态文件，无需服务器计算）、最省（静态托管成本低）、SEO 好。
- 缺点：内容固定（构建后不更新，除非重新构建）、不适合频繁变化的动态内容。
- 适用：文档站、博客、营销页。

**选型对比**：

| 维度 | CSR | SSR | SSG |
|---|---|---|---|
| 首屏速度 | 慢 | 快 | 最快 |
| SEO | 差 | 好 | 好 |
| 服务器压力 | 小 | 大 | 无(静态) |
| 内容动态性 | 高 | 高 | 低 |
| 适用 | 后台/SPA | 内容站 | 文档/博客 |

**🔍 常见追问**

- 边缘渲染（Edge Rendering）是什么？和传统 SSR 有什么不同？

**📚 出处**

- 🟡 **待核**：无源文档，依据模型知识扩充（前端知识体系.md框架板块「服务端渲染」：原理/优势/几种模式），请结合权威资料核验

---

## typescript

### 129. TypeScript 是怎么编译成 JavaScript 的？用 babel 处理 TS 和用 tsc 有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ts-001`
> 标签：#typescript, #编译, #babel, #类型擦除, #高频

**💡 一句话速记**

TS 编译本质是「类型擦除」——把类型注解去掉，剩下的就是 JS。tsc（TS 编译器）既做类型检查又做转译；babel 只做转译（@babel/preset-typescript 擦除类型），不做类型检查，要靠编辑器或单独跑 tsc --noEmit 检查。现代项目多 babel/swc 转译 + tsc 类型检查。

**📖 通俗详解**

**TS 编译的本质：类型擦除**：
- TS = JS + 类型注解。
- 编译时，类型注解（如 `: string`、`interface`、`type`）被全部移除，剩下的就是合法 JS。
- 运行时没有任何类型信息（这正是 TS 是「编译时类型」的原因）。

**tsc（TypeScript Compiler）**：
- 做两件事：①类型检查（报类型错误）②转译（TS→JS，含降级 ES 语法）。
- 优点：类型检查和转译一体。
- 缺点：转译能力不如 babel 强（一些语法/插件不支持）、速度较慢。

**babel 处理 TS（@babel/preset-typescript）**：
- **只做类型擦除，不做类型检查**。babel 看到 TS 类型直接剥掉，不管类型对不对。
- 优点：转译快、生态好（和 babel 其他插件配合）、现代构建工具（vite/webpack）多用 babel/swc。
- 缺点：不会报类型错误。要单独跑 `tsc --noEmit` 做类型检查（CI 里跑）。

**现代项目标准做法**：
- 转译：用 babel/swc/esbuild（快）。
- 类型检查：编辑器（VSCode）实时检查 + CI 跑 `tsc --noEmit`。
- 分离关注点：转译归构建工具，类型检查归 tsc。

**关键认知**：TS 类型只在编译时存在，运行时 JS 没有类型。所以 `typeof`、`instanceof` 这些运行时检查和 TS 类型是两回事。

**🔧 示例 / 代码**

**类型擦除过程**：
```typescript
// TS 源码
function greet(name: string): string {
  const msg: string = 'hi ' + name;
  return msg;
}
interface User { name: string; }

// 编译后（类型全没了）
function greet(name) {
  const msg = 'hi ' + name;
  return msg;
}
// interface User 整个被删除
```

**tsc vs babel**：
```
tsc:  类型检查 ✅ + 转译 ✅（慢，能力一般）
babel: 类型检查 ❌ + 转译 ✅（快，能力强）
→ 实践：babel 转译 + tsc --noEmit 检查
```

**🔍 常见追问**

- 为什么 babel 不做类型检查？这样设计有什么好处？
- TS 的 enum 编译后是什么？（不是简单擦除）
- 怎么在运行时保留类型信息（如校验 API 返回的数据结构）？（提示：zod/io-ts 运行时校验库）

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》typescript 板块（含「ts是如何编译的」「babel如何处理ts」）+ 模型知识。建议结合 TS/babel 官方文档核验。出处：doc/前端知识体系.md:199-200

---

### 130. TypeScript 的 `Record<K, T>` 是怎么实现的？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-ts-002`
> 标签：#Record, #工具类型, #实现, #高频

**💡 一句话速记**

Record<K,T> 本质是 `type Record<K extends keyof any, T> = { [P in K]: T }`，用映射类型把 K 的每个键映射成 T 类型值。用于快速构造「键是 K、值是 T」的对象类型。

**📖 通俗详解**

**Record 的实现**：
```typescript
type Record<K extends keyof any, T> = { [P in K]: T };
```
- `K extends keyof any`：K 必须是合法的键类型（string | number | symbol）。
- `{ [P in K]: T }`：映射类型，遍历 K 的每个键 P，定义为 T 类型。
- 例子：`Record<'a'|'b', number>` = `{ a: number; b: number }`。

**Record 的典型用途**：
- 枚举映射：`Record<Status, string>` 把状态码映射成文案。
- 缓存对象：`Record<string, User>` 字符串键映射成 User。
- 配置对象：`Record<Env, Config>` 环境映射成配置。

**🔍 常见追问**

- Pick/Omit/Partial/Required 这些工具类型分别怎么实现？
- 映射类型 `[P in K]` 和索引签名 `[key: string]` 有什么区别？

---

**▶ 追问 1：请手写一个 `Record`。**

**💡 一句话速记**

`type MyRecord<K extends keyof any, T> = { [P in K]: T };`，用映射类型遍历 K 的每个键 P，定义为 T 类型。

**📖 通俗详解**

**手写 Record 实现**：
```typescript
type MyRecord<K extends keyof any, T> = { [P in K]: T };
```
- `K extends keyof any`：K 必须是合法的键类型（string | number | symbol）。
- `{ [P in K]: T }`：映射类型，遍历 K 的每个键 P，定义为 T 类型。

**🔧 示例 / 代码**

```typescript
// 手写 Record
type MyRecord<K extends keyof any, T> = { [P in K]: T };

// 用途示例
type Status = 'success' | 'error' | 'pending';
const statusText: Record<Status, string> = {
  success: '成功',
  error: '失败',
  pending: '处理中',
};  // 少写一个 key 会报错，强约束
```

---

**▶ 追问 2：`Record` 和 `type`、`interface` 有什么使用场景区别？**

**💡 一句话速记**

type 用于类型别名/联合/工具类型；interface 用于声明对象/类的形状，可声明合并；Record 是 type 的一种，用于快速构造「键值映射」的对象类型。

**📖 通俗详解**

**type vs interface 的区别**：
| 维度 | type（类型别名） | interface |
|---|---|---|
| 能力 | 任意类型（联合、交叉、原始、工具类型） | 只能描述对象/类的形状 |
| 声明合并 | 不支持（同名报错） | 支持（同名自动合并） |
| 扩展 | 用 `&` 交叉 | 用 `extends` 继承 |
| 计算属性 | 支持（映射类型） | 不支持 |

**使用场景**：
- **interface**：描述对象/类的公开 API、需要声明合并（库的扩展点）、面向对象风格的类型。
- **type**：联合类型、交叉类型、工具类型（Record/Pick/Omit）、条件类型、原始类型别名。
- 经验：对象形状两者都行，能用 interface 用 interface（可扩展），复杂类型用 type。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》typescript 板块（含「record的实现」「type的用法和场景」）+ 模型知识。建议结合 TS 官方文档核验。出处：doc/前端知识体系.md:201-202

---

### 131. TypeScript 的泛型和条件类型（Conditional Types）怎么用？举几个实际场景。

> ⭐⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-ts-003`
> 标签：#泛型, #条件类型, #高级类型, #高频

**💡 一句话速记**

泛型是「类型的参数」——让类型可复用、可推导（function identity<T>(x:T):T）。条件类型是「类型层面的 if-else」——`T extends U ? X : Y`，根据类型关系选不同类型。两者结合能写出强大的工具类型（Awaited/ReturnType/Exclude/Extract）。

**📖 通俗详解**

**泛型（Generics）**：
- 类型的参数，让函数/接口/类能适用于多种类型，且保持类型关联。
- 例子：`function identity<T>(x: T): T` —— 传什么类型返回什么类型，T 关联输入输出。
- 常见场景：数组 `Array<T>`、Promise `Promise<T>`、API 请求返回值 `request<T>(): Promise<T>`。

**条件类型（Conditional Types）**：
- 语法：`T extends U ? X : Y`
- 含义：如果 T 能赋值给 U，结果是 X，否则 Y。这是类型层面的三元表达式。
- 例子：`type IsString<T> = T extends string ? 'yes' : 'no'`。

**两者结合（工具类型的实现基础）**：
```typescript
// Exclude：从 T 中排除 U 的成员
type Exclude<T, U> = T extends U ? never : T;
// 'a'|'b' Exclude 'a' → 'a' 命中 never，'b' 保留 → 'b'

// Extract：提取 T 中属于 U 的成员
type Extract<T, U> = T extends U ? T : never;

// ReturnType：获取函数返回值类型
type ReturnType<T> = T extends (...args: any) => infer R ? R : never;
// infer R：在条件类型里「推断」出一个新类型变量 R
```

**实际场景**：
1. **API 类型安全**：`request<T>(url): Promise<T>`，调用时传类型，返回值自动推导。
2. **组件 props 类型**：泛型组件 `<Select<T>>` 支持不同数据类型。
3. **工具类型**：根据已有类型派生新类型，避免重复定义。
4. **类型推导**：infer 关键字从现有类型提取子类型。

**🔧 示例 / 代码**

**泛型 + 条件类型实战**：
```typescript
// 泛型：类型安全的请求函数
async function request<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json();
}
const user = await request<User>('/api/user');  // user 自动是 User 类型

// 条件类型 + infer：深层次类型操作
// 获取 Promise 的内部类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type R = UnwrapPromise<Promise<string>>;  // string

// 获取数组元素类型
type ItemOf<T> = T extends (infer I)[] ? I : never;
type Elem = ItemOf<number[]>;  // number
```

**🔍 常见追问**

- infer 关键字具体怎么用？什么场景？
- 映射类型 + 条件类型能实现什么（如 keyof + in）？
- 泛型约束（extends）怎么限制泛型范围？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》typescript 板块 + 模型知识扩展至高级类型。建议结合 TS 官方文档核验。出处：doc/前端知识体系.md:198-204

---

## vue

### 132. Vue 的响应式原理是什么？Vue 2（defineProperty）和 Vue 3（Proxy）有什么区别？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-vue-001`
> 标签：#vue, #响应式, #Proxy, #defineProperty, #高频

**💡 一句话速记**

Vue 响应式靠「数据劫持 + 依赖收集 + 派发更新」：读数据时收集谁依赖它，改数据时通知这些依赖更新。Vue2 用 defineProperty 逐属性劫持（需递归、监听不了数组/新增属性）；Vue3 用 Proxy 代理整个对象（一次性、能监听增删、数组、性能更好）。

**📖 通俗详解**

**响应式三步走**：
1. **数据劫持**：拦截对数据的读写。
2. **依赖收集（读时）**：组件 render 时访问了哪些数据，把这些数据→组件的依赖关系记下来。
3. **派发更新（写时）**：数据被修改时，通知所有依赖它的组件重新渲染。

**Vue 2 - Object.defineProperty**：
- 对象的每个属性单独劫持：定义 get（收集依赖）/ set（通知更新）。
- 痛点：
  - 需递归遍历所有属性（性能开销，初始化慢）。
  - 监听不到新增/删除属性（要用 `Vue.set`）。
  - 监听不了数组索引变化（要重写数组方法 push/splice 等）。

**Vue 3 - Proxy**：
- 代理整个对象，不是逐属性。
- 优势：
  - 一次性代理，新增/删除属性能监听（不用 Vue.set）。
  - 数组直接支持，不用 hack。
  - 性能更好（惰性响应式：访问到才代理子属性）。
  - 支持 Map/Set/WeakMap 等集合类型。

**本质区别**：defineProperty 是「属性级」监听，Proxy 是「对象级」监听。Proxy 能力是 defineProperty 的超集。

**🔧 示例 / 代码**

**Vue3 Proxy 响应式核心（reactive 简化）**：
```javascript
function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key);            // 收集依赖：记录「谁在读这个属性」
      const result = Reflect.get(obj, key, receiver);
      return typeof result === 'object' ? reactive(result) : result; // 惰性代理
    },
    set(obj, key, value, receiver) {
      const result = Reflect.set(obj, key, value, receiver);
      trigger(obj, key);          // 派发更新：通知依赖这个属性的组件刷新
      return result;
    }
  });
}
```

**Vue2 defineProperty 的局限**：
```javascript
// 新增属性监听不到
this.obj.newProp = 1;        // ❌ 不触发更新
this.$set(this.obj, 'newProp', 1);  // ✅ 要用 Vue.set
// Vue3 用 Proxy 直接就能监听，不用 set
```

**🔍 常见追问**

- Vue3 的 ref 和 reactive 有什么区别？为什么要两个？
- Proxy 能监听不了什么？（提示：原始值要用 ref 包装）
- Vue 的依赖收集和 MobX 的有什么异同？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-vue 板块（含「vue基本原理」）+ 模型知识。建议结合 Vue 官方文档「深入响应式」核验。出处：doc/前端知识体系.md:164

---

### 133. Vue 的虚拟 DOM 和编译优化是什么？Vue 3 的编译时优化比 Vue 2 强在哪？

> ⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 📈中频 · `fe-vue-002`
> 标签：#vue, #虚拟DOM, #diff, #编译

**💡 一句话速记**

Vue 用虚拟 DOM 描述 UI，数据变→生成新 vnode→diff 出最小变更→更新真实 DOM。Vue3 的突破是「编译时优化」：编译器分析模板，给静态节点打标记、给动态节点加 patchFlag，diff 时跳过静态部分，比 Vue2 的全量 diff 快很多。

**📖 通俗详解**

**虚拟 DOM 流程**：
1. 数据变 → 重新渲染生成新的虚拟 DOM 树（vnode）。
2. 新旧 vnode 对比（diff）→ 找出差异。
3. 只把差异部分更新到真实 DOM。

**为什么用虚拟 DOM**：直接操作 DOM 昂贵，用 JS 对象描述后 diff，最小化 DOM 操作。

**Vue 3 的编译时优化（核心突破）**：
Vue2 的 diff 是「运行时全量对比」——不管节点静不动态都 diff。Vue3 在**编译期**就分析模板，做了这些优化：

1. **静态提升（hoistStatic）**：纯静态节点（没有变量的）提取到 render 函数外，只创建一次，复用。diff 时直接跳过。
2. **patchFlag（补丁标记）**：编译器给动态节点标记「只有 class 变」或「只有 text 变」，diff 时只比对标记的部分，不比其他属性。
3. **静态块（Block）**：把动态节点收集到一个数组，diff 时只遍历动态节点，跳过静态子树。
4. **缓存事件处理函数**：内联函数缓存，避免每次渲染都新建。

**效果**：Vue3 diff 的时间复杂度从「全量 O(n)」降到「只看动态节点」，静态内容越多优势越大。

**对比 React**：React 的 diff 是纯运行时的（没编译优化），所以 Vue3 在模板场景下 diff 更快。但 React 的 JSX 更灵活。

**🔧 示例 / 代码**

**Vue3 编译优化示意**：
```html
<!-- 模板 -->
<div>
  <h1>静态标题</h1>          <!-- 静态：编译时提升，永不 diff -->
  <p>{{ msg }}</p>           <!-- 动态：标记 patchFlag=TEXT，只比 text -->
  <span :class="cls">hi</span> <!-- 动态：标记 patchFlag=CLASS，只比 class -->
</div>
```
编译后，diff 时：跳过 h1，只精确比 p 的 text 和 span 的 class，不比其他。

**🔍 常见追问**

- Vue3 的 Block tree 是怎么收集动态节点的？
- 为什么 React 不做编译时优化？（提示：JSX 运行时才知道结构）
- 虚拟 DOM 一定比直接操作 DOM 快吗？什么情况反而慢？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-vue 板块（含「vue基本原理」）+ 模型知识。建议结合 Vue3 官方文档核验。出处：doc/前端知识体系.md:164

---

### 134. Vue 和 React 的核心区别是什么？从响应式机制、数据流、设计理念对比。

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-vue-003`
> 标签：#vue, #react, #对比, #高频

**💡 一句话速记**

Vue 是「响应式驱动」（数据变自动更新，mutable）+ 编译优化模板；React 是「状态驱动重新渲染」（setState 触发全组件重渲染，immutable）+ JSX 运行时 diff。Vue 更自动化、上手快；React 更灵活、可控、生态大。

**📖 通俗详解**

**核心区别对比**：

| 维度 | Vue | React |
|---|---|---|
| 响应式 | 数据变→自动精确更新（Proxy 追踪） | setState→组件重渲染（不可变） |
| 数据修改 | 可变（直接赋值，响应式系统追踪） | 不可变（必须新对象触发更新） |
| 视图描述 | 模板（编译时优化） | JSX（运行时，更灵活） |
| 组件更新 | 精确到属性（响应式追踪） | 整组件重渲染（靠 memo/selector 优化） |
| 数据流 | 双向绑定（v-model，语法糖） | 单向（onChange + setState） |
| 学习曲线 | 低（约定优于配置） | 中（更底层、概念少但灵活） |

**响应式机制的本质差异**：
- **Vue**：你改数据 `this.count++`，Vue 的响应式系统自动知道谁依赖 count，精确更新那些地方。开发者很省心。
- **React**：你必须 `setCount(count+1)` 触发重渲染，整个函数组件重新执行。React 不知道「只有 count 相关的 DOM 变」，靠 diff 算出来。

**设计理念**：
- Vue：框架多做点，开发者写得爽（响应式、指令、双向绑定）。
- React：框架少做点，给开发者更多控制权（函数式、不可变、灵活组合）。

**性能倾向**：Vue 的精确更新 + 编译优化，在模板场景性能好；React 的灵活但要靠 memo/useMemo 手动优化。

**🔧 示例 / 代码**

**计数器对比**：
```vue
<!-- Vue：可变 + 响应式自动追踪 -->
<template><button @click="count++">{{ count }}</button></template>
<script setup>
import { ref } from 'vue';
const count = ref(0);  // 改了自动更新
</script>
```
```jsx
// React：不可变 + 触发重渲染
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count+1)}>{count}</button>;
}
```

**🔍 常见追问**

- Vue 的双向绑定（v-model）和 React 受控组件本质上一样吗？
- 为什么 Vue 用模板而 React 用 JSX？各有什么取舍？
- Composition API 是不是在学 React Hooks？有什么不同？

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-vue 板块（含「和react的区别」）+ 模型知识。建议结合 Vue/React 官方文档核验。出处：doc/前端知识体系.md:165

---

### 135. Vue 3 的 Composition API 相比 Options API 解决了什么问题？

> ⭐⭐⭐⭐ · 💡 概念/简答 · 🟡 待核 · 🔥高频 · `fe-vue-004`
> 标签：#vue3, #Composition API, #Options API, #高频

**💡 一句话速记**

Composition API 解决 Options API「相关逻辑分散在不同选项（data/methods/computed）」的碎片化问题，让同一功能的逻辑聚合到一个函数，便于复用和维护。

**📖 通俗详解**

**Options API 的痛点**：
同一个功能（如「搜索」）的逻辑被拆散：状态在 data、方法在 methods、计算在 computed、监听在 watch。功能一多，代码在不同选项间跳来跳去，难维护、难复用。

**Composition API 的解法**：
把同一功能的逻辑聚合成一个 `useXxx` 函数，状态、方法、计算、监听都在里面。需要用就在 setup 里调用。
```javascript
// 把搜索功能封装成一个 hook
function useSearch() {
  const keyword = ref('');
  const results = computed(() => filter(keyword.value));
  const search = () => { /* ... */ };
  return { keyword, results, search };
}
```

**优势**：
1. **逻辑聚合**：相关代码在一起，易读易维护。
2. **逻辑复用**：抽成 composable，跨组件复用，比 mixins 清晰（mixins 有命名冲突、来源不清问题）。
3. **类型推导**：对 TS 更友好。

**🔧 示例 / 代码**

**Options API（碎片化）vs Composition API（聚合）**：
```javascript
// Options：搜索功能散在 4 个地方
data() { return { keyword: '', results: [] } },
methods: { search() {...} },
computed: { filtered() {...} },
watch: { keyword() {...} }

// Composition：搜索功能聚在一起
setup() {
  const { keyword, results, search } = useSearch();
  return { keyword, results, search };
}
```

**🔍 常见追问**

- Vue 的 ref 为什么需要 .value？有没有不用写 .value 的方案？
- Composition API 完全替代 Options API 了吗？老项目要迁移吗？

---

**▶ 追问 1：它和 React Hooks 有什么本质区别？**

**💡 一句话速记**

Composition API 只在 setup 执行一次（无闭包陷阱），Hooks 每次渲染都执行（有闭包、依赖数组问题）；Composition API 不需要写依赖数组，自动追踪。

**📖 通俗详解**

**和 React Hooks 的本质区别**：
- **执行时机**：Composition API 的 setup 只在组件创建时执行**一次**；React Hooks 每次**渲染都执行**。
- **闭包问题**：因为只执行一次，Composition API **没有 React Hooks 的闭包陷阱**（Hooks 要靠依赖数组处理闭包）。
- **依赖管理**：Composition API 不需要写依赖数组（computed/watch 自动追踪），Hooks 必须写依赖数组且容易写错。
- **本质**：Composition API 借鉴了 Hooks 的组合思想，但基于 Vue 的响应式系统，避开了 Hooks 的那些坑。

**📚 出处**

- 🟡 **待核**：大纲题，无源文档。依据《前端知识体系》框架-vue 板块（含「vue基本原理」）+ 模型知识，扩展至 Composition API。建议结合 Vue3 官方文档核验。出处：doc/前端知识体系.md:164

---
