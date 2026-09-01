-- 求职中枢一期(审计批次 3,2026-08-28 提案 / 2026-08-31 确认):
-- JD 从 profile 单字段升级为独立 jds 表(多 JD 管理),JD 定向生题改为从 JD 条目发起。
-- 存量平移:profile.jd 非空时搬成首条 JD(幂等——jds 已有行则不再插),随后 profile 撤 jd 列。
-- 标题缺省:公司名,无公司取 JD 前 12 字(与旧 jdBatchName 规则一致)。

CREATE TABLE IF NOT EXISTS jds (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    company        TEXT NOT NULL DEFAULT '',
    content        TEXT NOT NULL,
    created_at     INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
);

INSERT INTO jds (title, company, content, created_at, last_active_at)
SELECT
    COALESCE(NULLIF(TRIM(p.company), ''), SUBSTR(TRIM(p.jd), 1, 12), '未命名 JD'),
    TRIM(p.company),
    p.jd,
    CAST(STRFTIME('%s', 'now') AS INTEGER) * 1000,
    CAST(STRFTIME('%s', 'now') AS INTEGER) * 1000
FROM profile p
WHERE p.id = 1
  AND TRIM(COALESCE(p.jd, '')) != ''
  AND NOT EXISTS (SELECT 1 FROM jds);

ALTER TABLE profile DROP COLUMN jd;
