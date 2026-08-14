# 桌面端阶段 1(MVP)Implementation Plan

> **状态:✅ 已完工**(2026-08-14,WP1-WP7 全部落地,合入 main)。验证:134 单测 + 7 e2e 全绿,typecheck/build 通过;真实 LLM(智谱)联调留 `npm run tauri dev` 手测。

**Goal:** 打通功能①(知识点生题)+ 功能⑥(改删我的库),验证"LLM → 我的库 → 刷题 → SM-2"整条管线在桌面端真实跑通。

**设计依据:** `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md`(§6 路线图 / §7 硬约束 / ADR-3/7/8/9/10)

**架构基线(阶段 0 已有):**
- SQLite `questions` 表已建(含 `status pending/approved` 草稿态),尚无代码使用
- keyring Rust command(`get_api_key`/`set_api_key`)已有,前端无接线
- `provider.ts`(OpenAI 兼容 chat/chatStream)、`agent.ts`(Vercel AI SDK 骨架)已有
- `storage.ts` B 方案(内存缓存 + fire-and-forget 持久化)只覆盖 review_state/notes

**验证方式:** `npm run test:run`(vitest)+ `npm run typecheck` + `npx playwright test`(web 层 e2e,mock chat endpoint)。真实 LLM 联调(智谱)留 `npm run tauri dev` 手测。

---

## 本阶段新增决策(不推翻任何 ADR,只做实现级选择)

### D1 我的库 = 独立分类 `my`

ADR-3 说"双库并列聚合"。实现取"并列"最直白解:**我的库合成一个独立分类(slug `my`,name 我的题库)**,与官方分类并列出现在首页/刷题/浏览。官方模块不动,AI 生题不塞进官方模块(避免"React 生题该进 fe 哪个模块"的归属难题,留给阶段 2 档案定向再议)。

- **批次即模块**:每次生题批次建一个模块,模块名 = 知识点(截断 30 字)。模块号 = 我的库现有最大模块号 + 1(从 1 起)。
- **官方副本归模块 0**:官方题"复制成副本再改"(ADR-3),副本统一进模块 0「官方题副本」,题号顺延。
- **id 三段式 `my.<module>.<idx>`**(如 `my.1.3`、`my.0.5`):沿用官方 id 形状,slug `my` 避开官方 slug(ADR-9 硬约束 4),module-nav 的 `id.split('.').slice(1)` 显示天然兼容。

### D2 mylib.ts:内存缓存 + await 持久化

沿用 storage.ts B 方案哲学,但差异:**题目 CRUD 是用户显式操作(低频、语义重),写库 await 后再返回**;读走同步缓存。mutate 后发版本事件(pub-sub),`useQuestions` 订阅重算聚合。

删题级联清理 `review_state` / `notes` 孤儿行(单用户本地库,无外键,手动删)。

### D3 生题走 provider.chat + DI,不动 agent.ts

生题是"单次生成 + 结构化输出 + 校验重试",不需要工具循环。`generate.ts` 直接用 `provider.chat`(已测),把 chat 函数作为参数注入(DI),单测零网络。agent.ts(Vercel AI SDK)留给阶段 2+ 需要多步工具编排的场景。

### D4 质量闸落地(ADR-10,§7 硬约束 1/2/3)

1. system prompt 内嵌 QUALITY.md 四条设计缺陷(答案泄漏/追问提示/多问一题/层次混乱)+ focus 写法规则 + 硬规则(answer≥50 字、difficulty 初中高)
2. 输出 JSON 数组;解析容错(剥 markdown 围栏)
3. 预检跑共享 `validateQuestion`(validate.ts),失败把错误清单喂回 LLM 自修正,**最多重试 2 次**,耗尽报错
4. 生成的题**只返回不落库**,由 UI 层以 `pending` 状态入草稿区;approve 才 `approved` 进聚合刷题(SM-2 队列天然只看到 approved)

### D5 LLM 配置页(补 WP5 缺的"key 录入页")

预设:智谱(默认,`https://open.bigmodel.cn/api/paas/v4` + `glm-4-flash`)/ DeepSeek / Ollama 本地 / 自定义。baseURL+model 存 localStorage;**key 只进 keyring**(ADR-8)。非 Tauri 环境(web dev/e2e)key 存内存(刷新即失,仅测试用)。附「测试连接」按钮(provider.chat 最小调用)。

---

## Task 1: mylib 数据层 ✅(7cabe17)(`src/lib/mylib.ts` + `storage.ts` 接线)

**Files:** 新增 `src/lib/mylib.ts`、`src/lib/mylib.test.ts`;改 `src/lib/storage.ts`(initStorage 加载我的题)、`src/types/question.ts`(MyQuestion 类型)

- `MyQuestion = Question + status: 'pending' | 'approved' + createdAt/updatedAt`
- 同步读:`getMyQuestions()` / `getMyCategory()`(合成 Category)
- 异步写(await):`addDrafts(batch)`(新模块+id 分配)/ `approveQuestion(id)` / `rejectDraft(id)`(删)/ `updateQuestion(id, patch)`(改后再校验)/ `deleteQuestion(id)`(删+级联)/ `copyOfficial(q)`(深拷贝进模块 0)
- id 分配纯函数 `allocateIds(existing, moduleId, count)` 可单测
- pub-sub:`subscribeMyLib(fn)`,mutate 后 notify
- initStorage 里 `db.select` 灌 mylib 缓存(经 `initMyLibDb(db)` 注入句柄,避免循环依赖)

## Task 2: 聚合层 ✅(7575daa)(`src/lib/questions.ts`)

**Files:** 改 `src/lib/questions.ts`(merge 纯函数导出可测)

- `mergeQuestionData(official, myApproved)`:拼 `my` 分类 + approved 题;无题时也保留空"我的题库"分类(首页入口)
- `useQuestions` 订阅 mylib 版本事件,变更即重算 setData
- pending 永不进聚合(ADR-10)

## Task 3: 生题管线 ✅(c775c3f)(`src/lib/generate.ts`)

**Files:** 新增 `src/lib/generate.ts`、`src/lib/generate.test.ts`

- `buildGeneratePrompt(topic, opts)`:system(QUALITY 规则 + JSON schema + 硬规则)+ user(知识点/数量/难度)
- `parseQuestions(text)`:剥围栏 → JSON.parse → 数组容错
- `generateQuestions(topic, opts, chat = provider.chat)`:生成 → 预检(validateQuestion)→ 失败喂错误重试(≤2)→ 返回 `{ questions, retries }` 或抛错
- 每题校验通过后由调用方分配 id(addDrafts 时)

## Task 4: LLM 配置 ✅(cfbcc83)(`src/lib/llm-config.ts` + 设置页)

**Files:** 新增 `src/lib/llm-config.ts`、`src/components/settings-page.tsx`;改 `src/App.tsx`(路由 `#/settings`)

- 预设表 + `loadConfig()/saveConfig()`(localStorage)+ `loadKey()/saveKey()`(keyring invoke;非 Tauri 内存降级)
- `resolveChatOptions()`:拼 provider.chat 所需 ChatOptions

## Task 5: 生题页 + 草稿区页 ✅(6b880f2)

**Files:** 新增 `src/components/generate-page.tsx`、`src/components/drafts-page.tsx`;改 `src/App.tsx`、`src/components/home-page.tsx`(我的题库卡片 + 生题/草稿/设置入口)

- 生题页:知识点 + 数量(3/5/8)+ 难度(不限/初/中/高)→ 生成 → 预览(含重试次数)→ 入草稿区
- 草稿区:按批次(模块)分组,逐题预览 + 通过/拒绝,批量通过;approve 后引导去刷题

## Task 6: 改删 UI ✅(1826631)(浏览页就地编辑)

**Files:** 新增 `src/components/question-edit-dialog.tsx`;改 `src/components/module-nav.tsx`

- `category === 'my'` 的展开题:编辑(dialog 表单)/ 删除(确认)
- 官方分类展开题:「复制到我的库」按钮(ADR-3 官方题改 = 复制后改)
- 编辑保存跑同一份 validateQuestion

## Task 7: e2e + 收尾 ✅(01e6a6d)

**Files:** 改 `desktop/tests/e2e/smoke.spec.ts`(或新增 `generate.spec.ts`)

- e2e:mock `__TAURI_INTERNALS__` + `page.route` 拦截 chat endpoint,跑通 生题 → 草稿 approve → 我的题库出现 → 开始刷题(web 降级内存模式)
- 全量:`npm run test:run` / `npm run typecheck` / `npx playwright test`

---

## 硬约束对账(§7)

| 约束 | 落点 |
|---|---|
| 1 prompt 内嵌 QUALITY + 预检自修正 N 次 | Task 3 |
| 2 草稿区 + approve 全链路 | Task 1/2/5 |
| 3 我的库 id `my-*` 避开官方 | Task 1(id 分配) |
| 4 存储抽象 | 复用阶段 0 storage.ts/mylib.ts |
| 5 provider OpenAI 兼容 | Task 3/4 |
| 8 备份导出走 app 层 | 本阶段不做导出(阶段 2+),不引入 git |
