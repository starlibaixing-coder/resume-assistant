// JD 库(求职中枢一期,审计批次 3)—— jds 表的内存缓存 + await 持久化 + pub-sub。
// 与 profile/mylib 同哲学:读走同步缓存,写 await 后 notify。
// 存量平移在迁移 006 里完成(profile.jd → 首条 JD);profile 只剩公司/简历。

import type Database from '@tauri-apps/plugin-sql';
import { logger } from './logger';

export interface Jd {
  id: number;
  title: string;
  company: string;
  content: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface JdInput {
  title: string;
  company: string;
  content: string;
}

// 缓存按 lastActiveAt 降序(最近用过在前);db 懒注入(initStorage),非 Tauri 环境降级纯内存
let cache: Jd[] = [];
let db: Database | null = null;
const listeners = new Set<() => void>();

export function subscribeJds(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function initJdsDb(database: Database): void {
  db = database;
}

interface JdRow {
  id: number;
  title: string;
  company: string;
  content: string;
  created_at: number;
  last_active_at: number;
}

export async function loadJdsFromDb(): Promise<void> {
  if (!db) return;
  const rows = await db.select<JdRow[]>(
    'SELECT id, title, company, content, created_at, last_active_at FROM jds ORDER BY last_active_at DESC, id DESC',
  );
  cache = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company ?? '',
    content: r.content,
    createdAt: r.created_at,
    lastActiveAt: r.last_active_at,
  }));
}

export function getJds(): Jd[] {
  return cache;
}

export function getJd(id: number): Jd | null {
  return cache.find((j) => j.id === id) ?? null;
}

function normalize(input: JdInput): JdInput {
  const company = input.company.trim();
  const content = input.content.trim();
  const title = input.title.trim() || company || content.slice(0, 12) || '未命名 JD';
  return { title: title.slice(0, 60), company, content };
}

export async function addJd(input: JdInput): Promise<Jd> {
  const n = normalize(input);
  const now = Date.now();
  const created: Jd = { id: nextId(), ...n, createdAt: now, lastActiveAt: now };
  cache = [created, ...cache];
  if (db) {
    try {
      const r = await db.execute(
        'INSERT INTO jds(title, company, content, created_at, last_active_at) VALUES($1,$2,$3,$4,$5)',
        [created.title, created.company, created.content, created.createdAt, created.lastActiveAt],
      );
      if (r.lastInsertId && typeof r.lastInsertId === 'number') {
        created.id = r.lastInsertId; // 真库以自增 id 为准
      }
    } catch (e) {
      logger.error(`[jd] persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  notify();
  return created;
}

export async function updateJd(id: number, input: JdInput): Promise<Jd> {
  const n = normalize(input);
  const existing = getJd(id);
  if (!existing) throw new Error(`JD 不存在: ${id}`);
  const updated: Jd = { ...existing, ...n, lastActiveAt: Date.now() };
  cache = [updated, ...cache.filter((j) => j.id !== id)]; // 更新后置顶
  if (db) {
    try {
      await db.execute(
        'UPDATE jds SET title=$1, company=$2, content=$3, last_active_at=$4 WHERE id=$5',
        [updated.title, updated.company, updated.content, updated.lastActiveAt, id],
      );
    } catch (e) {
      logger.error(`[jd] persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  notify();
  return updated;
}

export async function deleteJd(id: number): Promise<void> {
  cache = cache.filter((j) => j.id !== id);
  if (db) {
    try {
      await db.execute('DELETE FROM jds WHERE id=$1', [id]);
    } catch (e) {
      logger.error(`[jd] persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  notify();
}

// 从 JD 发起定向生题时调用:置顶 + 刷新 lastActiveAt(不改内容)
export async function touchJd(id: number): Promise<void> {
  const existing = getJd(id);
  if (!existing) return;
  const now = Date.now();
  const touched = { ...existing, lastActiveAt: now };
  cache = [touched, ...cache.filter((j) => j.id !== id)];
  if (db) {
    try {
      await db.execute('UPDATE jds SET last_active_at=$1 WHERE id=$2', [now, id]);
    } catch (e) {
      logger.error(`[jd] persist failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  notify();
}

// 纯内存环境的临时 id(真库用自增 id 覆盖)
function nextId(): number {
  return cache.reduce((m, j) => Math.max(m, j.id), 0) + 1;
}

// ===== 测试钩子(仅测试用) =====
export function _resetJdsForTest(): void {
  cache = [];
  db = null;
  listeners.clear();
}

export function _setJdsDbForTest(mockDb: Database): void {
  db = mockDb;
}
