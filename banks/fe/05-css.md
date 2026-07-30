# 模块 05：CSS

### Q05.40【初·高频·概念】CSS 盒模型有哪几种？`box-sizing` 的作用是什么？两种盒模型的区别是什么？

**考察点:** 盒模型分标准盒模型（content-box，默认）和怪异盒模型（border-box）。前者 width 只含内容，后者 width 包含内容+padding+border，开发中几乎都用 border-box。

**参考答案要点:**
盒模型由内到外四部分：**content（内容）、padding（内边距）、border（边框）、margin（外边距）**。

两种模型的区别就在 `width` 到底算哪部分：

| 模型 | box-sizing | width 包含 | 加 padding 后盒子的实际占地宽度 |
|---|---|---|---|
| 标准盒模型（默认） | content-box | 仅 content | width + padding + border，盒子被撑大 |
| 怪异盒模型 | border-box | content+padding+border | 不变，padding 从 content 里扣 |

**示例:**
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

**追问方向:**
- `outline`（轮廓）算在盒模型里吗？它和 border 有什么区别？（提示：outline 不占布局空间）
- 相邻块级元素的 margin 为什么会「折叠」？折叠规则是什么？
- inline 元素的 padding/margin 在垂直方向上表现有什么不同？

---

### Q05.41【中·高频·概念】CSS 选择器的优先级（specificity）如何计算？`!important` 在其中起什么作用？

**考察点:** 优先级按 (行内样式, ID, 类/属性/伪类, 元素/伪元素) 四级比较，从左到右高位大的胜出；同级则后写的覆盖先写的；`!important` 凌驾于所有规则之上但应慎用。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- 两个 `!important` 规则冲突时谁赢？（提示：再回到 specificity 比较）
- 继承来的样式优先级是多少？（提示：比通配符还低，会被任意直接规则覆盖）
- `:not()`、`:is()`、`:where()` 对优先级有什么影响？（提示：:where() 永远是 0）

---

### Q05.42【中·高频·概念】CSS `position` 的五个取值（static/relative/absolute/fixed/sticky）各有什么区别？

**考察点:** static 默认不定位；relative 相对自己原位置偏移且占位；absolute 相对最近非 static 祖先且脱标不占位；fixed 相对视口且脱标；sticky 滚动未达阈值时像 relative、达到阈值后像 fixed。

**参考答案要点:**
| 取值 | 定位参考系 | 是否脱离文档流 | 原位置是否保留 |
|---|---|---|---|
| static（默认） | 不定位，top/left 无效 | 否 | — |
| relative | 自身原本在文档流中的位置 | 否 | 保留（占位） |
| absolute | 最近的 position ≠ static 的祖先，没有则 html | 是 | 不保留 |
| fixed | 浏览器视口（有 transform 祖先时例外） | 是 | 不保留 |
| sticky | 滚动容器，阈值前 relative、阈值后 fixed | 否（达标前）/是（达标后） | 阈值前保留 |

**示例:**
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

**追问方向:**
- `absolute` 元素的父级都是 static，它相对谁定位？（提示：html / 初始包含块）
- `fixed` 元素的祖先有 `transform`，会带来什么问题？（提示：参考系变了）
- `sticky` 为什么有时候不生效？常见失效原因有哪些？

---

### Q05.43【中·高频·手写】实现元素水平垂直居中有哪些方案？各自适用什么场景？

**考察点:** 现代首选 `display:flex; justify-content:center; align-items:center;`（一行搞定）；grid 用 `place-items:center` 更简洁；不知宽高时用 `absolute + transform:translate(-50%,-50%)`。

**参考答案要点:**
按「是否需要知道宽高」分类记忆：

| 方案 | 关键代码 | 是否需知宽高 | 备注 |
|---|---|---|---|
| flex | 父 `display:flex; justify-content:center; align-items:center;` | 否 | 现代首选 |
| grid | 父 `display:grid; place-items:center;` | 否 | 最简洁 |
| absolute + transform | 子 `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);` | 否 | 不需知宽高 |
| absolute + margin 负值 | 子 `left:50%; top:50%; margin:-w/2 -h/2;` | 是 | 需知宽高 |
| absolute + margin auto | 子 `position:absolute; inset:0; margin:auto;` | 是 | 需知宽高 |
| 行内文本 | 父 `text-align:center; line-height=高;` 或 table-cell | — | 适合单行文字 |

**示例:**
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

**追问方向:**
- `transform:translate(-50%,-50%)` 为什么不需要知道元素宽高？（提示：% 基于自身尺寸）
- flex 布局里子项太多时，`align-items` 和 `align-content` 有什么区别？
- 如何让一段多行文字垂直居中？（提示：flex 或 `display:table-cell; vertical-align:middle;`）

---

### Q05.44【中·高频·概念】`flex: 1` 这个缩写的完整含义是什么？

**考察点:** `flex: 1` 等价于 `flex: 1 1 0%`，即 grow=1（有剩余则放大占满）、shrink=1（空间不足则缩小）、basis=0%（初始基准为 0，完全靠 grow 分配）。所以 `flex:1` 的元素会自动占满剩余空间。

**参考答案要点:**
`flex` 是 `flex-grow`、`flex-shrink`、`flex-basis` 三者的缩写。写 `flex: 1` 时，浏览器展开为 `1 1 0%`：
- 第一个 1 → flex-grow=1（放大比例）
- 第二个 1 → flex-shrink=1（缩小比例）
- 0% → flex-basis=0%（基准尺寸）

**示例:**
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

**追问方向:**
- `flex:1` 和 `flex:1 1 auto` 在视觉上为什么可能不一样？（提示：basis 不同）
- `flex-basis` 和 `width` 同时设置时谁优先？（提示：basis 优先，auto 时才回退到 width）
- 如何实现「左侧固定宽、右侧自适应」的两栏布局？（提示：flex:0 0 200px + flex:1）

---

### Q05.45【中·概念】伪元素 `::before` 和 `:before` 有什么区别？`content` 属性起什么作用？

**考察点:** `::before`（双冒号）是 CSS3 规范的伪元素写法，`:before`（单冒号）是 CSS2 旧写法，效果完全等价，现代浏览器都支持，推荐用双冒号。伪元素默认不生成，必须设置 `content` 属性才会出现在渲染树中。

**参考答案要点:**
**双冒号 vs 单冒号**：
- CSS2 时代伪类和伪元素都用单冒号（`:hover`、`:before`）。
- CSS3 为了区分「伪类」（单冒号，如 `:hover :first-child`）和「伪元素」（双冒号，如 `::before ::after`），规定伪元素统一用双冒号。
- 为向后兼容，浏览器对 `:before` 仍按伪元素处理，所以两者等价。实际开发推荐双冒号以符合规范。

**示例:**
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

**追问方向:**
- 伪元素能被 `document.querySelector` 选中吗？能用 JS 修改它的 content 吗？（提示：不能直接选中，但可改父元素 class 间接切换）
- `content: counter()` 计数器怎么配合 `counter-reset`/`counter-increment` 使用？
- 为什么 clearfix 清除浮动要用伪元素而不是直接给父元素 overflow:hidden？（提示：避免副作用）

---

### Q05.46【中·高频·手写】如何用 CSS 实现暗黑模式 / 主题切换？

**考察点:** 主流方案：用 CSS 自定义属性（变量）把颜色抽象出来，根元素切换 `data-theme` 属性改变量值，或用 `prefers-color-scheme` 媒体查询跟随系统。JS 只负责切换 data 属性，所有样式靠 CSS 变量自动响应。

**参考答案要点:**
主题切换的核心思路是「把颜色抽象成变量，切换时只改变量值，不动具体样式」。

**示例:**
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

**追问方向:**
- CSS 变量和 Sass 变量的本质区别是什么？（提示：运行时 vs 编译时）
- 如何让主题跟随系统又允许用户手动覆盖？（提示：prefers-color-scheme 设默认值 + JS 改 data-theme 覆盖）
- 为什么 CSS 变量切换主题比改 class 名重新加载样式性能好？

---

### Q05.47【中·高频·概念】CSS3 的 `transform`、`transition`、`animation` 有什么区别？分别怎么用？

**考察点:** transform 是「变换动作」（位移/缩放/旋转，不触发回流）；transition 是「被动过渡」（状态改变时平滑过渡，需触发）；animation 是「主动动画」（用 @keyframes 关键帧自动循环播放）。三者常配合使用。

**参考答案要点:**
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

**示例:**
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

**追问方向:**
- `transition` 能让 `display:none → block` 平滑过渡吗？为什么？（提示：不能，display 不可插值，需用 opacity/visibility 替代）
- `transform` 为什么能 GPU 加速、不触发回流？（提示：作用于合成层，不改布局）
- `animation` 的 `steps()` 函数有什么用？（提示：雪碧图逐帧动画）

---

### Q05.48【中·高频·概念】实现响应式布局有哪些常用方案？

**考察点:** 主流：媒体查询 @media 做断点、弹性单位 rem/em/vw/vh 做缩放、flex/grid 弹性布局做自适应，新特性还有容器查询 @container。核心思想是「一套代码适配多端」。

**参考答案要点:**
响应式 = 内容和布局随视口/容器变化而自适应。常用方案分三类：

**示例:**
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

**追问方向:**
- `rem` 和 `em` 的区别？为什么容易混淆出错？（提示：参照物不同，em 会逐级嵌套放大）
- 移动端为什么常用 rem 配合 flexible.js？（提示：动态算 html font-size 适配不同 dpr）
- 移动端「1px 边框」问题怎么解决？（提示：用 transform:scaleY(0.5) 或媒体查询按 dpr 调整）

---

### Q05.49【高·高频·概念】flex 容器空间不足时，`flex-shrink` 如何计算各子项实际收缩的宽度？

**考察点:** 收缩不是简单等比例缩小，而是按 `shrink × basis` 的加权比例分配。某子项的收缩量 = 总溢出量 × (本项shrink×basis) / Σ(各项shrink×basis)。

**参考答案要点:**
当 flex-shrink > 0 且主轴空间不够时，浏览器先算出溢出量，再按权重把溢出量分摊到各子项。

**示例:**
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

**追问方向:**
- 如果某项 `flex-shrink: 0`，空间不足时会怎样？（提示：不收缩，可能溢出容器）
- flex 子项会被压缩到 0 宽度吗？什么在保护它？（提示：min-width:auto 默认保护）
- 为什么三个 shrink 都等于 1 时，收缩量却不相等？（提示：basis 不同导致权重不同）

---

### Q05.50【高·高频·概念】什么是 BFC（块级格式化上下文）？如何触发？有哪些典型应用场景？

**考察点:** BFC 是一块独立隔离的渲染区域，内部元素与外部互不影响。触发方式：overflow:hidden/auto、float、position:absolute/fixed、display:flex/inline-block/flow-root 等。应用：清除浮动、避免 margin 塌陷、自适应两栏布局。

**参考答案要点:**
BFC = Block Formatting Context，块级格式化上下文。可理解为给元素套一个「结界」，里面元素的布局不影响外面，外面也不影响里面。

**示例:**
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

**追问方向:**
- margin 塌陷发生在哪三种情况？（父子、相邻兄弟、空元素）
- 为什么 `overflow:hidden` 能清除浮动？它的原理是什么？
- `display:flow-root` 相比 `overflow:hidden` 触发 BFC 有什么优势？（提示：无裁剪副作用）

---
