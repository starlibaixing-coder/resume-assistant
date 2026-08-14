-- SQLite schema 初始化(四表)。见设计稿 ADR-3/4/9/10。
-- 官方题库走 questions.json(只读),questions 表只存"我的库"(AI 生成 + 用户加)。

-- 我的库题。id 跨库全局唯一(my-<slug>.<module>.<idx>,ADR-9)。
CREATE TABLE IF NOT EXISTS questions (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    module      INTEGER NOT NULL,
    module_name TEXT NOT NULL,
    index_real  REAL NOT NULL,                 -- index 是 SQL 保留字,改名
    difficulty  TEXT NOT NULL CHECK(difficulty IN ('初','中','高')),
    title       TEXT NOT NULL,
    focus       TEXT NOT NULL DEFAULT '',
    answer      TEXT NOT NULL,                 -- JSON array (string[])
    followups   TEXT NOT NULL,                 -- JSON array
    tags        TEXT NOT NULL,                 -- JSON array
    status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved')),  -- ADR-10 草稿区
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

-- SM-2 复习进度,跨官方 + 我的库(按 id)。ADR-9:官方题 agent.01.1 + 我的 my-... 共用此表。
CREATE TABLE IF NOT EXISTS review_state (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,
    interval    INTEGER NOT NULL,
    ease        REAL NOT NULL,
    reps        INTEGER NOT NULL,
    due         INTEGER NOT NULL,
    last_review INTEGER
);

-- 笔记(HTML,Tiptap WYSIWYG 产物)
CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    category   TEXT NOT NULL,
    content    TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);

-- 求职目标档案(单行,id=1)。ADR-4 中枢:简历/JD/公司/偏好,功能 ③④⑤ 共享。
CREATE TABLE IF NOT EXISTS profile (
    id          INTEGER PRIMARY KEY CHECK(id = 1),
    resume      TEXT NOT NULL DEFAULT '',
    jd          TEXT NOT NULL DEFAULT '',
    company     TEXT NOT NULL DEFAULT '',
    preferences TEXT NOT NULL DEFAULT '{}'      -- JSON
);
