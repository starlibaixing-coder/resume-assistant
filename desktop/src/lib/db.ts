// SQL 数据库打开与降级:isTauri()===false 时返回 null(内存模式,只读缓存不持久)。
// 库文件由后端迁移注册表管理(sqlite:resume.db);本模块只负责打开。

import type Database from '@tauri-apps/plugin-sql';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 打开主库。smoke 模式传 'sqlite:smoke.db'(后端已为它注册同一套迁移)。 */
export async function openDb(file = 'sqlite:resume.db'): Promise<Database | null> {
  if (!isTauri()) return null;
  const { default: Database } = await import('@tauri-apps/plugin-sql');
  return Database.load(file);
}
