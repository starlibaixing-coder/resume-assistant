-- 应用密钥(API key 等),name-value 单表。
-- 2026-08-20 ADR-8 修订:key 从 OS keyring 迁入本地库——未签名 dev 二进制
-- 每次重编都被 macOS 视为新应用,钥匙串读写反复弹授权;SQLite 全平台一致零弹窗。
CREATE TABLE IF NOT EXISTS secrets (
    name  TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
