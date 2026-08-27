# 沉浸式刷题 + 问 AI 子窗口 Implementation Plan

> **状态:✅ 已完工**(2026-08-27)。验证:196 单测 + 21 e2e(新增 3)+ typecheck/build 全绿;capabilities 变更后 `npm run smoke` 真机冒烟通过;系统全屏与子 webview 窗口两真机行为 `npm run tauri dev` 手测 + 截图目检。同日姊妹修复分支 `fix/scratchpad-editor-stability`(编辑器补全/选中)先行合入,见其 commit 说明。

**Goal:** 刷题体验两件事:
1. **沉浸式刷题**:点击进入,只留刷题界面(侧栏/返回条/窗口标题栏全藏),Esc 退出。
2. **问 AI**:应用内嵌 chat.qwen.ai,刷题卡壳时直接问。

**方案确认记录(用户二选二):** 沉浸范围 = 应用内 chrome + 系统全屏(标题栏也藏);嵌入方式 = 独立子 webview 窗口(iframe 已否:X-Frame-Options 拦截 + 第三方 iframe 登录态不可用;应用内右侧分栏已否:多 webview 定位/resize 同步复杂,原生层永远浮在 DOM 上,web 层不可测)。

---

## 关键决策

### D1 沉浸态 = React context,不是独立路由

`lib/immersive.tsx` 提供 `ImmersiveProvider/useImmersive`(session 级,不持久化),挂 `App.tsx` 的 HashRouter 内(路由守卫要 useLocation)。不选独立路由:刷题队列是 QuizPage 本地状态,拆路由会丢队列。

### D2 隐藏 chrome = AppShell 条件渲染

沉浸时不渲染 `<aside>` 与返回条,`<main>` 滚动容器结构不变——刷题页零改动即可进入沉浸;meta 行(进度/模块名/两按钮)是沉浸中唯一保留的 chrome,兼作退出入口的可发现性兜底。

### D3 退出三通道

Esc 全局键(沉浸中才挂监听)、meta 行按钮(图标 Maximize2/Minimize2 切换)、离开 `*/quiz` 路由自动退出(含 Cmd+← 后退)。**Esc 不加 INPUT/TEXTAREA/contentEditable 守卫**(与 AppShell 的 Cmd+← 相反):刷题时焦点常驻 CodeMirror/tiptap,守卫会让 Esc 永远够不到;编辑器内 Esc 先关补全再冒泡退出,并存可接受。

### D4 系统全屏跟随沉浸态(isTauri 守卫)

进入/退出时 `getCurrentWindow().setFullscreen()`(动态 import,失败只记日志不阻塞 CSS 沉浸);浏览器/web 层 `isTauri()` 为 false 天然只剩 CSS 沉浸,e2e 可测。capabilities 加 `core:window:allow-set-fullscreen`。

### D5 问 AI = 独立子 WebviewWindow,已开聚焦

`lib/ai-assistant.ts`:`WebviewWindow.getByLabel('ai-chat')` 存在则 `setFocus()`,否则 `new WebviewWindow('ai-chat', { url, 460×680 })`,`tauri://error` toast + 日志。登录态存应用数据目录(WKWebView),首次登录后续免登。浏览器层降级 `window.open` 新标签页。权限:`core:webview:allow-create-webview-window` + `allow-get-all-webviews`(getByLabel 走 get_all_webviews 命令)+ `core:window:allow-set-focus`。

### D6 ai-chat 窗口不进 capabilities windows 列表

远端页面拿不到任何 IPC(不配 dangerousRemoteDomainIpcAccess),默认安全;权限只授给 main(创建/聚焦动作由 main 发起)。

### D7 UI 入口沿仓库 ghost icon 规范

meta 行右侧两枚 `Button size="icon" variant="ghost" h-7 w-7` + Tooltip + aria-label(MessageCircleQuestion / Maximize2·Minimize2);浏览器降级时问 AI 渲染为同款样式的 `<a target="_blank">`(沿 settings GitHub 链接模式,便于 e2e 断言)。

---

## Task 1: 沉浸式(lib/immersive + AppShell + 入口)
## Task 2: 问 AI(lib/ai-assistant + 入口 + capabilities)
## Task 3: e2e(immersive.spec.ts × 3:进入/Esc 退出、路由守卫、问 AI 降级外链)
## Task 4: 文档同步(AGENTS.md 桌面端原则两条)

## 施工中的关键事实(供后人)

- `@tauri-apps/api/webviewWindow` 才是 `WebviewWindow` 所在模块(`webview` 模块只有 `Webview`);`getByLabel` 是 **async**,底层 `get_all_webviews` 命令需要单独授权。
- e2e(纯 web,无 Tauri mock)恰好覆盖降级路径:沉浸只剩 CSS、问 AI 变外链;mock 了 `__TAURI_INTERNALS__` 的 spec 里点问 AI 会让 `get_all_webviews` 返回 null 而 `.find` 崩——不要在 mock spec 里点它。
- 沉浸中轮次完成态(RoundDoneState)无 meta 行,退出靠 Esc 与路由守卫,可接受。
