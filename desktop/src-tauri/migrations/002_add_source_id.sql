-- 官方题副本溯源(ADR-3 复制后改):记录来源官方题 id,
-- 浏览页据此显示"已在我的库"标识(getCopiedSourceIds)。
-- 旧副本行(此列加入前)为 NULL,视为无溯源,不影响读写。
ALTER TABLE questions ADD COLUMN source_id TEXT;
