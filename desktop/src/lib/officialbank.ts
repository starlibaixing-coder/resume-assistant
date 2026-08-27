// 官方题库本地物化 + 远端同步(「同步官方题库」功能)。
//
// YAML(仓库)是唯一真相源;远端 questions.json(GitHub Pages)是它的部署形态;
// 本地 SQLite official_questions/official_categories 是远端的投影,可随时被同步覆盖。
// 官方题只读(ADR-3),用户改动走「复制到我的库」,因此官方行无合并冲突,直接覆盖。
// 远端消失的题:本地连带清 review_state/notes(id 作废不复用,ADR-9)。
// web 预览(非 Tauri)不走 DB:直接 fetch 包内 questions.json,不参与同步。

import type Database from '@tauri-apps/plugin-sql';
import type { Question, QuestionData } from '@/types/question';
import { isTauri } from './secrets';
import { logger } from './logger';

export const OFFICIAL_REMOTE_URL = 'https://starlibaixing-coder.github.io/resume-assistant/questions.json';

export interface SyncStats {
  added: number;
  updated: number;
  removed: number;
}

// ===== SQLite 行映射 =====

export interface OfficialQuestionRow {
  id: string;
  category: string;
  module: number;
  module_name: string;
  index_real: number;
  difficulty: string;
  title: string;
  focus: string;
  answer: string; // JSON array
  followups: string; // JSON array
  tags: string; // JSON array
  synced_at: number;
}

export interface OfficialCategoryRow {
  slug: string;
  name: string;
  description: string;
  synced_at: number;
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function rowToQuestion(r: OfficialQuestionRow): Question {
  return {
    id: r.id,
    category: r.category,
    module: r.module,
    moduleName: r.module_name,
    index: r.index_real,
    type: 'qa',
    difficulty: (['初', '中', '高'].includes(r.difficulty) ? r.difficulty : '中') as Question['difficulty'],
    tags: safeJsonArray(r.tags),
    title: r.title,
    focus: r.focus,
    answer: safeJsonArray(r.answer),
    followups: safeJsonArray(r.followups),
  };
}

function questionToParams(q: Question, now: number): unknown[] {
  return [
    q.id, q.category, q.module, q.moduleName, q.index, q.difficulty, q.title, q.focus,
    JSON.stringify(q.answer), JSON.stringify(q.followups), JSON.stringify(q.tags), now,
  ];
}

const UPSERT_QUESTION_SQL =
  'INSERT INTO official_questions(id,category,module,module_name,index_real,difficulty,title,focus,answer,followups,tags,synced_at) ' +
  'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET ' +
  'category=$2,module=$3,module_name=$4,index_real=$5,difficulty=$6,title=$7,focus=$8,answer=$9,followups=$10,tags=$11,synced_at=$12';

const UPSERT_CATEGORY_SQL =
  'INSERT INTO official_categories(slug,name,description,synced_at) VALUES($1,$2,$3,$4) ' +
  'ON CONFLICT(slug) DO UPDATE SET name=$2,description=$3,synced_at=$4';

// ===== 远端结构校验(坏数据绝不落库) =====

export function validateRemoteBank(data: unknown): QuestionData {
  const d = data as Partial<QuestionData> | null;
  if (!d || !Array.isArray(d.categories) || !d.categories.length) throw new Error('远端数据缺 categories');
  if (!Array.isArray(d.questions) || !d.questions.length) throw new Error('远端数据缺 questions');
  const ids = new Set<string>();
  for (const c of d.categories) {
    if (!c?.slug || !c.name) throw new Error('远端分类缺 slug/name');
  }
  for (const q of d.questions) {
    if (!q?.id || !q.title || !q.category) throw new Error('远端题目缺 id/title/category');
    if (!['初', '中', '高'].includes(q.difficulty)) throw new Error(`远端题目 ${q.id} 难度非法`);
    if (ids.has(q.id)) throw new Error(`远端题目 id 重复: ${q.id}`);
    ids.add(q.id);
  }
  const catSlugs = new Set(d.categories.map((c) => c.slug));
  for (const q of d.questions) {
    if (!catSlugs.has(q.category)) throw new Error(`远端题目 ${q.id} 引用未知分类 ${q.category}`);
  }
  return { categories: d.categories, questions: d.questions, total: d.questions.length };
}

// ===== diff(纯函数,单测) =====

export function diffOfficial(
  local: Question[],
  remote: Question[],
): { added: Question[]; updated: Question[]; removedIds: string[] } {
  const localMap = new Map(local.map((q) => [q.id, q]));
  const remoteMap = new Map(remote.map((q) => [q.id, q]));
  return {
    added: remote.filter((q) => !localMap.has(q.id)),
    updated: remote.filter((q) => {
      const l = localMap.get(q.id);
      return !!l && JSON.stringify(l) !== JSON.stringify(q);
    }),
    removedIds: local.filter((q) => !remoteMap.has(q.id)).map((q) => q.id),
  };
}

// ===== 内存缓存 + pub-sub =====

let cache: QuestionData | null = null;
let db: Database | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeOfficial(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

export function getOfficial(): QuestionData | null {
  return cache;
}

// 最近一次落库时间(设置页显示);web 预览无 DB 返回 null
export async function getLastSyncedAt(): Promise<number | null> {
  if (!db) return null;
  const rows = await db.select<Array<{ t: number | null }>>('SELECT MAX(synced_at) AS t FROM official_questions');
  return rows[0]?.t ?? null;
}

export function initOfficialDb(database: Database): void {
  db = database;
}

// 启动加载:Tauri 走 DB(空则用包内 questions.json 播种);web 直接 fetch 包内
export async function loadOfficial(): Promise<void> {
  if (cache) return;
  if (isTauri() && db) {
    const [cats, rows] = await Promise.all([
      db.select<OfficialCategoryRow[]>('SELECT * FROM official_categories'),
      db.select<OfficialQuestionRow[]>('SELECT * FROM official_questions'),
    ]);
    if (rows.length) {
      cache = {
        categories: cats.map((c) => ({ slug: c.slug, name: c.name, description: c.description, modules: [], count: 0 })),
        questions: rows.map(rowToQuestion),
        total: rows.length,
      };
      cache.categories = deriveModules(cache.categories, cache.questions);
      notify();
      return;
    }
    // 首次启动:播种(包内快照),随后重读
    const bank = validateRemoteBank(await fetchBundled());
    const stats = await applyBank(bank);
    logger.info(`[official] 首次播种: ${stats.added} 题(${stats.removed} 移除)`);
    return loadOfficial();
  }
  cache = validateRemoteBank(await fetchBundled());
  notify();
}

// ensure:加载一次(幂等),questions.ts 等上层用
export function ensureOfficial(): Promise<void> {
  loading ??= loadOfficial().catch((e) => {
    loading = null; // 失败允许重试
    throw e;
  });
  return loading;
}

function fetchBundled(): Promise<QuestionData> {
  return fetch(import.meta.env.BASE_URL + 'questions.json').then((r) => {
    if (!r.ok) throw new Error(`包内 questions.json HTTP ${r.status}`);
    return r.json() as Promise<QuestionData>;
  });
}

// 从题目行推导分类的 modules/count(official_categories 只存元信息)
function deriveModules(categories: QuestionData['categories'], questions: Question[]): QuestionData['categories'] {
  return categories.map((c) => {
    const qs = questions.filter((q) => q.category === c.slug);
    const byModule = new Map<number, { id: number; name: string; count: number }>();
    for (const q of qs) {
      let m = byModule.get(q.module);
      if (!m) byModule.set(q.module, (m = { id: q.module, name: q.moduleName, count: 0 }));
      m.count++;
    }
    return { ...c, modules: [...byModule.values()].sort((a, b) => a.id - b.id), count: qs.length };
  });
}

// 落库 + 刷缓存(diff 后仅写差异;远端结构整体采用)
async function applyBank(bank: QuestionData): Promise<SyncStats> {
  const now = Date.now();
  const local = cache?.questions ?? [];
  const { added, updated, removedIds } = diffOfficial(local, bank.questions);
  if (db) {
    for (const q of [...added, ...updated]) await db.execute(UPSERT_QUESTION_SQL, questionToParams(q, now));
    for (const id of removedIds) {
      await db.execute('DELETE FROM official_questions WHERE id=$1', [id]);
      // 远端下架:进度/笔记/代码草稿连带清(id 作废不复用,ADR-9)
      await db.execute('DELETE FROM review_state WHERE id=$1', [id]);
      await db.execute('DELETE FROM notes WHERE id=$1', [id]);
      await db.execute('DELETE FROM code_drafts WHERE id=$1', [id]);
    }
    for (const c of bank.categories) {
      await db.execute(UPSERT_CATEGORY_SQL, [c.slug, c.name, c.description ?? '', now]);
    }
  }
  cache = {
    categories: deriveModules(
      bank.categories.map((c) => ({ slug: c.slug, name: c.name, description: c.description ?? '', modules: [], count: 0 })),
      bank.questions,
    ),
    questions: bank.questions,
    total: bank.questions.length,
  };
  notify();
  return { added: added.length, updated: updated.length, removed: removedIds.length };
}

// 同步:拉远端 → 校验 → 差异落库。失败抛出,本地数据不动。
export async function syncOfficialBank(
  url: string = OFFICIAL_REMOTE_URL,
  fetchFn: typeof fetch = fetch,
): Promise<SyncStats> {
  await ensureOfficial();
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`远端返回 HTTP ${res.status}`);
  const bank = validateRemoteBank(await res.json());
  const stats = await applyBank(bank);
  logger.info(
    `[official] 同步完成: 新增 ${stats.added} · 修订 ${stats.updated} · 移除 ${stats.removed}(共 ${bank.questions.length} 题)`,
  );
  return stats;
}

// ===== 测试钩子(仅测试用) =====
export function _resetOfficialForTest(): void {
  cache = null;
  db = null;
  loading = null;
  listeners.clear();
}

export function _setOfficialDbForTest(mockDb: Database): void {
  db = mockDb;
}
