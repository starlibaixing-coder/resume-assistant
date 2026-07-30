# 模块 14：场景题

### Q14.117【中·高频·手写】实现一个并发请求控制器（limitConcurrency）：给定一组异步任务和最大并发数，控制同时最多只有 N 个在执行。

**考察点:** 核心思路：维护一个「正在执行的 Set」和「等待队列」。有任务要执行时，若正在执行数 < 上限就放进去跑，否则入队等待；每个任务完成后从 Set 移除，并从队列取下一个执行。

**参考答案要点:**
**并发控制要解决的问题**：一次性发起几百个请求会把浏览器/服务器打垮（浏览器同域并发限制、服务器限流）。需要限制同时只跑 N 个，跑完一个再放下一个。

**示例:**
实现思路：定义 limitConcurrency(tasks, limit) 函数，内部用 index 跟踪下一个要执行的任务、用 activeCount 记录活跃数。run 函数：若还有任务且活跃数未满，取出一个任务执行，任务 then/finally 里 activeCount-- 并递归调用 run 继续调度。所有任务完成后 resolve 最终结果数组（按原顺序）。

**追问方向:**
- 如果要支持任务优先级怎么做？
- 任务失败后要不要重试？怎么实现重试？
- Promise 池（如 p-limit 库）还做了哪些优化？

---

### Q14.118【中·手写】实现一个模板字符串编译器：把模板里的插值（如 user.name）替换成真实数据。例如 Hello, {{user.name}}! 和 {user:{name:'Alice'}} → Hello, Alice!

**考察点:** 核心思路：用正则匹配出所有 {{...}} 占位符，对每个占位符，按点号分割路径（user.name → [user, name]），从数据对象里逐层取值，最后替换占位符。

**参考答案要点:**
**实现步骤**：
1. 用正则 /{{(.+?)}}/g 找出所有 {{xxx}} 占位符。
2. 对每个占位符 xxx：
   - 按 . 分割成路径数组（user.name → ['user', 'name']）。
   - 从 data 对象逐层取值：data['user']['name']。
3. 用取到的值替换原占位符。
4. 支持嵌套（a.b.c 多层）、支持默认值（取不到给空串）。

**示例:**
实现思路：getByPath(obj, path) 辅助函数，path 按 . split 后 reduce 逐层取值（遇到 undefined 就停止）；render(template, data) 用 replace 加正则，对每个匹配到的 key 调 getByPath 取值替换。进阶可支持循环 {{#list}}...{{/list}}、条件 {{#if}} 等（就是 mustache/handlebars 的能力）。

**追问方向:**
- 怎么支持 {{#each list}} 循环语法？
- 取值时遇到函数要不要执行？（mustache 会执行）
- Vue 的模板编译比这个复杂在哪？（指令、事件、双向绑定）

---

### Q14.119【高·手写】实现一个 sum 函数，支持链式调用：sum(1,2).sumOf() 返回 3；sum(1,2)(3).sumOf() 返回 6；sum(1)(2,3,4).sumOf() 返回 10。

**考察点:** 核心：sum 返回一个函数（支持继续调用），这个函数内部累加所有参数，并挂一个 sumOf 方法返回总和。关键点：函数也是对象，可以挂属性；用闭包保存累加值；函数 toString/valueOf 可让隐式转换时也能返回值。

**参考答案要点:**
**解题关键**：
1. sum 要返回一个**函数**（这样才能 sum(1,2)(3) 链式调用）。
2. 这个函数每次被调用，把新参数累加进闭包变量 total。
3. 这个函数要挂一个 sumOf 方法，调用时返回 total。
4. 闭包：用一个外部变量（或函数属性）累加所有调用传入的值。

**示例:**
实现思路：用一个闭包变量 total 累加。sum 函数返回 inner；inner 每次调用把参数 reduce 累加进 total 并返回自身；inner.sumOf 返回 total。关键技巧是「返回函数本身」实现无限链式，外加挂载 sumOf 方法作为终止符。

**追问方向:**
- 怎么让 sum(1,2) + 0 也能等于 3？（提示：重写 valueOf）
- 这种链式调用和 Promise 的链式有什么本质区别？
- 怎么限制最多调用 N 次？

---

### Q14.120【高·高频·概念】如何实现 token 的无感刷新（过期时自动续期，用户无感知）？token 怎么安全存储？

**考察点:** 双 token 方案：短期的 access token（用于请求）+ 长期的 refresh token（用于续期）。请求遇 401（过期）时，用 refresh token 换新 access token，重发失败的请求，用户全程无感。存储：access token 放内存（短期），refresh token 放 HttpOnly cookie（安全），不要放 localStorage（XSS 能偷）。

**参考答案要点:**
**双 token 无感刷新流程**：
1. 登录拿到 access token（短期，如 2 小时）+ refresh token（长期，如 7 天）。
2. 正常请求带 access token。
3. 某次请求返回 401（access token 过期）：
   - 拦截这个 401，暂停后续请求。
   - 用 refresh token 调刷新接口，拿新的 access token。
   - 用新 token 重发刚才失败的请求。
   - 用户全程无感知。
4. 如果 refresh token 也过期了 → 跳登录页。

**示例:**
实现要点：axios 响应拦截器里判断 401；维护 isRefreshing 标志位防止并发刷新；刷新期间其他请求存入队列，刷新成功后统一重发；刷新失败则清除 token 跳登录。存储上 access token 用内存，refresh token 用 HttpOnly+Secure+SameSite 的 cookie。

**追问方向:**
- 多个请求同时 401 怎么保证只刷新一次？（提示：isRefreshing + 请求队列）
- refresh token 放 cookie，怎么防 CSRF？
- token 续期失败（refresh 也过期）怎么处理？

---

### Q14.121【高·高频】移动端弱网环境下，如何保证首屏渲染速度在 1 秒内？

**考察点:** 弱网核心瓶颈是资源传输慢，策略：①减少首屏要传的数据量（代码分割、按需加载、SSR/骨架屏）②提前加载关键资源（preload/preconnect）③缓存最大化（强缓存/Service Worker）④传输优化（gzip/brotli、HTTP2、图片优化）。目标是首屏只加载最少必要内容。

**参考答案要点:**
**弱网首屏优化策略（按优先级）**：

**示例:**
优化组合拳：SSR 直出首屏 HTML + 关键 CSS 内联 + 非首屏路由懒加载 + Service Worker 缓存 + 图片 WebP+懒加载 + HTTP2+CDN。弱网下首屏只需传输最小 HTML+关键 CSS，1 秒内可渲染出内容；JS 异步加载后续增强交互。

**追问方向:**
- SSR 在弱网下一定比 CSR 快吗？什么情况反而慢？
- Service Worker 缓存更新策略怎么设计？
- 骨架屏和首屏内容不一致会闪，怎么处理？

---

### Q14.122【高·高频·概念】一个大型列表（上千条），如何避免某一项数据变化导致整个列表重新渲染？

**考察点:** 核心是「精确更新」：①每项用稳定唯一 key 让框架只更新变化的项 ②把每项拆成独立子组件 + memo，props 没变就不重渲染 ③用 selector/响应式精准订阅，只有变化那一项的组件订阅对应数据 ④虚拟列表只渲染可视区。目标是「数据变 A，只有 A 对应的组件更新」。

**参考答案要点:**
**问题本质**：React/Vue 默认父组件重渲染会带着所有子组件重渲染。一个大列表，改一项，整个列表重渲染，卡。

**示例:**
优化组合：ListItem 用 memo 包裹 + 每项用 zustand selector 只订阅自己的数据（useStore(s => s.items[id])）+ key 用 id + 不可变更新（只给变化项新引用）。改 item[5]，只有第 5 个 ListItem 重渲染，其余因 props 引用不变被 memo 跳过。

**追问方向:**
- memo 的浅比较（shallow compare）在嵌套对象时会失效，怎么办？
- Redux 的 useSelector 怎么实现精准订阅？
- 虚拟列表 + memo，性能还能再优化吗？

---
