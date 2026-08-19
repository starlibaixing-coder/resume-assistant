// 求职目标档案(ADR-4 中枢)—— profile 表单行(id=1)的内存缓存 + await 持久化 + pub-sub。
// 与 mylib 同哲学:读走同步缓存,写 await 后 notify;简历/JD/公司被 JD 定向生题(阶段 2)
// 与简历/模拟面试(阶段 3/5)共享。preferences 字段本阶段不用(留给阶段 3)。

import type { Database } from '@tauri-apps/plugin-sql';

export interface JobProfile {
  company: string;
  jd: string;
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
  const rows = await db.select<Array<{ company: string; jd: string; resume: string }>>(
    'SELECT company, jd, resume FROM profile WHERE id=1',
  );
  const r = rows[0];
  cache = r ? { company: r.company ?? '', jd: r.jd ?? '', resume: r.resume ?? '' } : null;
}

// null = 从未录入;三个字段可能部分为空(校验放在消费侧,如 JD 定向要求 jd 非空)
export function getProfile(): JobProfile | null {
  return cache;
}

export async function saveProfile(p: JobProfile): Promise<JobProfile> {
  cache = { company: p.company, jd: p.jd, resume: p.resume };
  if (db) {
    try {
      await db.execute(
        'INSERT INTO profile(id, company, jd, resume) VALUES(1,$1,$2,$3) ' +
          'ON CONFLICT(id) DO UPDATE SET company=$1, jd=$2, resume=$3',
        [p.company, p.jd, p.resume],
      );
    } catch (e) {
      console.error('[profile] persist failed', e);
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
