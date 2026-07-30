# 模块 10：微前端

### Q10.80【中·高频·概念】什么是微前端？它解决什么问题？

**考察点:** 微前端是把一个大型前端应用拆成多个独立的小应用（可独立开发/部署/技术栈），再整合成一个整体。解决巨石应用的「协作难、部署耦合、技术栈锁定」问题。

**参考答案要点:**
**微前端解决的核心问题**：

随着项目变大变老，出现「巨石应用」：
1. **构建慢**：代码越堆越多，构建几分钟。
2. **协作冲突**：多团队改同一仓库，互相阻塞。
3. **部署耦合**：改一处要整体重新部署，风险大。
4. **技术栈锁定**：老项目想升级 React/Vue，但牵一发动全身。

**示例:**
**微前端整合示例**：
```
主应用(容器): 负责导航、鉴权、子应用调度
  ├── 子应用A (React，团队A维护)
  ├── 子应用B (Vue，团队B维护)
  └── 子应用C (老 Angular，团队C维护)
各子应用独立部署，主应用动态加载
```

**追问方向:**
- 微前端和后端微服务有什么对应关系？
- 微前端的「独立部署」具体怎么实现的？

---

### Q10.81【高·高频·概念】qiankun 微前端框架的优缺点和核心机制是什么？

**考察点:** qiankun 基于 single-spa，核心是「HTML Entry」——通过加载子应用的 HTML，解析出 JS/CSS 并在沙箱里执行。优点：接入简单（几行代码）、JS 沙箱隔离、生态成熟。缺点：JS 沙箱有性能开销、CSS 隔离不彻底（默认没做）、子应用要改造、多实例复杂。

**参考答案要点:**
**qiankun 核心机制**：
1. **HTML Entry**：主应用配置子应用的入口 HTML 地址。qiankun fetch 这个 HTML，解析出里面的 `<script>`、`<style>`、`<link>`。
2. **资源加载执行**：把解析出的 JS 在一个**沙箱环境**里执行，CSS 注入页面。
3. **生命周期**：子应用导出 bootstrap/mount/unmount，qiankun 在对应时机调用，实现挂载/卸载。
4. **JS 沙箱**：隔离子应用的 window，防止互相污染（Proxy 拦截 window 操作）。

**示例:**
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

**追问方向:**
- qiankun 的 JS 沙箱（Proxy）具体怎么实现隔离？
- qiankun 的 CSS 隔离为什么默认不做？shadowDOM 方案有什么坑？
- qiankun 和 wujie/micro-app 相比有什么优劣？

---

### Q10.82【高·概念】微前端项目中，主应用加载子应用资源时的跨域问题怎么解决？

**考察点:** 主应用要动态 fetch 子应用的 JS/CSS，跨域会触发 CORS：子应用服务端配 Access-Control-Allow-Origin 放行主应用域名，或主应用用反向代理把子应用资源代理到同域。qiankun 用 fetch 加载资源，所以 CORS 必须配。

**参考答案要点:**
**子应用跨域问题**：

主应用要动态加载子应用的 JS/CSS（跨域 fetch），会遇到 CORS：
- **原因**：主应用域名和子应用资源域名不同，浏览器拦截跨域请求。
- **解决**：
  - 子应用服务端配 CORS：`Access-Control-Allow-Origin: 主应用域名`（或 *）。
  - 或主应用用反向代理，把子应用资源代理到同域。
  - qiankun 加载资源用的是 fetch，所以 CORS 必须配。

**示例:**
**CORS 配置（子应用）**：
```
Access-Control-Allow-Origin: https://main-app.com
Access-Control-Allow-Methods: GET
```

**追问方向:**
- qiankun 加载子应用用 fetch，为什么不用 script 标签？
- 子应用资源配了 CORS=* 有什么风险？怎么收紧？

---

### Q10.83【高·高频·概念】微前端的沙盒（隔离）方案有哪些？JS 沙箱和 CSS 隔离分别怎么实现？

**考察点:** JS 沙箱：Proxy 代理 window（快照沙箱/代理沙箱），拦截子应用对 window 的读写，实现隔离。CSS 隔离：Shadow DOM（彻底但样式难穿透）、scoped CSS（加前缀，有局限）、CSS Modules。没有完美方案，各有取舍。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- Proxy 沙箱能拦住所有对 window 的操作吗？有逃逸的情况吗？
- Shadow DOM 的弹窗逃逸问题（portal 到 body）怎么解决？
- wujie 用 iframe 做隔离，和 Proxy 沙箱比有什么优劣？

---
