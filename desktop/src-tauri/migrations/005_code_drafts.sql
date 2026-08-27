-- 代码草稿纸(刷题卡片内按题保存的代码,2026-08-26)。
-- 与 notes 同模式:id 即题目 id(跨官方+我的库),content 为纯文本代码。
-- 语言先只有 JS(运行器是 Web Worker 沙箱),将来多语言再加列。
CREATE TABLE IF NOT EXISTS code_drafts (
    id         TEXT PRIMARY KEY,
    category   TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);
