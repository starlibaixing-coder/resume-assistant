# 模块 18：TypeScript

### Q18.129【中·高频·概念】TypeScript 是怎么编译成 JavaScript 的？用 babel 处理 TS 和用 tsc 有什么区别？

**考察点:** TS 编译本质是「类型擦除」——把类型注解去掉，剩下的就是 JS。tsc（TS 编译器）既做类型检查又做转译；babel 只做转译（@babel/preset-typescript 擦除类型），不做类型检查，要靠编辑器或单独跑 tsc --noEmit 检查。现代项目多 babel/swc 转译 + tsc 类型检查。

**参考答案要点:**
**TS 编译的本质：类型擦除**：
- TS = JS + 类型注解。
- 编译时，类型注解（如 `: string`、`interface`、`type`）被全部移除，剩下的就是合法 JS。
- 运行时没有任何类型信息（这正是 TS 是「编译时类型」的原因）。

**示例:**
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

**追问方向:**
- 为什么 babel 不做类型检查？这样设计有什么好处？
- TS 的 enum 编译后是什么？（不是简单擦除）
- 怎么在运行时保留类型信息（如校验 API 返回的数据结构）？（提示：zod/io-ts 运行时校验库）

---

### Q18.130【高·高频·概念】TypeScript 的 `Record<K, T>` 是怎么实现的？

**考察点:** Record<K,T> 本质是 `type Record<K extends keyof any, T> = { [P in K]: T }`，用映射类型把 K 的每个键映射成 T 类型值。用于快速构造「键是 K、值是 T」的对象类型。

**参考答案要点:**
**Record 的实现**：
```typescript
type Record<K extends keyof any, T> = { [P in K]: T };
```
- `K extends keyof any`：K 必须是合法的键类型（string | number | symbol）。
- `{ [P in K]: T }`：映射类型，遍历 K 的每个键 P，定义为 T 类型。
- 例子：`Record<'a'|'b', number>` = `{ a: number; b: number }`。

**追问方向:**
- Pick/Omit/Partial/Required 这些工具类型分别怎么实现？
- 映射类型 `[P in K]` 和索引签名 `[key: string]` 有什么区别？

---

### Q18.131【高·概念】TypeScript 的泛型和条件类型（Conditional Types）怎么用？举几个实际场景。

**考察点:** 泛型是「类型的参数」——让类型可复用、可推导（function identity<T>(x:T):T）。条件类型是「类型层面的 if-else」——`T extends U ? X : Y`，根据类型关系选不同类型。两者结合能写出强大的工具类型（Awaited/ReturnType/Exclude/Extract）。

**参考答案要点:**
**泛型（Generics）**：
- 类型的参数，让函数/接口/类能适用于多种类型，且保持类型关联。
- 例子：`function identity<T>(x: T): T` —— 传什么类型返回什么类型，T 关联输入输出。
- 常见场景：数组 `Array<T>`、Promise `Promise<T>`、API 请求返回值 `request<T>(): Promise<T>`。

**示例:**
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

**追问方向:**
- infer 关键字具体怎么用？什么场景？
- 映射类型 + 条件类型能实现什么（如 keyof + in）？
- 泛型约束（extends）怎么限制泛型范围？

---
