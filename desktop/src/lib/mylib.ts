// 我的库 —— SQLite questions 表的内存缓存 + CRUD(阶段 1,ADR-3/9/10)
//
// 与 storage.ts(B 方案)同哲学,差异:题目 CRUD 是用户显式操作(低频、语义重),
// 写库 await 后才 resolve;读走同步缓存。mutate 后 pub-sub notify,useQuestions 重算聚合。
//
// id 三段式 `my.<module>.<idx>`(如 my.1.3):slug `my` 避开官方 slug(ADR-9),
// 官方题的"复制副本"统一进模块 0(官方题副本),生题批次从模块 1 起顺延。
// 删除时级联清理 review_state/notes 孤儿行(无外键,手动删)。

import type { Category, CategoryModule, Difficulty, MyQuestion, Question } from '@/types/question';
import type { Database } from '@tauri-apps/plugin-sql';
import { validateQuestion } from './validate';

export const MY_CATEGORY_SLUG = 'my';
export const MY_CATEGORY_NAME = '我的题库';
export const COPY_MODULE_ID = 0;
export const COPY_MODULE_NAME = '官方题副本';

// 生成/复制时的入参(无 id/index/module,由 addDrafts/addCopy 分配)
export interface DraftQuestion {
  difficulty: Difficulty;
  title: string;
  focus: string;
  answer: string[];
  followups: string[];
  tags: string[];
}

// ===== SQLite 行 ↔ MyQuestion 映射(纯函数,独立单测) =====
export interface MyQuestionRow {
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
  status: 'pending' | 'approved';
  source_id: string | null;
  created_at: number;
  updated_at: number;
}

export function rowToMyQuestion(r: MyQuestionRow): MyQuestion {
  return {
    id: r.id,
    category: r.category,
    module: r.module,
    moduleName: r.module_name,
    index: r.index_real,
    type: 'qa',
    difficulty: (VALID_DIFFICULTY_SET.has(r.difficulty) ? r.difficulty : '中') as Difficulty,
    tags: safeJsonArray(r.tags),
    title: r.title,
    focus: r.focus,
    answer: safeJsonArray(r.answer),
    followups: safeJsonArray(r.followups),
    status: r.status,
    sourceId: r.source_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const VALID_DIFFICULTY_SET = new Set(['初', '中', '高']);

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ===== id 分配(纯函数) =====

// 生题批次的下一个模块号:现有最大模块号 + 1(模块 0 留给官方副本)
export function nextModuleId(existing: MyQuestion[]): number {
  return existing.reduce((m, q) => Math.max(m, q.module), 0) + 1;
}

// 在 moduleId 内分配 count 个不冲突的 id(my.<module>.<idx>)
export function allocateIds(existingIds: Iterable<string>, moduleId: number, count: number): string[] {
  const used = new Set(existingIds);
  const re = new RegExp(`^${MY_CATEGORY_SLUG}\\.(\\d+)\\.(\\d+)$`);
  let maxIdx = 0;
  for (const id of used) {
    const m = id.match(re);
    if (m && parseInt(m[1], 10) === moduleId) maxIdx = Math.max(maxIdx, parseInt(m[2], 10));
  }
  const ids: string[] = [];
  let idx = maxIdx;
  while (ids.length < count) {
    idx++;
    const id = `${MY_CATEGORY_SLUG}.${moduleId}.${idx}`;
    if (!used.has(id)) {
      ids.push(id);
      used.add(id);
    }
  }
  return ids;
}

// ===== 内存缓存 + pub-sub =====
const cache = new Map<string, MyQuestion>();
let db: Database | null = null;
const listeners = new Set<() => void>();

export function subscribeMyLib(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) fn();
}

// storage.initStorage 注入 db 句柄并灌缓存(避免循环依赖)
export function initMyLibDb(database: Database): void {
  db = database;
}

export async function loadMyQuestionsFromDb(): Promise<void> {
  if (!db) return;
  const rows = await db.select<MyQuestionRow[]>('SELECT * FROM questions');
  for (const r of rows) cache.set(r.id, rowToMyQuestion(r));
}

// ===== 同步读 =====

// 全部我的题,按模块号、题号排序
export function getMyQuestions(): MyQuestion[] {
  return [...cache.values()].sort((a, b) => a.module - b.module || a.index - b.index);
}

export function getMyQuestion(id: string): MyQuestion | null {
  return cache.get(id) || null;
}

export function getPendingCount(): number {
  let n = 0;
  for (const q of cache.values()) if (q.status === 'pending') n++;
  return n;
}

// 已复制进我的库的官方题 id 集合(浏览页"已在我的库"标识)
export function getCopiedSourceIds(): Set<string> {
  const ids = new Set<string>();
  for (const q of cache.values()) if (q.sourceId) ids.add(q.sourceId);
  return ids;
}

// 合成「我的题库」分类(只统计 approved;pending 在草稿区页管理,不进浏览)
export function getMyCategory(): Category {
  const approved = getMyQuestions().filter((q) => q.status === 'approved');
  const byModule = new Map<number, CategoryModule>();
  for (const q of approved) {
    let m = byModule.get(q.module);
    if (!m) {
      m = { id: q.module, name: q.moduleName, count: 0 };
      byModule.set(q.module, m);
    }
    m.count++;
  }
  const modules = [...byModule.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, m]) => m);
  return {
    slug: MY_CATEGORY_SLUG,
    name: MY_CATEGORY_NAME,
    description: 'AI 生成 + 官方副本',
    modules,
    count: approved.length,
  };
}

// ===== 校验(DraftQuestion → 共享 validateQuestion) =====
function validateDraft(q: DraftQuestion, loc: string): void {
  const errors = validateQuestion(
    { id: 'draft', difficulty: q.difficulty, title: q.title, focus: q.focus, answer: q.answer, followups: q.followups },
    loc,
  );
  if (errors.length) throw new Error(errors.join('\n'));
}

// ===== 异步写(mutate 缓存 → await 持久化 → notify) =====

// 一批草稿进草稿区(新模块,模块名 = 知识点)。ADR-10:status=pending。
export async function addDrafts(drafts: DraftQuestion[], moduleName: string): Promise<MyQuestion[]> {
  const existing = getMyQuestions();
  const moduleId = nextModuleId(existing);
  const ids = allocateIds(
    existing.map((q) => q.id),
    moduleId,
    drafts.length,
  );
  const now = Date.now();
  const created: MyQuestion[] = drafts.map((d, i) => {
    validateDraft(d, `草稿 ${i + 1}`);
    return {
      ...d,
      id: ids[i],
      category: MY_CATEGORY_SLUG,
      module: moduleId,
      moduleName: moduleName.slice(0, 30) || `批次 ${moduleId}`,
      index: i + 1,
      type: 'qa' as const,
      status: 'pending' as const,
      createdAt: now,
      updatedAt: now,
    };
  });
  for (const q of created) {
    cache.set(q.id, q);
    await persistInsert(q);
  }
  notify();
  return created;
}

// 官方题复制成我的库副本(ADR-3:官方题改 = 复制后改)。副本直接 approved(来源已过质检)。
export async function copyOfficial(q: Question): Promise<MyQuestion> {
  const existing = getMyQuestions();
  const moduleId = COPY_MODULE_ID;
  const [id] = allocateIds(
    existing.map((q2) => q2.id),
    moduleId,
    1,
  );
  const now = Date.now();
  const copy: MyQuestion = {
    ...q,
    id,
    category: MY_CATEGORY_SLUG,
    module: moduleId,
    moduleName: COPY_MODULE_NAME,
    index: parseInt(id.split('.')[2] || '1', 10),
    status: 'approved',
    sourceId: q.id,
    createdAt: now,
    updatedAt: now,
  };
  cache.set(copy.id, copy);
  await persistInsert(copy);
  notify();
  return copy;
}

// approve:草稿 → 正式(进聚合刷题/SM-2 队列)
export async function approveQuestion(id: string): Promise<void> {
  const q = cache.get(id);
  if (!q) throw new Error(`题不存在: ${id}`);
  if (q.status !== 'pending') return;
  q.status = 'approved';
  q.updatedAt = Date.now();
  await execute('UPDATE questions SET status=$1, updated_at=$2 WHERE id=$3', [q.status, q.updatedAt, id]);
  notify();
}

// 拒绝草稿:删除(pending 才可拒)
export async function rejectDraft(id: string): Promise<void> {
  const q = cache.get(id);
  if (!q || q.status !== 'pending') return;
  cache.delete(id);
  await execute('DELETE FROM questions WHERE id=$1', [id]);
  notify();
}

// 编辑我的题(改后再校验,硬规则不过拒绝保存)
export async function updateQuestion(
  id: string,
  patch: Partial<Pick<DraftQuestion, 'difficulty' | 'title' | 'focus' | 'answer' | 'followups' | 'tags'>>,
): Promise<MyQuestion> {
  const q = cache.get(id);
  if (!q) throw new Error(`题不存在: ${id}`);
  const merged: DraftQuestion = {
    difficulty: patch.difficulty ?? q.difficulty,
    title: patch.title ?? q.title,
    focus: patch.focus ?? q.focus,
    answer: patch.answer ?? q.answer,
    followups: patch.followups ?? q.followups,
    tags: patch.tags ?? q.tags,
  };
  validateDraft(merged, `my 题 ${id}`);
  Object.assign(q, patch, { updatedAt: Date.now() });
  await execute(
    'UPDATE questions SET difficulty=$1, title=$2, focus=$3, answer=$4, followups=$5, tags=$6, updated_at=$7 WHERE id=$8',
    [q.difficulty, q.title, q.focus, JSON.stringify(q.answer), JSON.stringify(q.followups), JSON.stringify(q.tags), q.updatedAt, id],
  );
  notify();
  return q;
}

// 删除我的题(任意状态)+ 级联清进度/笔记孤儿
export async function deleteQuestion(id: string): Promise<void> {
  const q = cache.get(id);
  if (!q) return;
  cache.delete(id);
  await execute('DELETE FROM questions WHERE id=$1', [id]);
  await execute('DELETE FROM review_state WHERE id=$1', [id]);
  await execute('DELETE FROM notes WHERE id=$1', [id]);
  notify();
}

// ===== 持久化(db 未就绪跳过;失败 log 不回滚 —— 与 storage.ts 同策略) =====

async function persistInsert(q: MyQuestion): Promise<void> {
  await execute(
    'INSERT INTO questions(id,category,module,module_name,index_real,difficulty,title,focus,answer,followups,tags,status,source_id,created_at,updated_at) ' +
      'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
    [
      q.id, q.category, q.module, q.moduleName, q.index, q.difficulty, q.title, q.focus,
      JSON.stringify(q.answer), JSON.stringify(q.followups), JSON.stringify(q.tags),
      q.status, q.sourceId ?? null, q.createdAt, q.updatedAt,
    ],
  );
}

async function execute(sql: string, params: unknown[]): Promise<void> {
  if (!db) return;
  try {
    await db.execute(sql, params);
  } catch (e) {
    console.error('[mylib] persist failed', sql, e);
  }
}

// ===== 测试钩子(仅测试用) =====
export function _resetMyLibForTest(): void {
  cache.clear();
  db = null;
  listeners.clear();
}

export function _setMyLibDbForTest(mockDb: Database): void {
  db = mockDb;
}
