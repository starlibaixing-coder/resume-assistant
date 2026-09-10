# CommitCareer 桌面端 · 后端 TODO

| | |
|---|---|
| **日期** | 2026-09-10 |
| **背景** | 前端按 [`desktop-tech-design.md`](./desktop-tech-design.md) v1.1 从零重写(设计见 [`../superpowers/specs/2026-09-10-frontend-rebuild.md`](../superpowers/specs/2026-09-10-frontend-rebuild.md));**后端(Tauri Rust / tauri.conf / capabilities)零改动**。凡前端需要而后端未提供的能力:界面已完成、行为降级或走替代通道,正式支持列入本文档 |

## A. 前端已用「幂等补列 DDL」垫住的部分(建议正式化进 Rust 迁移)

前端存储网关启动时 `ensureSchema()` 逐条执行以下幂等 DDL(重复执行安全)。它们目前只存在于前端,新装环境依赖前端首启执行;**建议原样落成 `008_frontend_supplement.sql` 进 `src-tauri/migrations/` + Rust 注册表 + 表集合断言测试**,前端 ensureSchema 保留为兼容层(执行时吞 duplicate column 错误)。

```sql
ALTER TABLE review_state ADD COLUMN last_rating TEXT;              -- 五档状态的 已掌握/已排期 区分
ALTER TABLE questions   ADD COLUMN source_ref TEXT NOT NULL DEFAULT '';  -- 生成来源快照(D27)
ALTER TABLE questions   ADD COLUMN jd_id INTEGER;                  -- 按 JD 统计(E2);JD 删除后悬空
ALTER TABLE questions   ADD COLUMN is_code INTEGER NOT NULL DEFAULT 0;   -- 代码题徽标
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- batch_size / theme / last_bank_cat / last_sync_at / ll_provider / ll_base_url / ll_model
CREATE TABLE IF NOT EXISTS rating_log (                     -- activity 派生源:题×自然日一行,最终评分
  question_id TEXT NOT NULL, day TEXT NOT NULL,
  rating TEXT NOT NULL, rated_at INTEGER NOT NULL,
  PRIMARY KEY(question_id, day));
```

> 注:`review_state.last_rating` 对既有行为 NULL,`deriveStatus` 将其归入「已排期」,与旧行为兼容。

## B. 能力缺失:前端已做界面,等待后端插件/命令

| # | 能力 | 现状与降级 | 后端要做的 |
|---|---|---|---|
| B1 | **备份导出到文件** | 设置页「导出备份(JSON)/导出我的题目(YAML)」按钮已实现;web 降级走 Blob 下载,**真机点击会提示"待后端支持"** | capabilities 加 `dialog:default` 与 `fs`(限定用户选择路径);或提供 `save_file` 自定义命令。前端调用点已集中在 `lib/backup.ts downloadTextFile()` |
| B2 | **外链打开** | capabilities 无 `shell:allow-open`;问 AI 走子 WebviewWindow(已有权限)不受影响;通用外链场景目前渲染纯文本 | capabilities 加 `shell:allow-open`;前端 `openAskAi` 浏览器降级分支可复用它 |
| B3 | **ai-chat 子窗口随主窗退出关闭(D21)** | 前端只创建/聚焦;主窗关闭时 ai-chat 是否退出取决于平台默认行为,未验证 | 在 Rust 侧 `WindowEvent::CloseRequested/Destroyed` 或前端 `onCloseRequested` 里显式关闭 label=`ai-chat` 的 webview |
| B4 | **备份导入的原子事务** | 导入走 BEGIN→…→COMMIT 两条 `execute`,同一连接可回滚,但**非严格单事务**(插件逐条往返,中断窗口存在) | 插件层无事务 API;建议后端加 `apply_backup(json)` 自定义命令, rusqlite `transaction()` 内整库覆盖 |
| B5 | **真机验证** | smoke 前端(`lib/smoke.ts`)已适配新存储,协议(is_smoke_mode/smoke_report/smoke_finish)不变;尚未在真机跑过 | `npm run smoke` 跑一轮;`npm run tauri dev` 手测:系统全屏进出、ai-chat 窗口、真 LLM 一轮、官方库同步 |
| B6 | **多份简历** | 简历页当前单份(profile.resume);导入/导出/预览已支持 | 新表 `resumes(id, name, content, updated_at)` + 迁移;简历页改为列表切换;「按 JD 生成 · 结合简历」需选择用哪份(默认最近编辑) |

## C. 技术设计文档与现实不符(建议下轮修订文档,前端已按现实适配)

1. **库文件名**:文档 §3 写 `{app_data_dir}/app.db`,实际 Rust 注册的是 `sqlite:resume.db`。二选一:改文档,或迁移库文件(涉及存量数据搬家,不建议)。
2. **due 单位**:文档 §3.1 写 epoch 秒,既有数据为毫秒。前端按毫秒(自然日 00:00 语义不受影响)。
3. **单表 questions**:文档 §3.1 三态同表;实际为 `official_questions`(物化只读)+ `questions`(我的)双表,服务层统一视图。文档 §3.3 级联清理语义已在前端等价实现(官方下架→连带清进度/笔记/草稿/评分日志)。
4. **questions.module**:文档 TEXT;实际 INTEGER(module_name 承载名称)。
5. **§4.1 数值样例笔误**:"间隔 30 天评 fuzzy,EF 2.5→2.18"与公式矛盾(q=4 增量为 0,EF 不变);实现与单测以公式为准。
6. **activity 表**:文档单表聚合;前端用 `rating_log`(题×日)+派生,语义等价且支持"按题重算当日行",备份信封已含。若正式化 B1/B4 可一并把 rating_log 迁为文档式 activity 表,或修订文档。

## D. 依赖安装记录(前端侧,已完成)

`npm install @radix-ui/react-checkbox @radix-ui/react-separator -w desktop`(shadcn Checkbox/Separator 官方源码所需);其余依赖复用原 package.json,无新增运行时框架。
