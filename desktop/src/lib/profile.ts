// 求职档案(ADR-4 中枢)—— profile 表单行(id=1)的内存缓存 + await 持久化 + pub-sub。
// 求职中枢一期(2026-08-31):JD 迁去 jds 表(lib/jd.ts,多 JD 管理),此处只剩公司 + 简历;
// 简历多版本留二期(加表成本低,先不留死 schema)。preferences 字段本阶段不用(留给阶段 3)。

import type Database from '@tauri-apps/plugin-sql';
import { logger } from './logger';

export interface JobProfile {
  company: string;
  resume: string;
}

// 缓存(null = 未录入);db 懒注入(initStorage),非 Tauri 环境降级纯内存
let cache: JobProfile | null = null;
let db: Database | null = null;
const listeners = new Set<() => void>();

export function subscribeProfile(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function initProfileDb(database: Database): void {
  db = database;
}

export async function loadProfileFromDb(): Promise<void> {
  if (!db) return;
  const rows = await db.select<Array<{ company: string; resume: string }>>(
    'SELECT company, resume FROM profile WHERE id=1',
  );
  const r = rows[0];
  cache = r ? { company: r.company ?? '', resume: r.resume ?? '' } : null;
}

// null = 从未录入;三个字段可能部分为空(校验放在消费侧,如 JD 定向要求 jd 非空)
export function getProfile(): JobProfile | null {
  return cache;
}

export async function saveProfile(p: JobProfile): Promise<JobProfile> {
  cache = { company: p.company, resume: p.resume };
  if (db) {
    try {
      await db.execute(
        'INSERT INTO profile(id, company, resume) VALUES(1,$1,$2) ' +
          'ON CONFLICT(id) DO UPDATE SET company=$1, resume=$2',
        [p.company, p.resume],
      );
    } catch (e) {
      logger.error(`[profile] persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  notify();
  return cache;
}

// ===== 测试钩子(仅测试用) =====
export function _resetProfileForTest(): void {
  cache = null;
  db = null;
  listeners.clear();
}

export function _setProfileDbForTest(mockDb: Database): void {
  db = mockDb;
}
