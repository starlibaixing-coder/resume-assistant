# 模块 07：工程化

### Q07.55【中·高频·概念】Webpack 里 module、chunk、bundle 这三个概念分别是什么？

**考察点:** module 是源码里的单个文件（一切皆模块）；chunk 是 webpack 内部构建的代码块（打包过程的中间态，含入口chunk/异步chunk）；bundle 是最终输出的文件（chunk 经过处理后的产物）。关系：module → 组成 chunk → 输出 bundle。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- SplitChunksPlugin 是怎么把公共代码抽成单独 chunk 的？
- 动态 import 产生的 chunk 怎么加载？
- bundle 和 chunk 在什么情况下不是一一对应？

---

### Q07.56【中·高频·概念】pnpm 相比 npm/yarn 有什么优势？

**考察点:** pnpm 优势：用硬链接 + 软链接（content-addressable store）节省磁盘、严格依赖隔离（防幽灵依赖）、安装快、原生支持 monorepo。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- 幽灵依赖具体会带来什么问题？
- pnpm 的软链接结构有没有兼容性问题？（有些工具不认软链接）
- monorepo 里 pnpm workspace 怎么管理内部包依赖？

---

### Q07.57【高·高频·概念】Webpack 的打包原理是什么？

**考察点:** webpack 从入口出发递归构建依赖图，用 loader 把各类文件转成 JS 模块，分组生成 chunk，经 plugin 在生命周期各阶段干预后输出 bundle。

**参考答案要点:**
**Webpack 打包原理**：
1. **读配置**：entry、output、loader、plugin。
2. **构建依赖图**：从 entry 开始，递归解析每个 import/require，用 loader 处理非 JS 文件，收集所有 module 及其依赖。
3. **生成 chunk**：根据依赖关系把 module 分组成 chunk。
4. **应用 plugin**：在编译生命周期的各钩子（编译开始/模块构建/优化/输出）执行 plugin 逻辑。
5. **输出 bundle**：把 chunk 写到 output 目录。
6. **产物**：bundle（含 webpack 运行时 + 模块代码）。

**追问方向:**
- webpack 的构建生命周期有哪些关键 hook？

---

### Q07.58【高·高频·概念】Vite 为什么比 Webpack 快？

**考察点:** Vite 快在：开发时用浏览器原生 ESM「按需加载」（不打包，请求哪个模块编译哪个），只有依赖预构建用 esbuild（极快）。Webpack 要先把所有模块打成 bundle 再启动，项目越大启动越慢。

**参考答案要点:**
**Vite vs Webpack 的根本区别**：

**示例:**
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

**追问方向:**
- 为什么 Vite 生产环境用 Rollup 不用 esbuild？
- Vite 的 ESM 模式在旧浏览器怎么办？

---

### Q07.59【高·概念】Rsbuild（基于 Rspack）为什么比 Vite/Webpack 快？它的定位是什么？

**考察点:** Rspack 用 Rust 重写了 webpack 核心（兼容 webpack 生态），Rsbuild 是基于 Rspack 的开箱即用方案。比 Vite 快在：生产环境也极快（Vite 生产用 Rollup 较慢）；比 Webpack 快在：Rust 编译（多核并行、无 JS 开销）。定位：webpack 的性能替代品，迁移成本低。

**参考答案要点:**
**Rspack（字节出品）**：
- 用 **Rust** 重写 webpack 核心。
- 兼容 webpack 的 loader/plugin API，迁移成本低（webpack 配置几乎能直接用）。
- Rust 性能：多核并行、无 JIT 开销、内存安全，编译速度比 webpack 快 5-10 倍。

**示例:**
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

**追问方向:**
- Rspack 怎么做到兼容 webpack 的 loader/plugin？有兼容性坑吗？
- Rust 写的构建工具（Rspack/swc/esbuild）为什么比 JS 快这么多？
- Rsbuild 和 Turbopack（Vercel）有什么区别？

---

### Q07.60【高·高频·概念】CommonJS（CJS）和 ES Modules（ESM）有什么区别？为什么 ESM 是趋势？

**考察点:** CJS 用 require/module.exports（运行时加载、同步、可动态），ESM 用 import/export（编译时静态分析、异步、支持 tree-shaking）。ESM 是趋势因为：静态分析能力强（tree-shaking/优化）、官方标准、支持顶层 await、浏览器原生支持。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- Node.js 怎么区分一个文件是 CJS 还是 ESM？（package.json type / .mjs/.cjs）
- ESM 里怎么用 __dirname/__filename？（提示：import.meta.url）
- CJS 和 ESM 互操作（CJS 里 import ESM）有什么坑？

---

### Q07.61【高·概念】Webpack 的模块联邦（Module Federation）是什么？它和微前端是什么关系？

**考察点:** 模块联邦让多个独立打包的应用在运行时共享模块——一个应用 expose 暴露模块，另一个远程 consume 消费，无需重新打包。它本质是一种微前端实现方案（运行时集成独立应用），也可用于组件/库的动态共享。

**参考答案要点:**
**模块联邦核心概念**：

1. **Host（消费者）**：引用其他应用模块的应用。
2. **Remote（提供者）**：暴露模块给其他应用用的应用。
3. **运行时共享**：Host 启动时从 Remote 动态加载模块，不需要打包时静态引入。

**示例:**
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

**追问方向:**
- 模块联邦怎么处理共享依赖的版本冲突？
- 模块联邦和 qiankun 在微前端场景下各有什么优劣？
- remoteEntry.js 是怎么被加载和解析的？

---
