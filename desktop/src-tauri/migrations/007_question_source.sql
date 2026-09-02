-- 题目来源标注(2026-09-02 IA 重构):三类出题入口(手动/AI/按 JD)产物都进我的题库,
-- 来源在浏览页可见。source 取值:'manual' | 'ai' | 'jd' | 'copy'(官方题复制)。
-- 存量行:官方复制(source_id 非空)标 'copy';其余默认 'manual'
-- (早期 AI 生成行无法与手动行区分,按 manual 处理,自用数据量小可接受)。

ALTER TABLE questions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'
    CHECK(source IN ('manual', 'ai', 'jd', 'copy'));

UPDATE questions SET source = 'copy' WHERE source_id IS NOT NULL;
