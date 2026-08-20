-- 官方题库本地物化(2026-08-20,「同步官方题库」功能)。
-- YAML 仍是唯一真相源;此表是远端 questions.json 的本地投影,可随时被同步覆盖。
-- 首次启动用包内 questions.json 播种;之后设置页手动同步 + 启动自动同步。
-- 我的库仍在 questions 表,两表互不污染(ADR-3)。
CREATE TABLE IF NOT EXISTS official_questions (
    id          TEXT PRIMARY KEY,                  -- 官方 id 一旦发布不可变(ADR-9)
    category    TEXT NOT NULL,
    module      INTEGER NOT NULL,
    module_name TEXT NOT NULL,
    index_real  REAL NOT NULL,
    difficulty  TEXT NOT NULL CHECK(difficulty IN ('初','中','高')),
    title       TEXT NOT NULL,
    focus       TEXT NOT NULL DEFAULT '',
    answer      TEXT NOT NULL,                     -- JSON array
    followups   TEXT NOT NULL,                     -- JSON array
    tags        TEXT NOT NULL,                     -- JSON array
    synced_at   INTEGER NOT NULL                   -- 最后一次写入时间
);

-- 分类元信息(name/description 不可从题目行推导)
CREATE TABLE IF NOT EXISTS official_categories (
    slug        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    synced_at   INTEGER NOT NULL
);
