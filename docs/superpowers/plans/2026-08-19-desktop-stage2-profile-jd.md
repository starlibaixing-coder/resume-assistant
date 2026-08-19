# 桌面端阶段 2(求职档案 + JD 定向生题)Implementation Plan

> **状态:✅ 已完工**(2026-08-19,Task 1-5 全部落地)。验证:157 单测 + 10 e2e 全绿,typecheck/build 通过,档案页/生题页 JD 模式截图目检通过;真 LLM(智谱)联调留 `npm run tauri dev` 手测。

**Goal:** 落地 ADR-4 中枢档案(简历 + JD + 公司)录入,并接进生题管线:功能④「JD 定向生题」,让生成的题围绕目标岗位,而非泛知识点。验证目标:**求职目标接进生成**。

**设计依据:** `docs/superpowers/specs/2026-08-13-quiz-app-agent-design.md`(§6 路线图 / ADR-4 / §7 硬约束)

**验证方式:** `npm run test:run` + `npm run typecheck` + `npx playwright test`(mock chat endpoint);真 LLM 联调留 `npm run tauri dev` 手测。

---

## 本阶段新增决策

### D1 档案 = 独立页面 `/profile`(用户确认)

侧栏一级入口「求职目标」。理由:ADR-4 定位一等公民,阶段 3(简历生成)/5(模拟面试)都围绕它,独立页有成长空间;简历是长文本编辑,塞设置分区会越来越重。

### D2 JD 定向生题 = 生题页双模式(用户确认)

生题页加模式切换:「知识点生题 / JD 定向」,共用预览、存草稿区、质检链路(ADR-10 不变),只换 prompt 上下文;档案缺失时引导去 `/profile`。

### D3 profile.ts 数据层沿用 mylib 哲学

内存缓存 + await 持久化 + pub-sub;单行(id=1)UPSERT。非 Tauri 环境(web/e2e)降级内存。`initStorage` 里灌缓存(与 mylib 同批)。`preferences` 字段本阶段不出 UI(留给阶段 3)。

### D4 JD 定向 prompt 注入策略

- JD 全文必带;公司名带入(批次名 `JD定向 · {company}`,无公司用 JD 前 12 字)
- 简历:档案里有就默认注入(UI 可关),指令为"结合简历经历深挖,考察 JD 要求与简历声称能力的匹配"
- 出题指令:围绕 JD 的核心技术要求出题,数量仍由 LLM 判断(沿用 ≤12 上限);QUALITY 六条红线与预检自修正完全复用
- 知识点模式不注入档案(保持通用刷题语义)

### D5 档案字段(P3 表已有,不动 schema)

`resume`(markdown 文本)/ `jd`(文本)/ `company`(短文本)。录入 = 纯粘贴,不做文件导入、不做简历解析(阶段 3 复用 `skill/` 时再议)。

---

## Task 1: profile.ts 数据层(`src/lib/profile.ts`)

- `getProfile()` 同步读缓存(null = 未录入);`saveProfile(patch)` await UPSERT 后 notify;`subscribeProfile(fn)`
- `initProfileDb(db)` 注入句柄,`loadProfileFromDb()` 启动灌入
- 单测:save 后读回 / pub-sub 触发 / 非 Tauri 降级不炸

## Task 2: `/profile` 档案页 + 侧栏入口

- 路由 `/profile`,侧栏「求职目标」(Target 图标,总览与 AI 生题之间)
- 表单:公司/岗位(Input)、JD(Textarea 大)、简历(Textarea 大,markdown);保存按钮 + toast;已保存回显
- 空态引导文案:说明档案被 JD 定向生题(本阶段)与简历/模拟面试(后续)共享

## Task 3: JD 定向生题管线(`src/lib/generate.ts` 扩展)

- `buildJdSystemPrompt(profile, opts)` / `buildJdUserPrompt(profile)`:JD 必带、简历可选、QUALITY 红线复用
- `generateJdQuestions(profile, chatOpts, chat?)`:复用 parse/validate/自修正循环(DI 注入,零网络单测)
- 单测:prompt 含 JD 片段与红线 / 简略档案报错 / 复用管线行为

## Task 4: 生题页双模式(`src/pages/generate.tsx`)

- 模式切换(知识点 / JD 定向),沿用既有难度 pill
- JD 模式:无档案 → 引导 `/profile`;有档案 → 显示将注入的上下文摘要(JD 字数/是否带简历/简历开关);批次名 `JD定向 · {company}`
- 结果预览/存草稿区链路不变

## Task 5: e2e + 收尾

- e2e:填档案 → 生题页 JD 模式生成(mock)→ 存草稿区 → 我的题库;无档案引导分支
- 全量:`npm run test:run` / `npm run typecheck` / `npx playwright test` + 截图目检

---

## 硬约束对账(§7)

| 约束 | 落点 |
|---|---|
| 1 prompt 内嵌 QUALITY + 预检自修正 | Task 3(JD 模式同一条管线) |
| 2 草稿区 + approve 全链路 | Task 4(JD 生成的题同样先进草稿区) |
| 7 R1/R2/R3 延续 | 本阶段不生成简历内容,阶段 3 落地时接入 |
