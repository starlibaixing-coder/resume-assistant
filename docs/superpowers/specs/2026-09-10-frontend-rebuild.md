# CommitCareer 桌面端前端从零重建设计 · v12「纸面工作台」

| | |
|---|---|
| **日期** | 2026-09-10 |
| **状态** | 已实施(feature 分支 `feature/frontend-rebuild`,`--no-ff` 合回 main) |
| **唯一依据** | [`desktop-prd.md`](../../product/desktop-prd.md) v2.3 + [`desktop-tech-design.md`](../../product/desktop-tech-design.md) v1.1 |
| **范围** | `desktop/src/` 全量删除重写;后端(Tauri Rust / tauri.conf / capabilities)零改动,差距见 [`desktop-backend-todo.md`](../../product/desktop-backend-todo.md) |

---

## 1. 设计概念:纸面工作台

一句话:**暖纸书页上放一张冷静的工作台骨架**。内容区是"纸"(米纸底、墨字、宋体标题),管理面是"工作台"(列表+详情双栏、筛选按钮组、就地编辑)。视觉上与旧版(56px 图标栏+顶部工具条)形神俱变,第一眼可辨。

- **双主题**(同一文件定义,`html.dark` 切换,即时生效,持久 `meta.theme` + localStorage 镜像防首帧闪色):
  - 浅色「暖纸」:纸面 `#f5f0e6` / 卡面 `#fbf8f1` / 墨字 `#2b2318` / 朱砂 `#bc3f2c`
  - 深色「夜读」:暖黑纸 `#191411` / 卡面 `#221b16` / 暖米字 `#ece2cf` / 朱砂提亮 `#e06a4b`
- **取色纪律**:组件只允许语义 token(`--background/--card/--muted/--primary/--success/--warning/--destructive/--input/--border/--ring`),禁魔法色值;v9 的「无边框、面色分层」保留。
- **字体**:展示字体 `--font-display`(宋体栈:Songti SC/STSong/Noto Serif SC)用于页头、题干(22px,专注 27px)、小结标题;正文系统无衬线 14px。
- **图标**:lucide-react,15px 语境统一 strokeWidth 1.75;无 emoji。

## 2. IA 与壳

- **八路由 = 侧栏八项**(⌘1–8 顺序一致):今日 `/` · 学习队列 `/session` · 题库 `/library` · 审核 `/review` · 添加题目 `/add` · JD `/jd` · 简历 `/resume` · 设置 `/settings`(⌘,)。AppShell 挂全部路由;`/session` 平时有壳,专注模式由 FocusLayer 隐壳。
- **壳 = 文字侧栏(216px)+ 无顶栏 + 底部状态栏**:
  - 侧栏:朱砂方章品牌位;【学习】【求职】两组;审核项带待审数药丸;当前项朱砂浅底;hover 显 ⌘N 快捷键。
  - 状态栏:待学习/待复习/待审核计数(可点击直达)+ 连续 N 天(火焰,>0 绿色)|右侧官方库同步状态 + 主题快切。计数全部走 `deriveStatus` 唯一口径。

## 3. 页面语法

| 页面 | 语法 | 要点 |
|---|---|---|
| 今日 | 驾驶舱纵排 | 问候+日期;**主计划卡 hero**(第一件未完成事 = 唯一主 CTA:到期优先复习,其次学习,截断 batch_size;hero 副文案定义「复习日」:由上次掌握情况决定,到日即到期、拖多久不消失);题库概览四卡;最近学习(按天聚合,措辞「学了 N 道 · 掌握 M」,不出现「评分」;空态缺省)。零值不渲染:复习预测模块已移除(2026-09-10 用户确认);全清走 EmptyState+「学习全部题目」 |
| 学习队列 | 居中单列卡片流 | 进度条头(类型徽章+i/N+专注+结束)→ meta 徽章 → 宋体题干 → 揭示按钮(␣)→ 答案要点编号列表+追问 → 三键评分(1/2/3,kbd 提示)→ **结果条语义色 1s → 220ms 淡出 → 引擎 `confirmAdvance()` 推进**(评分期间锁定,反馈归属当前题);评 no 自动追加重练副本;消失题说明条自动跳过不计小结;小结按题去重(重练后标记);草稿纸/笔记/问 AI 收在底部工具行 |
| 题库 | 全宽列表 + 侧边抽屉详情(2026-09-10 用户指定,弃双栏常驻详情) | 行1 分类页签(**「全部」= 官方+我的已入库聚合**,承载跨库状态深链)+搜索(右对齐);行2 筛选工具栏:状态/难度/来源(仅我的)/模块各一个 Select(默认项「全部…」,等宽 w-40 h-9 同排)+激活时「重置」;行=状态药丸+题干+模块+难度;>200 行窗口化虚拟滚动(行高 41px);点击行开抽屉:完整题面+来源行(source_ref 口径)+笔记+动作(练习这一题/编辑就地/删除 AlertDialog/官方题可复制入库);深链 `?cat= ?qid= ?status=`,↑/↓ 移动选中(抽屉内容跟随),分类记忆 `meta.last_bank_cat` |
| 审核 | 双栏工作台(46%列表) | 列表 created_at DESC,来源行显示 `source_ref` 快照;详情=预览+通过(⌘↩)/拒绝(⌫→AlertDialog,初始焦点取消)/编辑后通过(D8:就地改完直接通过) |
| 添加题目 | 三段平铺卡(禁 Tabs,D7) | 手动(校验就地提示,人写即人审直接 approved)/ AI 知识点(未配置→引导条+禁用)/ 按 JD(下拉选 JD+「结合简历」勾选,简历空禁用+提示);生成走 GeneratingBox 内联加载,产物 pending;`?jd=` 高亮第三段+预选 |
| JD | 双栏工作台 | 列表按 last_active_at DESC+新建;详情=标题+统计(已生成/待审,按 jd_id)+按 JD 生成(→`/add?jd=`)+就地编辑表单(dirty 全局守卫)+删除 AlertDialog(删后选中第一项;题目保留,来源回退 source_ref) |
| 简历 | 编辑器版式 | 标题栏:字数+保存状态+保存(⌘S);全高 Textarea 卡;dirty 走全局守卫 |
| 设置 | 分组卡纵列 | AI 服务(RadioGroup 三预设+BaseURL+模型+Key 不回显+测试连接三分类报错)/ 学习偏好(batch_size)/ 外观(暖纸·夜读,即时切)/ 官方题库(同步三态反馈)/ 备份(JSON 信封导出、YAML 题目导出、导入 AlertDialog 确认整库覆盖)/ 关于 |

## 4. 全局交互

- **⌘K 命令面板**(cmdk):动作(复习/学习 N/学习全部题目/去审核,与今日页、学习队列入口同名同义,无「混合」类型)+ 前往(八路由)+ 题目(全库字段包含式过滤,选中落 `?qid=` 抽屉)+ 按 JD 生成。
- **热键**(§6.4 单文件 `hotkeys.ts`):可编辑焦点只放行 ⌘K;Esc 层级 Confirm/Guard→Palette→Focus;`/session` ␣/Enter 揭示、1/2/3 评分、F 专注;`/resume` ⌘S;`/library /review /jd` ↑/↓ 走 `page-hooks` 注册回调。页面勿再手写 window keydown。
- **脏守卫**(`guard.ts` + GuardDialog):JD 表单/题目编辑/简历注册 isDirty;一切导航(侧栏/⌘K/⌘数字/历史键)经 `requestNavigation`,确认「放弃更改」才放行;Esc=继续编辑。
- **专注模式**(`focus.ts`):`html.cc-focus` 隐 `[data-chrome]`(侧栏+状态栏)、题干 27px、隐藏工具行;Tauri 联动系统全屏(进出完整还原),浏览器降级纯 CSS。
- **问 AI**(`ai-window.ts`):题干+考察方向写入剪贴板;`ai-chat` WebviewWindow(460×680,已开则 setFocus,零 IPC);浏览器降级新标签页。
- **toast**:唯一通道 sonner;存储持久化失败 toast + app.log。

## 5. 架构与实现落点

```
src/
├─ app/        App(HashRouter+boot 闸+全局件) app-shell sidebar status-bar command-palette guard-dialog
├─ pages/      today session library review add jd resume settings(9 文件)
├─ components/ui/     shadcn 白名单 15 件(button badge input textarea label select radio-group
│                     checkbox dialog alert-dialog command tooltip table separator sonner)
├─ components/biz/    states status-badge markdown-text forecast-bars session-parts
│                     code-scratchpad note-editor edit-question-form question-detail
├─ lib/        types db storage scheduler bank session activity generate llm sync backup
│              hotkeys guard page-hooks focus ai-window js-runner markdown theme smoke logger utils hooks
├─ workers/    js-runner.worker.ts(worker 沙箱,3s 强杀,异步输出转发)
└─ index.css   token 体系(@theme inline 官方模式 + 两主题值)
```

- **单向数据流**:storage 内存缓存唯一读源;写=改缓存→fire-and-forget SQL→notify;UI 经 `useSyncExternalStore`(全局版本号做稳定快照键)。缓存 getter 返回**副本**(identity 变化驱动 useMemo,踩过引用不变导致 UI 不刷新的坑)。
- **会话引擎**:模块级单例,状态仅内存;`buildQueue` 纯函数(可注入时钟);评分锁定(`locked`)由 UI 结果条播完调 `confirmAdvance()` 推进;activity 由 `rating_log`(题×日一行,最终评分 upsert)派生。
- **调度**:SM-2 §4.1 逐条实现;due=自然日 00:00(本地时区),毫秒存储(与既有数据一致,文档"秒"系笔误,见 TODO 文档);五档 `deriveStatus` 筛选与展示共用。

## 6. 与技术设计文档的实现差异(后端现实优先)

| 文档说 | 实际(前端照此适配) |
|---|---|
| 单表 questions(官方+我的三态同表) | 双表:`official_questions`(物化只读)+ `questions`(我的),服务层统一 Question 视图 |
| `meta` / `activity` / `last_rating` / `source_ref` / `jd_id` / `is_code` | 后端无 → **前端启动幂等 DDL 补齐**(`ensureSchema`),见 TODO 文档 |
| due epoch 秒 | 既有数据毫秒 → 前端按毫秒,due=自然日 00:00 不变 |
| 库文件 app.db | 实际 `sqlite:resume.db` |
| questions.module TEXT | 实际 INTEGER(module_name TEXT 承载名称) |
| 笔记 HTML(Tiptap) | NoteEditor 受控文本域纯文本;历史 HTML 展示时转纯文本,不回写 |
| 小结触发 activity 重算 | 改为评分即写 rating_log(按题重算当日行),中途退出不丢 |

§4.1 文档样例「间隔 30 天评 fuzzy → EF 2.5→2.18」与自身公式矛盾(q=4 增量为 0),**实现以公式为准**(EF 不变),单测已锚定,建议修订文档该行。

## 7. 质量门(实施完成时点)

- 单测 40/40:SM-2 五锚点+streak、五档互斥+计数守恒、队列五类+上限+截断、重练入队/覆盖/去重、消失题跳过、validateGenerated、生成自修正桩(≤2 重试,失败整批丢弃)、storage 往返/级联顺序/通过/复制/信封不含 secrets、ensureSchema 幂等
- e2e 10/10(web 层,mock 远端+内存存储):壳渲染/⌘1–8/⌘K 三组面板/状态栏联动/今日 hero/复习全流程(含重练副本)/空会话/草稿纸运行/题库筛选+行选中+单题练习/qid 深链/审核通过+拒绝确认
- typecheck(tsc -b strict)0 错;vite build 通过;禁词 grep 0 命中;Rust 测试 6/6(后端未动)
- 截图目检:暖纸 9 页 + 夜读 5 页(`desktop/scripts/rebuild-shots.mjs` 可复现)
- **覆盖层声明**:以上均为 web 层;真 SQLite/系统全屏/ai-chat 窗口/真 LLM 需 `npm run tauri dev` + `npm run smoke`(smoke.ts 已适配新存储,协议不变)

---

## 7.1 表单与筛选规范(v1,全站强制)

1. **标签在字段上方**(shadcn Label),补充说明以 muted 括注跟在标签后;禁止"左标签+右字段"网格与"placeholder 当标签"。
2. **输入控件高度统一 h-9**;短字段两列 `grid-cols-2 gap-4`,长字段独占整行;字段垂直间距 `space-y-4`。
3. **必填** = 标签前朱砂星号;校验错误就地红字,不弹窗。
4. **动作按钮固定在表单底部右对齐一行**(ghost 取消 + primary 确认);所有按钮 `white-space: nowrap`,任何宽度不换行。
5. **筛选工具栏**(列表页):每个维度一个 Select(默认项自描述:「全部状态/全部难度/全部来源/全部模块」)+ 搜索输入,全部 h-9、同排左对齐流动;存在激活筛选时出现「重置」按钮。
6. 侧栏分组名用平实词:**学习 / 求职**(弃「研习」——生造书面语)。

## 8. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-14 | 长文本编辑升级所见即所得(用户指定「### 输入完就是三级标题,不要切换」):新增 biz 组件 `markdown-editor`(Tiptap v2 + tiptap-markdown,依赖以 `-w desktop` 规范安装),接入简历/答案要点/笔记三处;简历「预览」按钮移除(编辑即渲染),答案要点语义从「每行一个要点」改「一段一个要点」(`pointsToMarkdown`/`markdownToPoints` 空行分段,展示端仍走 marked),存储保持 Markdown 格式不变;同轮:设置页服务商切换即时填充预设并随保存落库(原实现被 savedBaseUrl 门槛卡死)、品牌图标重绘(朱砂印章 C,`tauri icon` 全套重生成,除白边)、侧栏设置项补 `group` class 让 ⌘, 悬停提示生效、文案对齐术语表(禁词清零/官方题库/道题量词) |
| 2026-09-10 | 三轮决策自审:题库新增「全部」聚合页签(官方+我的已入库),状态栏/今日概览的全局计数深链统一 `?cat=all&status=…`,修复「全局计数跳单分类视图」的落差;library 对 `?status=` 深链做 params→state 同步(同页导航时生效);切分类重置来源/模块筛选防残留;⌘K 措辞与「复习日」术语一致;
| 2026-09-10 | 二轮文案修订(用户六问):引入面向用户概念「复习日」(由上次掌握情况决定,到日即到期、拖多久不消失),hero 与入口说明据此改写并新增「查看这些题」深链;「练习全部题目」更名「学习全部题目」(引擎名:全库学习)——「练习」引入新动词违反动词统一;「评分」从 UI 清退,最近学习措辞改「学了 N 道 · 掌握 M」;审核页头说明精简(换行根因);
| 2026-09-10 | 首版实施(用户评审九条细节反馈后修订):答案/追问去 38rem 上限改铺满;评分三键去 kbd 数字;专注/结束按钮明确化;答案可隐藏(hideAnswer);学习队列空态改三入口卡(各带说明);复习预测仅有到期数据时出现、去 00:00 术语;最近学习加缺省;题库筛选区带标签分组对齐、「我的」→「我的题库」、难度筛选按钮用简单/中等/困难;添加题目按频率排序(AI→按JD→手动)、引导条精确到缺项、旧版 localStorage llm-config 启动迁移(migrateLegacyLlmConfig)、题目表单标签上方对齐+答案 Markdown 预览;JD 表单标签上方对齐;简历新增导入 .md/导出 .md/Markdown 预览(多份简历 → 后端 TODO B6);术语对齐(官方复制/学习队列/道题量词) |
