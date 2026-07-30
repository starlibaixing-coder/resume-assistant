# 模块 08：JS 原理

### Q08.62【中·高频·概念】JavaScript 中 `this` 的指向规则是什么？

**考察点:** `this` 在函数**调用时**才确定（动态），看「谁调用了函数」。5 种规则按优先级：默认绑定 < 隐式绑定 < 显式绑定(call/apply/bind) < new 绑定；箭头函数没有自己的 this，继承外层（静态，不受上述规则影响）。

**参考答案要点:**
**`this` 指向规则**（按优先级从低到高）：
1. **默认绑定**：独立函数调用，非严格模式 `this` 是 window/global，严格模式是 undefined。
2. **隐式绑定**：`obj.fn()`，`this` 指向 obj（谁调用指向谁）。注意隐式丢失：`var bar = obj.fn; bar()` 会丢成默认绑定。
3. **显式绑定**：`fn.call(obj)` / `fn.apply(obj)`，强行指定 this（见追问1）。
4. **new 绑定**：`new fn()`，this 指向新创建的对象（优先级最高之一）。
5. **箭头函数**：**没有自己的 this**，继承定义时外层的 this（静态，不可被 call/apply/bind 改变）。

**示例:**
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

**追问方向:**
- 箭头函数能用 call 改变 this 吗？为什么？（提示：没有自己的 this）
- bind 之后再用 new 调用，this 指向谁？（提示：new 优先级更高）

---

### Q08.63【中·高频·概念】什么是防抖（debounce）？它解决什么问题？

**考察点:** 防抖：事件频繁触发时，只在「最后一次触发后等一段时间」才执行——连续触发期间一直不执行。核心是「每次触发都清掉上一次的定时器，重新计时」。

**参考答案要点:**
**解决什么问题**：高频事件（input、resize、按钮连点）每秒触发几十上百次，直接执行会导致频繁请求/DOM 操作，卡顿。

**追问方向:**
- 防抖要不要支持「立即执行」版本？怎么实现？（提示：加 immediate 参数，首次触发立即执行，之后进入冷却）
- 节流（throttle）和防抖的区别是什么？（提示：节流是匀速执行，见 fe-js-007）

---

### Q08.64【中·高频·手写】请手写一个节流函数（throttle）。

**考察点:** 节流：固定时间间隔只执行一次，期间无视后续触发——匀速执行。和防抖（只执行最后一次）相反，节流保证「按固定节奏」执行。

**参考答案要点:**
**节流策略**：**保证固定节奏**。第一次触发立即执行，之后进入冷却期；冷却期内无视所有后续触发，冷却结束才允许下一次执行。

**示例:**
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

**追问方向:**
- 节流的时间戳版和定时器版各有什么短板？（提示：时间戳版漏末次，定时器版首次延迟）
- 怎么写一个「首尾都执行」的节流？（提示：时间戳判断 + 定时器兜底末次）
- 防抖和节流怎么选？（提示：看是否需要「过程中也响应」——要则节流，不要则防抖）
- requestAnimationFrame 和节流什么关系？（提示：rAF 相当于 ~16ms 的节流，且跟随刷新率）

---

### Q08.65【中·高频·概念】`Promise.all`、`Promise.race`、`Promise.allSettled`、`Promise.any` 这四个组合方法各自的行为和适用场景是什么？

**考察点:** 按「等不等全部完成 / 取成功还是失败」分：all 要全部成功，any 要一个成功，race 取最快不管成败，allSettled 等全部完成不管成败。

**参考答案要点:**
**四个方法的本质差异**（一张表记住）：

| 方法 | 成功条件 | 失败行为 | 适用场景 |
|---|---|---|---|
| `Promise.all` | **全部**成功 | 任一失败→整体失败（短路） | 多个请求都要成功才继续 |
| `Promise.any` | **任一**成功 | 全失败→整体失败 | 取最快的一个成功响应 |
| `Promise.race` | 第一个完成（**不论成败**） | 第一个若是失败→失败 | 超时控制、取最快响应 |
| `Promise.allSettled` | **全部完成**（不论成败） | 永不 reject，返回状态数组 | 批量执行后统一汇总结果 |

**示例:**
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

**追问方向:**
- 如何手写 Promise.all？遇到非 Promise 值怎么处理？（提示：用 Promise.resolve 包一层，按索引保证返回顺序）
- 如何手写 Promise.race？（提示：谁先 settle 谁就 resolve/reject 外层 Promise）
- Promise.all 中一个失败后，其他还在 pending 的 Promise 会取消吗？（提示：不会，Promise 无法取消，只是结果被丢弃）
- 为什么没有 `Promise.none` 或 `Promise.first`？实际怎么模拟？（提示：用 allSettled + filter）

---

### Q08.66【中·高频·概念】什么是 JavaScript 的作用域和作用域链？

**考察点:** 作用域是变量/函数的可访问范围（JS 用词法作用域，由代码书写位置决定）；作用域链是当前作用域→外层作用域→...→全局的层层查找路径；变量查找时从内层作用域开始，沿作用域链向外逐层找，找到即停，找不到报 ReferenceError；本质由执行上下文的变量对象（VO/AO）链构成。

**参考答案要点:**
**作用域（Scope）**：变量和函数的可访问范围。JS 是**词法作用域（静态作用域）**——作用域由代码书写位置决定，而非调用位置。

**示例:**
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

**追问方向:**
- 词法作用域和动态作用域的区别？this 是哪种？
- let/const 的块级作用域和 var 的函数作用域有什么本质区别？
- 作用域链和原型链有什么区别？（一个查变量，一个查属性）
- 闭包是怎么利用作用域链的？

---

### Q08.67【中·高频·概念】ES6 的 `class` 和传统构造函数+原型有什么区别？

**考察点:** class 本质是构造函数+原型的语法糖，但更严谨：调用必须用 new、方法默认不可枚举、有 static/extends/super 等清晰语法，让面向对象代码更易读易写，但底层原型机制没变。

**参考答案要点:**
**class vs 传统模式的核心区别**：

| 特性 | 传统构造函数 | ES6 class |
|---|---|---|
| 调用方式 | 可不用 new（结果异常） | **必须 new**，否则报错 |
| 方法定义 | `Person.prototype.say` | `say() {}` 写在 class 内 |
| 可枚举性 | 方法可枚举 | **方法默认不可枚举** |
| 继承 | 原型链/借用构造函数/组合 | `extends` + `super` |
| 静态方法 | `Person.static` | `static method()` |
| 语法 | 松散 | 集中、清晰 |

**示例:**
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

**追问方向:**
- class 的 `super()` 为什么必须在 constructor 第一行？
- class 的静态方法和实例方法在原型链上分别在哪？
- class 能实现多继承吗？mix-in 怎么做？
- 私有属性 `#field` 和传统闭包私有化比，有什么优势？

---

### Q08.68【中·高频·概念】箭头函数和普通函数有哪些区别？为什么箭头函数不能用作构造函数或方法？

**考察点:** 箭头函数四大区别：①没有自己的 this（继承外层词法 this）②没有 arguments（用剩余参数...args）③不能作构造函数（无 prototype、不能 new）④不能作 Generator（无 yield）；核心是箭头函数设计目标就是「轻量回调」，所以砍掉了 this 绑定等特性，适合纯函数/回调，不适合方法/构造函数。

**参考答案要点:**
**箭头函数 vs 普通函数的四大区别**：

**示例:**
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

**追问方向:**
- 箭头函数的 this 能用 call/apply/bind 改变吗？为什么？
- 对象方法用箭头函数有什么坑？（this 不指向实例）
- React 类组件为什么用箭头函数做事件处理？函数组件呢？
- 箭头函数和普通函数在性能上有差异吗？

---

### Q08.69【中·高频·手写】JavaScript 的深拷贝和浅拷贝有什么区别？

**考察点:** 浅拷贝只复制一层、嵌套对象仍共享引用；深拷贝递归复制所有层级、新旧完全独立，常用 JSON 序列化、structuredClone 或手写递归三种方案。

**参考答案要点:**
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

**追问方向:**
- structuredClone 为什么不能克隆函数？设计原因？
- WeakMap 和 Map 的区别？为什么深拷贝用 WeakMap？
- 如何拷贝一个包含 Symbol 键的对象？
- Immutable.js 的持久化数据结构和深拷贝有什么不同？

---

### Q08.70【高·高频·手写】手写 `new` 操作符的实现。`new` 做了哪些事？

**考察点:** `new` 做四件事：①创建空对象 ②链接原型（指向构造函数的 prototype）③绑定 this 执行构造函数 ④若构造函数返回对象则用它，否则返回新对象。

**参考答案要点:**
**`new Foo(...)` 的四步**：
1. **创建对象**：`const obj = {}`，一块新的内存。
2. **绑定原型**：`obj.__proto__ = Foo.prototype`，让新对象能访问原型链上的方法。这是「实例能共享构造函数原型方法」的关键。
3. **改变 this 执行**：`const result = Foo.apply(obj, args)`，构造函数里的 `this` 指向新对象，给新对象添加属性。
4. **处理返回值**：如果构造函数显式 `return` 了一个**对象**（或函数），则用那个返回值；否则返回新创建的 obj。

**示例:**
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

**追问方向:**
- 如果构造函数 return 一个基本类型（如 return 1），new 的结果会变吗？（提示：不变，仍返回 obj）
- `Object.create(Constructor.prototype)` 和 `obj.__proto__ = ...` 有什么区别？（提示：前者更安全，不依赖已废弃的 __proto__）
- class 的 new 和构造函数的 new 底层一样吗？

---

### Q08.71【高·高频·概念】请讲清楚 JavaScript 的原型和原型链。

**考察点:** 原型（prototype）是函数的一个属性，指向一个原型对象；实例通过 `__proto__` 指向构造函数的 prototype，从而能访问原型上的方法。原型链是访问属性时沿 `__proto__` 一路向上查找的路径，直到找到或到顶（null）。

**参考答案要点:**
**原型（Prototype）**：每个函数都有一个 `prototype` 属性，指向它的原型对象。通过 `new Fn()` 创建的实例，有一个 `__proto__`（即 `[[Prototype]]`）指向 `Fn.prototype`，所以实例能访问原型上的方法和属性（方法复用）。

**示例:**
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

**追问方向:**
- 箭头函数有 prototype 吗？（提示：没有，不能作为构造函数）
- ES6 class 的 extends 底层是怎么实现原型链继承的？
- `instanceof` 的原理是什么？它和原型链什么关系？（提示：沿 __proto__ 查找右侧的 prototype）
- 为什么 `Object.create(null)` 创建的对象「最干净」？（提示：没有原型链上的方法）

---

### Q08.72【高·高频·概念】Promise 的 `.then(onFulfilled, onRejected)` 和 `.catch()` 有什么区别？为什么推荐用 `.catch`？

**考察点:** `.catch()` 等价于 `.then(null, onRejected)`，但它能捕获**整条链**上前面抛的错误（reject + 同步异常）；而 `.then` 的第二参数 onRejected 只能捕获前一个 Promise 的 reject，抓不到 onFulfilled 里抛的错。所以 `.catch` 更全面，推荐用 `.catch`。

**参考答案要点:**
**`.catch` 比 `.then` 第二参数更强的关键点**：
- `.then(onFulfilled, onRejected)` 的 onRejected **只捕获前一个 Promise 的 reject**，捕获不到**同个 then 里 onFulfilled 抛出的同步错误**。
- `.catch()` 能捕获**它之前整条链**上的所有错误（reject + 抛出的异常），因为 `.catch()` 本质是 `.then(null, onRejected)`，挂在了链的后端。

**示例:**
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

**追问方向:**
- Promise 的状态一旦改变还能再变吗？（提示：不可逆，pending→fulfilled/rejected 是终态）
- async/await 里怎么捕获 reject？（提示：用 try/catch 包住 await，更同步化）
- 如果一个 Promise 链没有任何 `.catch`，未捕获的 rejection 会怎样？（提示：触发 unhandledrejection 事件，Node 会警告/退出）
- `.catch` 之后还能继续 `.then` 吗？catch 之后的链是什么状态？（提示：能，catch 返回 fulfilled 的 Promise）

---

### Q08.73【高·高频·概念】什么是「闭包（Closure）」？

**考察点:** 闭包是函数与其词法环境（外层作用域）的组合——内部函数引用了外部函数的变量，就形成了闭包；本质是作用域链的延伸。

**参考答案要点:**
**闭包的定义**：函数与其词法环境（外层作用域）的组合。当一个内部函数引用了外部函数的变量，就形成了闭包。

**示例:**
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

**追问方向:**
- 箭头函数的闭包和普通函数有什么不同？（this 绑定）

---

### Q08.74【高·高频·概念】JavaScript 的「迭代器（Iterator）」和「生成器（Generator）」是什么？

**考察点:** 迭代器是实现 next() 方法返回 {value, done} 的对象；生成器是 function* + yield 定义的函数，调用返回一个迭代器，能暂停执行。Generator 是创建迭代器的便捷方式，用于惰性求值、异步流程控制。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- 为什么普通对象不能 for...of？怎么让它可迭代？
- Generator 怎么做异步流程控制？（co 库原理）
- async/await 和 Generator 是什么关系？
- yield* 是什么？委托生成器？

---

### Q08.75【高·高频·手写】什么是「函数柯里化（Currying）」和「偏函数（Partial Application）」？

**考察点:** 柯里化是把多参数函数转成一连串单参数函数（f(a,b,c) → f(a)(b)(c)），参数够了才执行；偏函数是预先固定部分参数返回新函数（f(a,b,c) → f(a)→新函数等b,c）；手写 curry 核心是递归收集参数，长度够了调原函数；应用：参数复用、延迟执行、函数组合；柯里化是偏函数的极端形式（每次只传一个参数）。

**参考答案要点:**
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

**追问方向:**
- curry 函数里的 fn.length 是什么？为什么能靠它判断参数够不够？
- 柯里化和 async/await 的链式调用有什么本质不同？
- 函数式编程里的 compose/pipe 和柯里化怎么配合？
- lodash 的 _.curry 和手写的有什么增强？(placeholder)

---

### Q08.76【高·高频·概念】JavaScript 的「内存泄漏」和「内存溢出」有什么区别？

**考察点:** 内存泄漏是「该回收的没回收」（变量被意外引用导致 GC 无法回收，长期累积）；内存溢出是「分配时内存不够」（运行时申请超可用内存直接报错崩溃）。内存泄漏长期累积，最终可能导致内存溢出。

**参考答案要点:**
**内存泄漏 vs 内存溢出**：
- **内存泄漏（Memory Leak）**：程序中已不用的内存（变量/对象）因为仍被引用，垃圾回收无法回收，长期占用。累积导致可用内存越来越少。
- **内存溢出（Out of Memory, OOM）**：程序运行时申请的内存超过了可用内存，直接报错崩溃。
- **关系**：内存泄漏长期累积，最终可能导致内存溢出。

**示例:**
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

**追问方向:**
- WeakMap/WeakSet 为什么能避免泄漏？和 Map/Set 的区别？
- Vue/React 组件销毁时常见的泄漏有哪些？
- 标记-清除算法具体怎么工作？相比引用计数有什么优势？

---
