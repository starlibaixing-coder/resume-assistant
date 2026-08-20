// 应用密钥(API key 等)—— SQLite secrets 表的内存缓存 + await 持久化。
// 2026-08-20 从 OS keyring 迁来(ADR-8 修订):未签名 dev 二进制每次重编都被 macOS
// 视为新应用,读写钥匙串反复弹授权框;keyring 各平台后端(钥匙串/凭据管理器)差异也大。
// 自用本地工具,key 存本地库的安全等级可接受,换全平台一致 + 零弹窗。
// 非 Tauri 环境(浏览器/e2e)降级内存(刷新即失,仅测试用,与旧 keyring 降级同语义)。

import type { Database } from '@tauri-apps/plugin-sql';

export const LLM_API_KEY_NAME = 'llm-api-key';

const cache = new Map<string, string>();
let db: Database | null = null;

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function initSecretsDb(database: Database): void {
  db = database;
}

export async function loadSecretsFromDb(): Promise<void> {
  if (!db) return;
  const rows = await db.select<Array<{ name: string; value: string }>>('SELECT name, value FROM secrets');
  for (const r of rows) cache.set(r.name, r.value);
}

export async function getSecret(name: string): Promise<string> {
  return cache.get(name) ?? '';
}

// 写失败抛出(调用方提示用户),不静默——key 是用户显式录入的凭据
export async function setSecret(name: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    cache.delete(name);
    if (db) await db.execute('DELETE FROM secrets WHERE name=$1', [name]);
    return;
  }
  cache.set(name, v);
  if (db) {
    await db.execute(
      'INSERT INTO secrets(name, value) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=$2',
      [name, v],
    );
  }
}

// ===== 测试钩子(仅测试用) =====
export function _resetSecretsForTest(): void {
  cache.clear();
  db = null;
}

export function _setSecretsDbForTest(mockDb: Database): void {
  db = mockDb;
}
