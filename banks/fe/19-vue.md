# 模块 19：Vue

### Q19.132【中·高频·概念】Vue 的响应式原理是什么？Vue 2（defineProperty）和 Vue 3（Proxy）有什么区别？

**考察点:** Vue 响应式靠「数据劫持 + 依赖收集 + 派发更新」：读数据时收集谁依赖它，改数据时通知这些依赖更新。Vue2 用 defineProperty 逐属性劫持（需递归、监听不了数组/新增属性）；Vue3 用 Proxy 代理整个对象（一次性、能监听增删、数组、性能更好）。

**参考答案要点:**
**响应式三步走**：
1. **数据劫持**：拦截对数据的读写。
2. **依赖收集（读时）**：组件 render 时访问了哪些数据，把这些数据→组件的依赖关系记下来。
3. **派发更新（写时）**：数据被修改时，通知所有依赖它的组件重新渲染。

**示例:**
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

**追问方向:**
- Vue3 的 ref 和 reactive 有什么区别？为什么要两个？
- Proxy 能监听不了什么？（提示：原始值要用 ref 包装）
- Vue 的依赖收集和 MobX 的有什么异同？

---

### Q19.133【中·概念】Vue 的虚拟 DOM 和编译优化是什么？Vue 3 的编译时优化比 Vue 2 强在哪？

**考察点:** Vue 用虚拟 DOM 描述 UI，数据变→生成新 vnode→diff 出最小变更→更新真实 DOM。Vue3 的突破是「编译时优化」：编译器分析模板，给静态节点打标记、给动态节点加 patchFlag，diff 时跳过静态部分，比 Vue2 的全量 diff 快很多。

**参考答案要点:**
**虚拟 DOM 流程**：
1. 数据变 → 重新渲染生成新的虚拟 DOM 树（vnode）。
2. 新旧 vnode 对比（diff）→ 找出差异。
3. 只把差异部分更新到真实 DOM。

**示例:**
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

**追问方向:**
- Vue3 的 Block tree 是怎么收集动态节点的？
- 为什么 React 不做编译时优化？（提示：JSX 运行时才知道结构）
- 虚拟 DOM 一定比直接操作 DOM 快吗？什么情况反而慢？

---

### Q19.134【高·高频·概念】Vue 和 React 的核心区别是什么？从响应式机制、数据流、设计理念对比。

**考察点:** Vue 是「响应式驱动」（数据变自动更新，mutable）+ 编译优化模板；React 是「状态驱动重新渲染」（setState 触发全组件重渲染，immutable）+ JSX 运行时 diff。Vue 更自动化、上手快；React 更灵活、可控、生态大。

**参考答案要点:**
**核心区别对比**：

| 维度 | Vue | React |
|---|---|---|
| 响应式 | 数据变→自动精确更新（Proxy 追踪） | setState→组件重渲染（不可变） |
| 数据修改 | 可变（直接赋值，响应式系统追踪） | 不可变（必须新对象触发更新） |
| 视图描述 | 模板（编译时优化） | JSX（运行时，更灵活） |
| 组件更新 | 精确到属性（响应式追踪） | 整组件重渲染（靠 memo/selector 优化） |
| 数据流 | 双向绑定（v-model，语法糖） | 单向（onChange + setState） |
| 学习曲线 | 低（约定优于配置） | 中（更底层、概念少但灵活） |

**示例:**
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

**追问方向:**
- Vue 的双向绑定（v-model）和 React 受控组件本质上一样吗？
- 为什么 Vue 用模板而 React 用 JSX？各有什么取舍？
- Composition API 是不是在学 React Hooks？有什么不同？

---

### Q19.135【高·高频·概念】Vue 3 的 Composition API 相比 Options API 解决了什么问题？

**考察点:** Composition API 解决 Options API「相关逻辑分散在不同选项（data/methods/computed）」的碎片化问题，让同一功能的逻辑聚合到一个函数，便于复用和维护。

**参考答案要点:**
**Options API 的痛点**：
同一个功能（如「搜索」）的逻辑被拆散：状态在 data、方法在 methods、计算在 computed、监听在 watch。功能一多，代码在不同选项间跳来跳去，难维护、难复用。

**示例:**
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

**追问方向:**
- Vue 的 ref 为什么需要 .value？有没有不用写 .value 的方案？
- Composition API 完全替代 Options API 了吗？老项目要迁移吗？

---
