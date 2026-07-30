# 模块 12：Node.js

### Q12.87【中·高频·概念】Node.js 的事件循环和浏览器的事件循环有什么区别？

**考察点:** Node.js 用 6 个阶段（timers、pending、poll、check、close + 微任务队列），浏览器只有宏任务+微任务两类；Node 11 以前 timers 阶段会一次性清空所有到期回调，11 之后对齐浏览器「每个宏任务后清空微任务」。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- `process.nextTick` 和 `queueMicrotask` 哪个先执行？为什么 nextTick 不建议滥用？
- 在 I/O 回调里，`setTimeout(fn,0)` 和 `setImmediate(fn)` 谁先？（提示：I/O 回调后 check 阶段在前）
- Node 11 之后为什么对齐浏览器？解决了什么问题？

---

### Q12.88【中·概念】pm2 在 Node.js 部署中起什么作用？它的核心能力有哪些？

**考察点:** pm2 是 Node.js 的进程管理器，核心能力：守护进程（崩溃自动重启）、多进程集群（cluster 模式利用多核）、日志管理、零停机重载、状态监控。

**参考答案要点:**
Node.js 单线程跑业务逻辑，一个未捕获异常就整个进程挂掉；单进程也只能用一个 CPU 核。pm2 解决的就是这两类生产问题：

| 能力 | 说明 |
|---|---|
| 守护进程 | 后台运行，主进程崩了 pm2 自动拉起，不用 nohup |
| 集群模式 | `pm2 start app.js -i max` 用 cluster 起多个 worker，榨干多核 |
| 零停机重载 | `pm2 reload` 一个个重启 worker，请求不中断（graceful reload） |
| 日志管理 | 自动收集 stdout/stderr 到日志文件，支持日志切割 |
| 监控 | `pm2 monit` 看内存/CPU/事件，`pm2 list` 看进程状态 |
| 启动项 | `pm2 startup` + `pm2 save` 让服务开机自启 |

**示例:**
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

**追问方向:**
- `cluster` 模式下多个 worker 共享一个端口，连接是如何分配给各 worker 的？（提示：master round-robin）
- pm2 reload 是如何做到「零停机」的？（提示：逐个 worker 重启）
- 多 worker 之间如何共享 session/缓存？（提示：用 Redis 等外部存储，进程内存不共享）

---

### Q12.89【中·高频·概念】Node.js 的 Buffer 是什么？

**考察点:** Buffer 是 Node 用来存二进制数据的「定长字节序列」，类似 `Uint8Array` 的子类，用于在网络/文件读写时高效处理原始字节，不像字符串需要编码转换。

**参考答案要点:**
JavaScript 原生没有处理二进制的方便手段（早期），Node 设计 Buffer 来处理 TCP 流、文件 I/O 这类字节流数据。

**示例:**
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

**追问方向:**
- `Buffer.alloc` 和 `Buffer.allocUnsafe` 有什么区别？为什么不推荐 `new Buffer()`？
- Buffer 和 `Uint8Array` / `ArrayBuffer` 是什么关系？（提示：Buffer 是 Uint8Array 子类，buf.buffer 是底层 ArrayBuffer）

---

### Q12.90【中·高频·概念】什么是服务端渲染（SSR）？它的基本原理是什么？

**考察点:** SSR 是在服务器上把组件渲染成 HTML 字符串发给浏览器，用户拿到的是「带内容的完整页面」，而不是 CSR 那种「空 HTML + JS 再渲染」。原理：服务端执行组件代码生成 HTML → 客户端 hydrate（注水）接管交互。

**参考答案要点:**
对比两种渲染方式：

| 方式 | HTML 返回内容 | 首屏 | SEO | 流程 |
|---|---|---|---|---|
| CSR（客户端渲染） | 空的 `<div id=root></div>` + JS bundle | 慢（要下 JS 再渲染） | 差（爬虫看不到内容） | 服务器给空壳，浏览器跑 JS 渲染 |
| SSR（服务端渲染） | 完整带内容的 HTML | 快（直接看到内容） | 好（HTML 里有内容） | 服务器跑组件出 HTML，浏览器拿到后 hydrate |

**示例:**
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

**追问方向:**
- 什么是 hydration mismatch（注水不匹配）？什么情况下会发生？
- 服务端没有 window/document，组件里用到浏览器 API 怎么办？（提示：用 onMounted/useEffect 或 typeof window 判断）
- SSR 一定要全做吗？有没有折中方案？（提示：部分预渲染、 Islands 架构）

---

### Q12.91【中·高频·概念】SSR 相比 CSR（客户端渲染）有哪些优势？又有什么代价？

**考察点:** 优势：首屏快、SEO 好、利于弱网/低端机；代价：服务器压力增大、开发复杂（要写同构代码）、TTFB 变慢（要等数据请求）、部署需要 Node 环境。

**参考答案要点:**
**优势**：

| 优势 | 原因 |
|---|---|
| 首屏快（FCP/LCP 优） | 浏览器拿到 HTML 立刻就能显示内容，不用等 JS 下载执行 |
| SEO 友好 | 爬虫直接从 HTML 读到完整内容，CSR 的空 div 爬虫抓不到 |
| 弱网/低端机体验好 | 不依赖客户端 JS 执行能力，老机器也能快速看到内容 |
| 社交分享预览好 | 链接卡片能抓到 og 标签和内容（CSR 抓不到） |

**示例:**
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

**追问方向:**
- SSR 的 TTFB 为什么比 CSR 慢？怎么优化？（提示：数据预取并行化、缓存、流式渲染）
- 什么场景下 SSR 反而比 CSR 更慢？（提示：服务器渲染慢 + 数据请求多，没缓存）
- 纯静态内容（公司官网）该用 SSR 还是 SSG？（提示：SSG 构建时生成，更省服务器）

---

### Q12.92【高·高频·概念】什么是洋葱圈模型？Koa 中间件如何实现请求进、响应出的嵌套执行？

**考察点:** 洋葱圈是中间件「先进后出」的执行模型：请求从外向内穿过每一层中间件到核心，响应再从内向外穿回去，每层中间件用 `await next()` 把控制权交给下一层，next 之后的代码在响应阶段执行。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- 如果某个中间件忘了写 `await next()`，会有什么后果？（提示：响应阶段提前执行、时序错乱）
- Koa 的洋葱圈和 Express 的中间件执行顺序有什么本质区别？
- 如何在洋葱圈里实现统一错误处理？（提示：最外层 try/catch + app.on('error')）

---

### Q12.93【高·高频·概念】Node.js 中 CommonJS 和 ESM 两种模块加载方式有什么区别？

**考察点:** CommonJS 用 `require/module.exports`，同步加载、运行时求值、可动态 require、值是拷贝；ESM 用 `import/export`，静态分析（编译期确定依赖）、异步加载、值是实时绑定（live binding），`this` 在顶层是 undefined。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- CJS 中循环引用（A require B、B require A）会怎样？（提示：B 拿到 A 未完成的部分导出）
- ESM 的 tree-shaking 为什么对 CJS 不起作用？（提示：CJS 导出是运行时求值，静态分析不出未用）
- `import()` 动态导入和 `require()` 有什么区别？（提示：异步 vs 同步、返回 Promise）

---

### Q12.94【高·高频·手写】Node.js 的 EventEmitter 是同步还是异步？请手写一个简易 EventEmitter（含 on/emit/off/once）。

**考察点:** EventEmitter 的 `emit` 是**同步**的——它按注册顺序逐个同步调用回调，不是放进事件循环队列。回调本身可以是异步函数，但触发机制是同步遍历。手写核心就是一个 `{ 事件名: [回调数组] }` 的 Map。

**参考答案要点:**
常见误区：以为「事件」就是异步。其实 EventEmitter 的本质是**发布订阅模式**，`emit` 触发时直接同步 for 循环调用所有 listener，跟 `setTimeout` 那种异步队列没关系。

```js
ee.on("x", () => console.log("a"));
ee.on("x", () => console.log("b"));
console.log("before");
ee.emit("x");        // a, b 同步执行
console.log("after"); // 输出: before a b after
```

如果回调里写了异步代码（如 setTimeout），那部分异步，但「调用 listener 这个动作」是同步的。

**示例:**
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

**追问方向:**
- 如果一个 listener 里抛错，后续 listener 还会执行吗？（提示：Node 默认会抛出，用 `ee.emit('error')` 走 error 事件）
- 如何在 `emit` 遍历时安全移除监听器而不跳过元素？（提示：遍历副本）
- EventEmitter 和 Promise/async 在处理异步流程时各有什么取舍？

---

### Q12.95【高·高频·概念】Node.js 的 Stream（流）是什么？

**考察点:** Stream 是「分块处理数据」的抽象，数据像水流一样一段段过来，边到边处理，不必把整个数据加载进内存。分 4 种：Readable（可读）、Writable（可写）、Duplex（双工）、Transform（转换）。

**参考答案要点:**
**4 种流**：
| 类型 | 含义 | 例子 |
|---|---|---|
| Readable | 只能读（产生数据） | fs.createReadStream、HTTP 请求体 |
| Writable | 只能写（消费数据） | fs.createWriteStream、HTTP 响应 |
| Duplex | 可读可写，两端独立 | TCP socket（收发独立） |
| Transform | 可读可写，写进去经变换再读出 | zlib（压缩）、加密 |

**示例:**
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

**追问方向:**
- `pipe` 是如何处理背压的？手动 `on('data')` 会有什么问题？（提示：不背压，要用 pause/resume 或 pipeline）
- Duplex 和 Transform 流的区别是什么？各自典型场景？
- 为什么推荐用 `stream.pipeline` 替代 `pipe`？（提示：错误处理 + 资源清理）

---

### Q12.96【高·高频·概念】现代框架（Next.js/Nuxt）有哪几种渲染模式？它们各是什么？

**考察点:** 主要有 4 种：CSR（客户端渲染）、SSR（请求时服务端渲染）、SSG（构建时生成静态 HTML）、ISR（增量静态再生成，定时更新静态页）。Next.js/Nuxt 都支持按页面混用。

**参考答案要点:**
| 模式 | 何时生成 HTML | 特点 | 适用 |
|---|---|---|---|
| **CSR** | 浏览器（运行时） | 首屏慢、SEO 差、服务器零压力 | 后台系统、强交互应用 |
| **SSR** | 每次请求时（服务器实时） | 首屏快、SEO 好、服务器压力大、内容实时 | 电商详情页、个性化内容、动态数据 |
| **SSG** | 构建时一次性生成 | 首屏最快、SEO 好、可全 CDN、内容固定 | 博客、文档、官网、营销页 |
| **ISR** | 构建+按需定时重新生成 | 兼具 SSG 的快和内容的更新 | 大量页面、内容偶尔变化的站点（如博客、商品列表） |

**示例:**
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

**追问方向:**
- ISR 的 `revalidate` 是如何做到「先返回旧的、后台生成新的」？（提示：stale-while-revalidate 策略）
- Next.js 的 React Server Component（RSC）和传统 SSR 有什么区别？（提示：RSC 是组件级、零 JS 下发）

---
