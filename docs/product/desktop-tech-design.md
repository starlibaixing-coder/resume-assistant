# CommitCareer 桌面端技术设计约束

| | |
|---|---|
| **版本** | v1.0 |
| **日期** | 2026-09-09 |
| **状态** | 待评审 |
| **依据** | [`desktop-prd.md`](./desktop-prd.md) **v2.2**(产品行为唯一来源)、`docs/adr/0001–0006`、功能文档术语约定 |
| **定位** | 开发直接照此实施,以**无歧义**为标准;与 PRD/ADR 冲突时以 PRD/ADR 为准并立即回报修订本文档 |
| **值采纳说明** | grilling Round 2 六问(Q7–Q12)在会话未否决前按推荐值生效,本文档已将其固化为规格;用户改答案 → 出 ADR 覆盖本文档对应小节 |
| **实施环境** | 在现有 `desktop/` workspace 内实施(允许重写 `src/`);与旧实现的迁移兼容由实施计划另行决定,不在本文档范围 |

---

## 1. 技术栈与版本基线

| 层 | 选型 | 约束 |
|---|---|---|
| 桌面壳 | Tauri 2.x | 系统全屏、子窗口、SQL 插件、文件对话框、shell open |
| UI 框架 | React 19 + TypeScript(strict) | 函数组件 + hooks;不用 class 组件 |
| 构建 | Vite | 单 bundle;`BASE_URL`/hash 路由适配由 react-router 承担 |
| 样式 | Tailwind CSS v4 | `@theme inline` 映射 CSS 变量(官方模式);禁内联魔法色值 |
| 组件库 | shadcn/ui(源码进 `components/ui/`) | 只用 §7.3 白名单;缺组件按官方 CLI 方式补源码 |
| 路由 | react-router(HashRouter) | 路由表见 §6.1;站内导航一律 `Link`/`useNavigate` |
| LLM | Vercel AI SDK(OpenAI 兼容 provider) | 契约见 §5.4 |
| 代码编辑 | CodeMirror 6(`@uiw/react-codemirror`) | **closeBrackets 必须关闭**;主题吃 CSS token;引用必须稳定(仓库既有教训) |
| JS 执行 | Web Worker | 沙箱运行草稿纸代码;超时 3s terminate;异步输出转发 |
| 通知 | sonner | 唯一 toast 通道 |
| 图标 | lucide-react | 统一 15px / stroke 1.75;禁 emoji 与文本字符 |
| 工作区 | npm workspaces | 一切 npm 命令从仓库根执行;装依赖必须 `npm install <pkg> -w desktop` |

**浏览器降级层**(e2e 与 `npm run dev` 环境):`isTauri() === false` 时 SQLite → 内存实现、子窗口 → `window.open`、系统全屏 → 仅 CSS 专注态、文件对话框 → 下载/`<input type=file>`。降级只换实现,不改组件与业务代码。

## 2. 架构总览与分层

```
┌─ UI 层 ──────────────────────────────────────────────┐
│ pages/(9 路由页) + components/biz(业务组件)          │
│   ↑ useSyncExternalStore 订阅;不直接触库            │
├─ 领域服务层 lib/ ────────────────────────────────────┤
│ scheduler.ts(SM-2) session.ts(会话引擎) bank.ts      │
│ generate.ts(出题管线) sync.ts(官方库同步) guard.ts    │
├─ 存储网关 storage.ts ────────────────────────────────┤
│ 内存缓存 + 同步读 + fire-and-forget 持久化 + pub-sub │
│   ↓ Tauri SQL 插件          ↓(降级)内存 Map          │
├─ 平台命令(旁路)─────────────────────────────────────┤
│ 窗口(全屏/ai-chat) 备份文件 外链 日志                │
└─ 外部服务(旁路)─────────────────────────────────────┘
   LLM(OpenAI 兼容)   远端 questions.json
```

硬约束:

1. **单向数据流**:UI 只读服务层缓存快照;一切写经服务方法(改缓存 → 持久化 → notify)。组件内不得直接 `invoke('sql')`。
2. **状态管理**:不引入 redux/zustand;服务层 pub-sub + `useSyncExternalStore`(仓库既有 storage 模式)。
3. **会话状态仅内存**(`session.ts` 模块级):切界面保留(D3/ADR 未编号),应用重启即结束;**不持久化**。
4. 服务层纯函数(调度、队列构造、校验)与 IO 分文件,保证可单测。

## 3. 数据存储(SQLite)

库文件:`{app_data_dir}/app.db`;迁移文件 `src-tauri/migrations/0001*.sql` 起顺序编号,`CREATE TABLE IF NOT EXISTS` 幂等,Rust 侧注册表清单 + 测试断言表集合。

### 3.1 DDL(0001_init.sql,逐列即规格)

```sql
-- 题目表:官方物化 + 我的 + 待审核 三态同表
CREATE TABLE IF NOT EXISTS questions (
  id          TEXT PRIMARY KEY,      -- 官方 fe.xx.x / agent.xx.x;我的 my.<模块>.<序号>;pending 临时 id gen.<ts>.<n>
  category    TEXT NOT NULL,         -- 'fe' | 'agent' | 'my'
  module      TEXT NOT NULL,         -- 模块名(我的可为 '自定义' 等)
  title       TEXT NOT NULL,
  focus       TEXT NOT NULL,         -- 考察方向
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('初','中','高')),
  tags        TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  answer      TEXT NOT NULL,         -- JSON 字符串数组,每条一要点
  followups   TEXT NOT NULL DEFAULT '[]',   -- JSON 数组
  source      TEXT NOT NULL CHECK (source IN ('official','manual','copy','ai','jd')),
  status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','pending')),
  is_code     INTEGER NOT NULL DEFAULT 0,   -- 代码题标记(展示草稿纸入口默认展开)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_q_cat   ON questions(category);
CREATE INDEX IF NOT EXISTS idx_q_stat  ON questions(status);
CREATE INDEX IF NOT EXISTS idx_q_src   ON questions(source);

-- SM-2 进度(官方题与我的题统一一张表,ADR-9 语义)
CREATE TABLE IF NOT EXISTS review_state (
  question_id   TEXT PRIMARY KEY,    -- → questions.id
  ef            REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  reps          INTEGER NOT NULL DEFAULT 0,
  last_rating   TEXT CHECK (last_rating IN ('ok','fuzzy','no')),
  due_at        INTEGER NOT NULL,    -- epoch 秒;到期粒度=自然日(见 §4.2)
  last_rated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rs_due ON review_state(due_at);

-- 笔记 / 代码草稿(同模式:按题一行)
CREATE TABLE IF NOT EXISTS notes (
  question_id TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS code_drafts (
  question_id TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- JD
CREATE TABLE IF NOT EXISTS jds (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  company        TEXT NOT NULL DEFAULT '',
  content        TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL    -- 「最近使用」排序键;生成发起或编辑保存时刷新
);

-- 简历(单行)与密钥(单行)
CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id=1), resume TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY CHECK (id=1), provider TEXT NOT NULL, api_key TEXT NOT NULL DEFAULT '', base_url TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL);

-- 每日活动聚合(连续天数 B3 + 最近学习记录 B4)
CREATE TABLE IF NOT EXISTS activity (
  day     TEXT PRIMARY KEY,          -- 本地自然日 'YYYY-MM-DD'
  rated   INTEGER NOT NULL DEFAULT 0,-- 当日评分次数(去重前)
  ok      INTEGER NOT NULL DEFAULT 0,-- 当日最终评分为 ok 的题数(去重后)
  last_at INTEGER NOT NULL
);

-- 杂项(偏好/同步/界面记忆)
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- 约定键:batch_size('20'|'50'|'all',默认 '50')  theme('light'|'dark',默认 'light')
--         last_bank_cat('fe'|'agent'|'my')  last_sync_at(epoch)  schema_version
```

### 3.2 状态派生规则(五档互斥,ADR-0003——实现与筛选共用同一函数 `deriveStatus`)

```
待审核  : questions.status = 'pending'
待学习  : status='approved' AND 无 review_state 行
待复习  : status='approved' AND 有行 AND due_at <= now
已掌握  : status='approved' AND 有行 AND due_at > now AND last_rating='ok'
已排期  : status='approved' AND 有行 AND due_at > now AND last_rating != 'ok'
```

- 题库「状态」列、筛选芯片、今天页/状态栏/徽标计数全部调用 `deriveStatus`/其 SQL 等价物,**禁止各写各的判断**。
- 计数口径:待复习 = due≤now 且 approved;待学习/待审核同上;「我的 N」= category='my' 且 approved。
- `due_at` 粒度 = 自然日:到期日当天 00:00(本地时区)即视为到期;「明天」= 次日 00:00。

### 3.3 级联清理(应用层执行,顺序固定)

| 触发 | 动作 |
|---|---|
| 删除我的题 / 拒绝 pending | 若 approved:先删 review_state、notes、code_drafts,再删 questions(pending 无附属,直删) |
| 官方库同步下架 | 同上一行(题 id 作废不复用,ADR-9) |
| 通过 pending | 生成正式 `my.*` id → 更新 questions 行(id、category='my'、source、status='approved') |
| 导入备份 | 单事务:全表 DELETE → INSERT(整库覆盖,D12) |

### 3.4 备份文件格式

- 导出:单文件,JSON 信封 `{ version: 1, exported_at, tables: { questions, review_state, notes, code_drafts, jds, profile, meta } }`;**不含 secrets**(key 不落备份)。
- 另提供 YAML 题目导出(仅 questions,官方题库格式对齐,贡献回官方库用,G3)。
- 导入:校验 `version` → 确认弹窗(PRD 文案)→ 事务覆盖。

## 4. 领域规则

### 4.1 评分映射与 SM-2(`lib/scheduler.ts`,纯函数)

```
rating → quality:no=2, fuzzy=4, ok=5(ADR-0002)
rate(state, rating, now):
  q = quality[rating]
  state.ef = clamp(state.ef + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)), 1.3, 2.5)
  if rating = 'no':  reps=0; interval=1
  elif state.reps = 0(首评): interval = fuzzy?2 : 3        // Q7:no=1 / fuzzy=2 / ok=3
  elif rating = 'ok': state.reps+=1; interval = (reps=2) ? 7 : round(prev_interval × ef)
  elif rating = 'fuzzy': state.reps+=1; interval = max(1, round(prev_interval × 0.6))
  state.last_rating = rating; state.last_rated_at = now
  state.due_at = 次自然日(interval 天后的 00:00,本地时区)
```

- **单一评分通道(ADR-0005)**:上表所有会话类型的评分都调用同一个 `rate()` 写入 review_state,无第二套通道。
- **重练覆盖(D17)**:同一会话内同题第二次评分 = 直接再调一次 `rate()`,以最后状态为准。
- 数值样例(单测锚点,实现必须复现):首评 ok → 3 天后;该题第二次 ok → 7 天后;第三次 ok(EF=2.5)→ 18 天后(7×2.5 四舍五入);间隔 30 天的题评 fuzzy → 18 天后(EF 更新按 q=4:2.5→2.18);评 no → 次日。
- 连续学习天数(D4):`streak()` 从今天(无记录则从昨天)向回数 `activity.rated>0` 的连续天数。

### 4.2 会话引擎(`lib/session.ts`)

队列构造(|Q| 全部先按 due_at 升序、同日按 id 升序):

| 会话 | 队列 | 上限 |
|---|---|---|
| 复习 | approved 且 due≤now | **无**(ADR-0001) |
| 学习 | 待学习(id 升序) | min(待学习数, batch_size) |
| 混合(⌘K「学习」) | 复习全量 + 待学习按上限补位 | 复习无、新题有 |
| 再过一遍 | 全部 approved(id 升序) | 无(Q9) |
| 单题直练 | [qid] | — |

- 状态机:`idle → active(i, revealed) → summary`;评分 → 结果条 1s → 220ms 淡出 → i+1。
- 重练:评 no 且该题本轮未重练过 → push 副本标记 `isRetry`。
- **题目消失(ADR-0004)**:渲染每题前 `SELECT 1 FROM questions WHERE id=? AND status='approved'`;缺失 → 原位说明条、i+1,不计小结。
- 小结(Q12):按题去重;重练题一行,标「重练后」,取最终评分;统计 `学习了 N 道题`=去重数,`掌握 N`/`偏弱 N`按最终评分。
- activity 写入:每次评分落库时同步 upsert 当日行(去重统计在小结时校正 ok 计数)。

## 5. 服务层与「后端」调用契约

### 5.1 存储网关(`lib/storage.ts`)

每表:领域类型 + `list/get/save/delete` 签名;内存缓存为唯一读源;写 = 改缓存 → fire-and-forge SQL → `notify(key)`。初始化 `initStorage(db)` 预热全部缓存(题量 ≤ 1k,全量加载可行)。

### 5.2 Tauri 命令与 capabilities

| 能力 | 命令/插件 | 权限(capabilities) |
|---|---|---|
| SQL | `tauri-plugin-sql`(sqlite) | `sql:allow-load`, `sql:allow-execute`,`allow-select` |
| 系统全屏 | `getCurrentWindow().setFullscreen(bool)`(专注模式联动进入/退出并完整还原,ADR-0006) | `core:window:allow-set-fullscreen` |
| 问 AI 子窗口 | `WebviewWindow('ai-chat', { url, w:460, h:680 })`;已开则 `setFocus()` | `core:webview:allow-create-webview-window`, `allow-get-all-webviews`, `core:window:allow-set-focus`;**ai-chat 不进 windows 列表(零 IPC)** |
| 备份文件 | 对话框 + fs 写/读 | `dialog:default`, `fs` 限定 `app_data`/用户选择路径 |
| 外链 | `shell open`(浏览器降级 `<a target=_blank>`) | `shell:allow-open` |
| 日志 | `log` 插件 → `~/Library/Logs/<bundle>/app.log` | `log:default` |

### 5.3 官方库同步(`lib/sync.ts`)

- 源:包内 `questions.json`(首次启动播种,写入 category/source='official');远端 URL 常量 `OFFICIAL_BANK_URL`(GitHub Pages)。
- 流程:拉取 → 解析 → 与本地 official 集合对比:新增 upsert、缺失 → §3.3 级联删除 → `meta.last_sync_at`。
- 触发:启动后 2s 静默后台 + 设置页手动;失败仅更新界面提示,不阻塞任何功能;重试由用户或下次启动承担。

### 5.4 LLM 网关(`lib/generate.ts` + `lib/llm.ts`)

- Provider 配置:zhipu / deepseek / ollama(各自 base_url 与默认 model 常量表);`chat(messages, {provider, key, baseUrl})` 走 OpenAI 兼容 `/chat/completions`。
- **生成契约**:system prompt 内嵌题库质量六红线(答案不泄漏题干、追问不给提示、一题一问、概念不混、focus 不泄漏答案、answer≥50 字);user prompt = 知识点 或 JD 全文+公司(+可选简历全文,勾选时);输出 = **JSON 数组**,元素 schema `{module, difficulty, title, focus, answer[], followups[], is_code?}`;数量由模型按广度决定,上限 12。
- 预检:共享 `validateQuestion`(题干非空 / focus 非空 / answer 合计 ≥50 字 / difficulty 合法 / id 唯一);不达标 → 把错误回传模型自修正,**重试 ≤2**;仍失败 → 整批丢弃,报错(不产生 pending)。
- 产物:逐题落 `questions`(status='pending',临时 id,source='ai'|'jd');`jds.last_active_at` 刷新。
- 错误分类 → 界面文案:401/key 无效 → 「API Key 无效」+「去设置」;网络 → 「网络错误」+「重试」;解析 → 「生成结果无效,已自动重试」→ 最终失败提示。
- 测试连接:1 条最小消息的 chat 调用,成功/失败 + 错误分类(D10)。

## 6. 页面拆分与路由

### 6.1 路由表(HashRouter;侧栏八项 1:1)

| 路由 | 页面组件 | PRD | 深链参数 |
|---|---|---|---|
| `/` | `TodayPage` | M2 | — |
| `/session` | `SessionPage` | M3 | —(会话由动作开启,不落 URL) |
| `/library` | `LibraryPage` | M4 | `?cat=fe\|agent\|my`(默认取 meta.last_bank_cat)、`?qid=<id>`(选中并滚动) |
| `/review` | `ReviewPage` | M6 | — |
| `/add` | `AddPage` | M5 | `?jd=<id>`(定位按 JD 段+预选) |
| `/jd` | `JdPage` | M7 | — |
| `/resume` | `ResumePage` | M8 | — |
| `/settings` | `SettingsPage` | M9 | — |

`document.title = {页面名} · CommitCareer`(路由变化时设置)。非法参数一律回退默认值,不报错。

### 6.2 壳与全局组件

`AppShell`(Sidebar + content `<Outlet/>` + StatusBar)挂 `/session` 之外全部路由;`/session` 自绘最小 chrome(PRD 专注语义的基础)。全局挂载:`CommandPalette`(⌘K)、`ConfirmDialog`、`GuardDialog`、`Toaster(sonner)`、`FocusLayer`。

### 6.3 业务组件清单(`components/biz/`,props 契约要点)

| 组件 | 服务于 | 要点 |
|---|---|---|
| `PlanCard` / `ForecastBars`(柱 hover 显示当日到期数)/ `StatStrip` / `ActivityList` | M2 | 数据来自 storage 计数与 activity;零值行不渲染 |
| `QuestionCard`(meta/title/focus)+ `AnswerBlock` + `FollowupList` + `RatingBar` + `ResultFlash` + `ProgressHeader` + `SummaryPanel` | M3 | RatingBar 三键含 kbd;ResultFlash 就地替换按钮组 1s |
| `CodeScratchpad` | M3/M4 | CodeMirror;worker 运行;输出区 `role="log"`;切题防抖保存 |
| `NoteEditor` | M3/M4 | 受控文本域 + 保存/取消;pending 题不挂载(Q11) |
| `AskAiButton` | M3 | 调 `lib/ai-window.ts`;降级为外链 `<a>` |
| `CategoryTabs` / `FilterChips` / `ModuleSelect` / `QuestionTable` / `QuestionDetail`(+`EditQuestionForm`) | M4 | Table 行数 >200 启虚拟滚动;筛选状态归 `LibraryPage` 本地 |
| `ManualForm` / `AiGenerateBox` / `JdGenerateBox` / `GeneratingBox`(共用) | M5 | 校验错误字段下就地提示;AI 未配置 → 引导条+禁用 |
| `AuditList` / `AuditDetail` | M6 | ⌘↩/⌫ 键在 detail 聚焦时生效 |
| `JdList` / `JdDetail` / `JdForm` / `JdStats` / `ResumeMiniCard` | M7 | 表单 dirty → 全局守卫 |
| `ResumeEditor` | M8 | 字数 hook;⌘S;dirty 守卫 |
| `SettingsGroups` / `ProviderSeg` / `TestConnectionButton` / `SyncRow` / `BackupRow` | M9 | 分组卡 |
| `EmptyState` / `ErrorState`(带重试) | 全部 | 统一空态/错误态 |

### 6.4 全局热键(`lib/hotkeys.ts`,单文件,window 捕获)

实现规则(顺序即优先级):

1. 判定「可编辑焦点」:`activeElement` matches `input, textarea, select, [contenteditable="true"], .cm-content` → **只放行 ⌘K**,其余键全部交给输入。
2. ⌘K:开命令面板(含可编辑焦点);Esc 层级:Confirm/Guard(=取消)→ Palette → Focus。
3. ⌘1–8 按 §6.1 顺序切路由;⌘, → `/settings`。
4. `/session` 且会话 active 且非可编辑焦点:␣/Enter 揭示;1/2/3 评分;F 专注切换。`/resume`:⌘S 保存(dirty 时)。
5. `/library` `/review` `/jd`:↑/↓ 移动选中(调页面暴露的注册回调)。
6. `/review` 详情聚焦:⌘↩ 通过;⌫ 打开拒绝确认。

## 7. UI/UX 层约束

### 7.1 Token 体系(shadcn 语义变量承载两套主题)

- 变量集 = shadcn 官方语义名:`--background --foreground --card --card-foreground --muted --muted-foreground --primary --primary-foreground --accent --border --input --ring --destructive` + 扩展 `--success --warning --radius`;**PRD 语义映射**:纸面=paper→`--background`、卡面→`--card`、加深输入面→`--input`、朱砂→`--primary`、ok/warn/bad→`--success/--warning/--destructive`。
- 浅色「暖纸」与 `.dark`「夜读」两套值同文件定义(`@theme inline` 映射);切换 = `html.dark` class,即时生效,值持久化 `meta.theme`;**禁止页面级魔法色值/新色调**。
- 展示字体:题干/页头/小结标题用 `--font-display`(宋体系);正文系统无衬线。

### 7.2 字号与密度(硬值)

正文 `text-sm`(14px);辅助 `text-xs`(12px);题干 `text-[22px]`、专注态 `text-[27px]`(允许的任意值白名单仅此两处);详情标题 `text-base`;页头 `text-lg`;圆角:按钮/输入 `rounded-md`、卡片 `rounded-xl`;间距走 tailwind 4/8 栅格。

### 7.3 组件白名单(仅此;缺则官方方式补源码)

`Button Dialog AlertDialog Input Textarea Select RadioGroup Checkbox Command Tooltip Badge Table ScrollArea Separator` + `sonner Toaster`。**禁用**:Tabs(添加题目是三段平铺,D7)、Drawer/Sheet(管理面就地操作)、DropdownMenu(筛选用芯片)。

### 7.4 交互细节约束

hover 反馈只用色/影(150–220ms),不位移;`focus-visible` 全局 ring;`prefers-reduced-motion` 关过渡;评分推进淡出固定 220ms;不可逆确认的 Esc=取消且初始焦点在取消钮(D20);空态必须 `EmptyState` 组件;长文本列 max-width 38rem。

### 7.5 文案与检查

界面文案一律取 PRD 固定短语/术语表;提交前跑禁词检查(仓库脚本级 grep):`新题|草稿区|生题|定向生题|没学过|未学|档案|训练|求职中枢|待确认` 在用户可见字符串零命中(工程标识符除外)。

## 8. 开发层约束

### 8.1 目录结构

```
desktop/src/
├─ app/            # App.tsx 路由表、AppShell、providers
├─ pages/          # 9 个路由页(§6.1)
├─ components/
│   ├─ ui/         # shadcn 官方源码组件
│   └─ biz/        # §6.3 业务组件
├─ lib/            # storage/scheduler/session/bank/generate/llm/sync/hotkeys/ai-window/guard
├─ workers/        # js-runner.worker.ts
└─ styles/         # tokens(tailwind v4 @theme inline + 两主题)
```

### 8.2 工程纪律(引用 AGENTS.md,违反即返工)

npm 命令从仓库根;依赖 `-w desktop`;conventional commits 中文;feature 分支 `--no-ff` 回 main;不 push;文档同步(行为变了当轮更新)。

### 8.3 质量门与测试矩阵

| 层 | 工具 | 必测(对应 PRD 验收) |
|---|---|---|
| 单测 | vitest | scheduler 数值样例(§4.1 五例)/ deriveStatus 五档互斥 / 队列构造五类+上限 / 重练覆盖与去重 / 消失题跳过 / validateQuestion / 生成 JSON 解析+自修正桩 / storage 往返与级联(mock) |
| e2e | playwright(web 层,mock IPC+LLM) | M1:⌘1-8/⌘,/⌘K/热键豁免(草稿纸内空格)/徽标联动;M2:零值行/全清态/复习全量/学习截断文案;M3:全键盘流/重练一次/结果条归属/会话保持与退出/空态/草稿纸输入与持久;M4:五档筛选/官方保护/编辑守卫/删除确认/笔记标/⌘K 落点;M5:手动校验/AI 未配置引导/生成→pending/深链预选;M6:通过/拒绝确认/编辑后通过/空态;M7:CRUD/置顶/守卫/统计;M8:字数/⌘S/守卫恢复;M9:主题即时/测试连接/同步/导出导入确认;M10:断网主流程/Key 不回显 |
| 真机 | `npm run tauri dev` / smoke | 迁移、SQL 权限、全屏、ai-chat 窗口、真 LLM 一轮 |
| 静态 | tsc --noEmit / vite build / §7.5 禁词 grep | 全绿才可合 |

**覆盖层声明**:e2e 全绿 ≠ 桌面端已验证(sqlite/权限/真 LLM 在 e2e 盲区)——报告必须注明层。

### 8.4 性能预算

表格 >200 行虚拟化;路由切换与评分推进感知 <300ms;同步/生成一律后台或按钮内联加载,不冻结 UI;启动首帧 <1.5s(缓存预热放 idle)。

### 8.5 错误处理与日志

统一 `ErrorState`(说明+重试/去设置);存储失败 toast + 写 `app.log`;LLM 错误分类见 §5.4;任何 catch 不静默。

### 8.6 安全

API Key 仅存本机 `secrets`,界面永不回显明文;ai-chat 窗口零 IPC;worker 3s 强杀;无 eval(用户代码仅 worker 沙箱)。

## 9. PRD 验收 → 实现落点映射

| PRD 模块验收 | 实现落点 | 测试 |
|---|---|---|
| M1 键盘/徽标/豁免 | hotkeys.ts + AppShell | e2e-M1 |
| M2 计数/零值/全清/截断文案 | storage 计数 + PlanCard | 单测+e2e-M2 |
| M3 全部(评分/重练/反馈/会话/草稿纸/专注) | session.ts + QuestionCard 族 | 单测+e2e-M3 |
| M4 筛选/保护/守卫/笔记/落点 | LibraryPage + deriveStatus | e2e-M4 |
| M5 校验/引导/生成/深链 | AddPage + generate.ts | 单测+e2e-M5 |
| M6 通过/拒绝/编辑通过 | ReviewPage | e2e-M6 |
| M7 CRUD/置顶/守卫/统计 | JdPage | e2e-M7 |
| M8 字数/保存/守卫 | ResumePage | e2e-M8 |
| M9 主题/连接/同步/备份 | SettingsPage + sync/backup | e2e-M9+真机 |
| M10 离线/Key/下架/覆盖 | 降级层 + §3.3 | 真机 smoke |

## 10. 本文档自行拍板的事项(可推翻)

虚拟化阈值 200 行;`/review` `/jd` `/resume` 独立路由(与侧栏 1:1);activity 表设计(连续天数/记录);备份 JSON 信封 v1(不含 secrets);AI 未配置判定=secrets 无 key;`is_code` 列与草稿纸默认展开联动;错误文案集;e2e 矩阵粒度。grilling R2 六值(Q7 首评 1/2/3 天、Q8 due 升序、Q9 再过一遍不限、Q10 已排期不进状态栏/⌘K、Q11 pending 无笔记、Q12 小结去重)已按推荐固化为规格。

## 11. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-09-09 | v1.0 | 首版:依据 PRD v2.2 + ADR 0001–0006 产出;含 DDL/调度算法/调用契约/路由与组件拆分/UI 与开发约束/测试矩阵/验收映射 |
