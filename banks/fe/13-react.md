# 模块 13：React

### Q13.97【初·高频·概念】项目中常用的 React Hook 有哪些？各自的使用场景和注意事项是什么？

**考察点:** 常用 Hook：`useState`(状态)、`useEffect`(副作用)、`useRef`(可变值/DOM引用)、`useMemo`(缓存计算结果)、`useCallback`(缓存函数引用)、`useContext`(跨层传值)、`useReducer`(复杂状态)。核心原则：按需用，别过度 memo。

**参考答案要点:**
| Hook | 用途 | 关键注意 |
|---|---|---|
| useState | 基础状态 | setState 是异步批处理；函数式更新 `setX(prev => prev+1)` 避免闭包旧值 |
| useEffect | 副作用（请求、订阅、定时器） | 依赖数组必须写全；清理函数 return；空数组只跑一次 |
| useRef | 存可变值不触发重渲染 / 获取 DOM | 改 `.current` 不重渲染；不要在渲染中读写 |
| useMemo | 缓存昂贵计算结果 | 别滥用，缓存本身有开销；依赖变化才重算 |
| useCallback | 缓存函数引用（传给子组件防重渲染） | 配合 React.memo 才有意义 |
| useContext | 消费 Context，跨层共享 | Context 值变化会让所有消费者重渲染 |
| useReducer | 复杂状态（多字段联动） | 替代多个 useState，逻辑集中 |

**示例:**
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

**追问方向:**
- useMemo 和 useCallback 的关系？（提示：useCallback(fn, dep) === useMemo(() => fn, dep)）
- useEffect 的依赖数组写错会有什么后果？
- 什么时候该用 useReducer 而不是 useState？（提示：状态多、转换逻辑复杂、下一个状态依赖前一个）

---

### Q13.98【中·高频·概念】`useEffect` 和 `useLayoutEffect` 有什么区别？分别在什么场景下使用？

**考察点:** `useEffect` 在浏览器**绘制之后**异步执行（不阻塞页面）；`useLayoutEffect` 在 DOM 变更后、绘制前**同步**执行（阻塞绘制）。绝大多数副作用用 useEffect，只有会引起「视觉闪烁」的 DOM 测量/布局操作才用 useLayoutEffect。

**参考答案要点:**
**执行时机对比**（一次渲染的生命周期）：
```
state 变化 → React 计算 VDOM → 提交到真实 DOM
         → useLayoutEffect 同步执行（此时还没绘制，可读 DOM 尺寸）
         → 浏览器绘制画面
         → useEffect 异步执行（用户已经看到画面了）
```

**示例:**
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

**追问方向:**
- useEffect 的清除函数（return）在什么时机执行？（提示：下次 effect 执行前 + 组件卸载时）
- useLayoutEffect 里调用 setState 会怎样？（提示：会在浏览器绘制前再触发一次同步渲染）
- 如何在 SSR 中安全使用 useLayoutEffect而不报警告？

---

### Q13.99【中·高频·概念】React Hook 相比 Class 组件有哪些优势？为什么 React 团队要推 Hook？

**考察点:** Hook 解决了 Class 的三大痛点：①**逻辑复用难**（HOC/渲染 props 嵌套地狱）→ 自定义 Hook 直接复用；②**生命周期拆散相关逻辑**（同一逻辑分散在 didMount/didUpdate/willUnmount）→ useEffect 聚合；③**this 指向和绑定心智负担重**。Hook 让函数组件也能有 state 和副作用，代码更简洁。

**参考答案要点:**
**Class 组件的三大痛点**：
1. **逻辑复用难**：早期复用状态逻辑只能靠 HOC（高阶组件）或 render props，结果是组件树层层嵌套（「wrapper hell」），调试时 React DevTools 里一长串匿名组件。
2. **生命周期割裂相关逻辑**：比如「订阅 + 取消订阅」要拆到 `componentDidMount` 和 `componentWillUnmount`，而「订阅依赖 id 变化时重新订阅」又要加 `componentDidUpdate` 比较 props——一个完整逻辑被切到三个地方，难维护。
3. **this 麻烦**：事件处理函数要手动 `bind(this)` 或用箭头函数，初学者经常踩 `this is undefined` 的坑。

**示例:**
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

**追问方向:**
- 为什么自定义 Hook 能复用，但 state 不会互相干扰？（提示：每个组件独立 fiber，独立 hook 链表）
- Hook 能完全替代 Class 吗？哪些场景还必须用 Class？（提示：React 19 前 error boundary）
- 为什么 Hook 不能在 if 里调用？

---

### Q13.100【中·高频·概念】`useRef` 有哪些使用场景？

**考察点:** `useRef` 两大用途：①**获取 DOM 元素引用**（focus、测量尺寸、播放媒体）；②**存放不触发重渲染的可变值**（定时器 id、上次值、缓存）。它返回一个 `{ current: 初始值 }` 对象，整个组件生命周期里引用稳定，改 `.current` 不触发重渲染。

**参考答案要点:**
**useRef 返回什么**：一个 `{ current: 初始值 }` 对象，整个组件生命周期里**始终是同一个对象**（引用稳定），改 `.current` 不会触发重渲染。

**示例:**
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

**追问方向:**
- 为什么 useRef 改了不重渲染？底层 ref 对象存在哪？（提示：存在 fiber 的 hook 链表，不触发 scheduleUpdate）
- useEffect 里读写 ref 安全吗？useLayoutEffect 呢？
- React 19 里 ref 作为 prop 传递，forwardRef 还需要吗？

---

### Q13.101【中·高频·概念】React Router 的原理是什么？`history` 模式和 `hash` 模式有什么区别？

**考察点:** React Router 监听 URL 变化→匹配路由→渲染组件，全程不刷新页面。hash 模式靠 `hashchange` 事件、URL 带 # 但无需后端配置；history 模式靠 `pushState/popstate`、URL 干净但刷新需后端回退到 index.html。

**参考答案要点:**
**前端路由的本质**：监听 URL 变化 → 改变视图，不向服务器发请求。

**示例:**
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

**追问方向:**
- history 模式刷新 404 怎么解决？后端怎么配？
- React Router v6 相比 v5 有哪些变化？
- 如何实现路由懒加载？

---

### Q13.102【中·高频·概念】React Context 的使用场景是什么？

**考察点:** Context 用于**跨多层组件共享数据**（主题、用户信息、国际化、路由），免去逐层 prop 透传（prop drilling）。

**参考答案要点:**
**什么时候用 Context**：
- 全局/半全局数据：主题（dark/light）、当前用户、i18n 语言包、路由状态、UI 配置。
- 数据变化频率不高、消费组件不多。

**示例:**
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

**追问方向:**
- Context 和 Redux/Zustand 的本质区别？（提示：Context 是依赖注入机制，不是状态管理库）

---

### Q13.103【中·高频·概念】React 列表渲染时 `key` 的作用是什么？默认行为是什么？

**考察点:** `key` 是 React diff 列表时识别元素身份的标识——帮助 React 判断「这个节点是移动了还是新建了」，从而复用 DOM、减少重渲染。没写 key 默认用数组 index 匹配，遇到列表增删会导致后续元素错位重渲染。key 必须稳定、唯一。

**参考答案要点:**
**key 的作用**：在 reconcile 阶段，React 对比新旧 children 列表时，靠 key 把新列表的元素和旧列表的元素对应起来。有 key 才能判断「A 元素从位置 3 移到了位置 0」，于是只移动 DOM 节点而不是销毁重建。

**示例:**
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

**追问方向:**
- 用 Math.random() 做 key 会怎样？为什么？（提示：每次渲染 key 变 → 全部重建）
- key 必须全局唯一吗？（提示：不需要，只需兄弟节点间唯一）
- 删除列表中间一项，有 key 和无 key 分别发生什么？（提示：有 key 只删一个 DOM，无 key 全部重渲染）

---

### Q13.104【高·高频·概念】React 19 有哪些重要新特性？项目中如何使用？

**考察点:** React 19 三大类特性：①**Actions**（`useTransition` + 异步表单，自动处理 pending/error）；②新 hooks（`use`、`useActionState`、`useFormStatus`、`useOptimistic`、`use`）；③编译器（React Compiler 自动 memo，不用手写 useMemo/useCallback）；外加 ref 作为 prop、Document Metadata、Server Components 稳定。

**参考答案要点:**
**1. Actions（异步动作）**：把异步操作（提交表单、请求接口）用 `useTransition` 包裹，自动给 pending 状态、错误处理、乐观更新。

**示例:**
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

**追问方向:**
- React Compiler 开启后，是不是就完全不用写 useMemo/useCallback 了？（提示：少数复杂计算仍需）
- useOptimistic 失败后状态如何回滚？（提示：重新渲染用真实 state 覆盖）
- Server Components 在 React 19 是 stable 了吗？和 Client Component 怎么区分？

---

### Q13.105【高·高频·概念】React 的 diff 算法是怎么工作的？

**考察点:** React diff 基于**三个假设**把树对比从 O(n³) 降到 O(n)：①同层 diff（跨层级移动直接丢弃重建）；②同类型才 diff（不同类型直接替换整棵子树）；③靠 `key` 标识同层列表元素。

**参考答案要点:**
**为什么需要 diff**：状态变化后 React 拿到新 VDOM，要和旧 VDOM 对比，找出最小变更再去更新真实 DOM。朴素对比两棵树是 O(n³)，工程不可用。

**示例:**
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

**追问方向:**
- 用 index 做 key 会出什么问题？什么时候用 index 做 key 反而 OK？（提示：纯展示、无增删、无受控 state）
- 为什么跨层级移动不复用？（提示：复用成本高于重建，且场景罕见）
- Vue 的 diff 和 React 的 diff 有何区别？（提示：Vue3 双端 diff + 最长递增子序列优化移动）

---

### Q13.106【高·高频·概念】什么是 React 的合成事件（SyntheticEvent）？为什么不直接用原生事件？

**考察点:** 合成事件是 React 对浏览器原生事件的**跨浏览器封装**，提供统一 API 和属性。React 不在 DOM 节点上直接绑定事件，而是在根容器上挂一个**统一的事件委托监听器**，事件冒泡到根时再按映射找到对应组件的回调执行——省内存、性能好、能统一兼容处理。

**参考答案要点:**
**为什么不直接用原生事件**：
1. **浏览器兼容性**：IE 和 Chrome 事件对象差异大（`e.target` vs `e.srcElement`、阻止默认行为 API 不同），合成事件抹平这些差异。
2. **性能（事件委托）**：原生事件每个元素每个事件都要 addEventListener 一个监听器，列表 1000 项就有 1000 个监听器，内存大。React 只在根上挂一个，通过事件委托统一处理。
3. **统一的事件流控制**：React 能在合成事件层实现自己的「事件优先级」（discrete/continuous）、与 fiber 调度整合、批处理 setState。
4. **更安全**：合成事件对象是池化的（React 16 及以前），避免每次创建对象的开销（React 17 移除了事件池）。

**示例:**
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

**追问方向:**
- React 16 的合成事件对象池（event pooling）是什么？为什么 17 移除了？（提示：异步访问 e.target 为 null 的坑）
- 原生事件里的 setState 和合成事件里的 setState 有什么区别？（提示：React 18 后都是批处理）
- 如果想阻止合成事件冒泡到原生 document，怎么做？

---

### Q13.107【高·概念】在 React Router 中如何实现页面切换动画？

**考察点:** 用 `react-transition-group` 的 `<CSSTransition>` 或 framer-motion 的 `<AnimatePresence>`，关键是把路由的 `location.key`/`location.pathname` 作为列表项 key，让旧组件退场、新组件进场。

**参考答案要点:**
**核心难点**：路由切换时，旧组件直接卸载、新组件直接挂载，默认没有过渡。要做动画，必须让「旧组件还能存活一小段时间执行退场动画」。

**示例:**
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

**追问方向:**
- 为什么要把 location 传给 Routes？不传会怎样？
- mode="wait" 和默认模式有什么区别？
- 不用第三方库，纯 CSS transition 怎么做路由动画？

---

### Q13.108【高·高频·手写】React 中异步请求的竞态条件（Race Condition）是什么？

**考察点:** 竞态条件：先发的慢请求后返回，覆盖了后发的快请求结果，UI 显示「过时」数据。

**参考答案要点:**
**什么是竞态**：用户快速切换 id（1→2→3），三次请求发出。若请求 1 最慢，最后返回，它的结果会覆盖最新的请求 3 的结果，UI 显示了 id=1 的数据，但当前页是 id=3——数据错乱。

**追问方向:**
- useEffect 的 cleanup 执行时机是什么？（提示：下次 effect 执行前 + 卸载时）

---

### Q13.109【高·高频·手写】请手写一个简化版的 `useState`。

**考察点:** 简化版 useState 用「**模块级变量 + hook 链表索引**」模拟：把 state 存在 fiber 的链表节点上，setState 把更新 push 到队列，下次渲染时按队列算新值。

**参考答案要点:**
**简化版实现要点**：
1. 用一个模块级变量 `state`（或链表节点）+ `index` 指针。
2. useState 首次调用初始化 state，后续调用读已有值，然后 index++。
3. setState 把新值/更新函数记下来，标记组件需要重渲染。
4. 重渲染时 index 归零，重新按顺序读。

**示例:**
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

**追问方向:**
- useState 的初始值传函数 `useState(() => init())` 有什么好处？（提示：惰性初始化，避免每次渲染都跑）

---

### Q13.110【高·高频·概念】对比 Redux、Zustand、MobX 三种状态管理方案，它们的核心思想和适用场景有什么不同？

**考察点:** Redux=不可变+纯函数reducer+单一store，强约束可回溯，适合大型项目；Zustand=极简，基于 useSyncExternalStore 精准订阅，灵活轻量；MobX=可变数据+Proxy自动追踪依赖，写法像普通对象全自动响应。

**参考答案要点:**
**Redux 核心思想**：
- 单一全局 store，state 不可变（每次返回新对象）。
- `reducer(state, action) => newState` 纯函数。
- 通过 `dispatch(action)` 触发，所有变化可追溯（时间旅行）。
- 缺点：样板代码多（action/reducer/types）、异步要 middleware。
- 性能：需手写 selector（reselect）避免不必要渲染。

**示例:**
| 维度 | Redux | Zustand | MobX |
|---|---|---|---|
| 状态变更 | 不可变+reducer | 可变 setState | 可变(自动响应) |
| 响应式 | 手动 selector | useSyncExternalStore | Proxy 依赖追踪 |
| 样板量 | 多 | 极少 | 少 |
| 适合 | 大型可追溯 | 中小型灵活 | 中小型数据驱动 |

**追问方向:**
- 为什么 Zustand 不像 Redux 强调不可变？（见 fe-react-018）
- MobX 的响应式和 Vue 有什么关系？（见 fe-react-019）
- 什么时候该用 Context 而不是状态管理库？

---

### Q13.111【高·高频·概念】Zustand 是如何工作的？

**考察点:** Zustand 的 store 本质是个带 `subscribe/getSnapshot` 的普通对象，用 React 18 的 `useSyncExternalStore` 让组件订阅；setState 时遍历所有订阅者，逐个跑 selector 比对，决定谁要更新。

**参考答案要点:**
**工作原理**：
- `create((set,get)=>({...}))` 返回一个 hook，内部维护 state + 订阅者列表。
- 组件调 `useStore(s => s.count)` 时，底层走 `useSyncExternalStore(subscribe, getSnapshot)`。
- `setState` 时遍历所有订阅者，逐个跑 selector 比对，决定谁要更新。

**追问方向:**
- Object.is 比 === 有什么区别？为什么用它做比较？（提示：区分 +0/-0、NaN）
- 多个 selector 组合怎么避免重复渲染？（提示：shallow 比较）

---

### Q13.112【高·高频·概念】React 做了哪些性能优化？开发者层面有哪些常用优化手段？

**考察点:** React 性能优化分两层：框架层（Fiber 可中断渲染、并发渲染、自动批处理、diff 算法）和开发者层（React.memo 避免子组件重渲染、useMemo/useCallback 缓存值和函数、虚拟化长列表、路由/组件懒加载、合理用 key、状态下沉/拆分）；核心思想是「减少不必要的渲染」和「减少渲染的成本」。

**参考答案要点:**
React 性能优化可分**框架内置**和**开发者手段**两层：

**示例:**
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

**追问方向:**
- React.memo 的浅比较有什么局限？怎么自定义比较？
- useMemo/useCallback 滥用会有什么问题？（记忆本身有成本）
- useTransition 和 useDeferredValue 有什么区别？
- React Profiler 怎么看哪个组件渲染慢？

---

### Q13.113【高·高频·概念】React Hook 的实现原理是什么？

**考察点:** Hook 的实现核心是**函数组件 fiber 上的单向链表**：每次渲染时按调用顺序把每个 Hook 串成链表节点挂在 fiber 上。React 靠「调用顺序」定位每个 Hook 对应的 state。

**参考答案要点:**
**数据结构**：每个函数组件对应的 fiber 节点上有个 `memoizedState` 字段，指向一条**单向链表**。链表每个节点对应一次 Hook 调用：
```
fiber.memoizedState → Hook0(useState) → Hook1(useEffect) → Hook2(useMemo) → null
                       {memoizedState, next} ...
```

**追问方向:**
- useEffect 和 useState 在链表节点里存的数据结构有何不同？（提示：useState 存 state+queue，useEffect 存 effect 对象+依赖）
- 为什么自定义 Hook 不会产生新的链表节点？（提示：自定义 Hook 内部的 Hook 仍归属宿主组件）
- useMemo 的依赖数组是怎么和链表节点关联的？（提示：存在 hook 节点上，下次渲染比较决定是否重算）

---

### Q13.114【高·高频·概念】什么是 React Fiber 架构？为什么需要它？

**考察点:** Fiber 是 React 16 引入的**新协调架构**：把组件树重写成可中断、可恢复的链表结构（每个组件一个 fiber 节点），渲染过程被拆成无数小任务（fiber unit of work），可以被浏览器事件（用户输入）打断，让高优先级更新插队，从而保证动画和交互流畅。

**参考答案要点:**
**为什么需要 Fiber（要解决的问题）**：
React 15（Stack Reconciler）的渲染是**同步递归**的——一旦开始 reconcile 一棵大树，必须一口气跑完才能让出主线程。大树更新可能占用主线程几百毫秒，期间动画掉帧、用户点击无响应（卡顿）。

**追问方向:**
- 为什么 commit 阶段不能中断？（提示：DOM 操作必须一致，否则 UI 闪烁）
- 双缓冲（current/workInProgress）解决了什么问题？

---

### Q13.115【高·概念】React 的更新调度策略（Lane Model）是怎样的？不同更新的优先级如何区分？

**考察点:** Lane Model 是 React 18 引入的**优先级模型**：用 32 位二进制表示一组「车道（lane）」，每个 lane 代表一种优先级。更新被挂到对应优先级的 lane 上，Scheduler 按优先级调度——高优先级（用户输入、离散事件）插队，低优先级（数据加载、transition）延后，让交互流畅。

**参考答案要点:**
**优先级演进**：React 15 无优先级（同步）；React 16 expirationTime（单一数值，粒度粗）；React 18 改成 **Lane Model**（位运算，可批量、可重叠）。

**示例:**
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

**追问方向:**
- React 18 的 Automatic Batching 和 lane 有什么关系？
- startTransition 标记的更新被打断后，之前的计算结果会丢吗？（提示：会，需要重跑，但 React 会尽量复用）
- lane 用 31 位有什么限制？为什么不直接用数组存优先级？（提示：位运算 O(1)，数组开销大）

---

### Q13.116【高·高频·概念】MobX 的响应式原理是什么？

**考察点:** MobX 用 Proxy（或旧版 defineProperty）把数据变成可观察值；组件 render 时访问这些属性会自动注册依赖；属性变化时 MobX 通知所有依赖它的组件重渲染——全自动追踪，无需手动订阅。

**参考答案要点:**
**三步响应式机制**：
1. **可观察化（Observable）**：`makeAutoObservable(this)` 用 Proxy 拦截对象属性的 get/set。读属性时收集「谁在读」，写属性时通知「读过的那些人」。
2. **依赖收集（组件 render 时）**：`observer(Component)` 包裹的组件，每次 render 时 MobX 在全局维护一个「当前正在执行的 reaction」。组件访问 `store.count` 时，Proxy 的 get 拦截器把这个属性记到当前 reaction 的依赖列表里。
3. **触发更新（数据变化时）**：当 `store.count` 被 set，Proxy 拦截到变化，查找依赖该属性的 reaction 列表，逐个标记为 dirty → 触发组件重渲染。

**示例:**
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

**追问方向:**
- makeAutoObservable 和 makeObservable 有什么区别？装饰器怎么用？

---
