// 存储层 —— 内存缓存 + SQLite 持久化(B 方案:签名保持同步,上层零改)
//
// 为什么不改全异步: 现有 schedule.ts 与 4 个组件(card-view/review-queue/note-panel/module-nav)
// 全部同步调用 storage;改 async 会传染整个前端。此方案保持同步签名:
//   - 启动 initStorage() 从 SQLite 灌内存(一次性)
//   - save 同步写内存 + fire-and-forget 写 SQLite(立即发,不防抖,丢数据窗口=一次 event loop)
//   - 对自用工具可接受;长期可演进为全异步。
//
// 表结构见 src-tauri/migrations/001_init.sql。
// 官方题库走 questions.json 只读;此处 review_state/notes 跨官方+我的库(按 id)。

import type { CardState } from './sm2';
import type { Database } from '@tauri-apps/plugin-sql';
import { initMyLibDb, loadMyQuestionsFromDb } from './mylib';
import { initProfileDb, loadProfileFromDb } from './profile';
import { initSecretsDb, loadSecretsFromDb } from './secrets';

// ===== SQLite 行 ↔ CardState 映射(纯函数,独立单测) =====
export interface ReviewRow {
  id: string;
  category: string;
  interval: number;
  ease: number;
  reps: number;
  due: number;
  last_review: number | null;
}

export function rowToCard(r: ReviewRow): CardState {
  return { due: r.due, interval: r.interval, ease: r.ease, reps: r.reps, lastReview: r.last_review };
}

// ===== 内存缓存(模块级单例) =====
const progressCache = new Map<string, Record<string, CardState>>();
const notesCache = new Map<string, Record<string, string>>();
// db 懒加载(initStorage 时赋值);未 init 时为 null,persist 静默跳过(测试/降级)
let db: Database | null = null;
let initPromise: Promise<void> | null = null;

function progressOf(category: string): Record<string, CardState> {
  let m = progressCache.get(category);
  if (!m) {
    m = {};
    progressCache.set(category, m);
  }
  return m;
}

function notesOf(category: string): Record<string, string> {
  let m = notesCache.get(category);
  if (!m) {
    m = {};
    notesCache.set(category, m);
  }
  return m;
}

// 启动加载:从 SQLite 灌内存。App 启动时 await 一次。动态 import 避免顶层依赖 Tauri runtime。
export async function initStorage(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    db = await Database.load('sqlite:resume.db');

    const rows = await db.select<ReviewRow[]>(
      'SELECT id, category, interval, ease, reps, due, last_review FROM review_state'
    );
    for (const r of rows) {
      progressOf(r.category)[r.id] = rowToCard(r);
    }

    const notes = await db.select<{ id: string; category: string; content: string }[]>(
      'SELECT id, category, content FROM notes'
    );
    for (const n of notes) {
      notesOf(n.category)[n.id] = n.content;
    }

    // 我的库(questions 表)、求职档案(profile 表)、密钥(secrets 表)同批灌入(阶段 1/2)
    initMyLibDb(db);
    await loadMyQuestionsFromDb();
    initProfileDb(db);
    await loadProfileFromDb();
    initSecretsDb(db);
    await loadSecretsFromDb();
  })();
  return initPromise;
}

// ===== 同步 API(签名与原 localStorage 版完全一致,上层零改) =====
export function loadProgress(category: string): Record<string, CardState> {
  return { ...progressOf(category) };
}

export function saveCard(category: string, id: string, card: CardState): void {
  progressOf(category)[id] = card;
  void persistCard(category, id, card);
}

export function getCard(category: string, id: string): CardState | null {
  return progressOf(category)[id] || null;
}

export function clearProgress(category: string): void {
  progressCache.delete(category);
  void persistDeleteCategory('review_state', category);
}

export function loadNotes(category: string): Record<string, string> {
  return { ...notesOf(category) };
}

export function saveNote(category: string, id: string, html: string): void {
  if (html && html.trim()) {
    notesOf(category)[id] = html;
  } else {
    delete notesOf(category)[id];
  }
  void persistNote(category, id, html);
}

export function getNote(category: string, id: string): string {
  return notesOf(category)[id] || '';
}

export function clearNotes(category: string): void {
  notesCache.delete(category);
  void persistDeleteCategory('notes', category);
}

// ===== 持久化(fire-and-forget;db 未就绪则跳过,失败仅 log 不阻塞 UI) =====
async function persistCard(category: string, id: string, c: CardState): Promise<void> {
  if (!db) return;
  try {
    await db.execute(
      'INSERT INTO review_state(id,category,interval,ease,reps,due,last_review) VALUES($1,$2,$3,$4,$5,$6,$7) ' +
        'ON CONFLICT(id) DO UPDATE SET interval=$3,ease=$4,reps=$5,due=$6,last_review=$7',
      [id, category, c.interval, c.ease, c.reps, c.due, c.lastReview]
    );
  } catch (e) {
    console.error('[storage] persistCard failed', e);
  }
}

async function persistNote(category: string, id: string, html: string): Promise<void> {
  if (!db) return;
  try {
    if (html && html.trim()) {
      await db.execute(
        'INSERT INTO notes(id,category,content,updated_at) VALUES($1,$2,$3,$4) ' +
          'ON CONFLICT(id) DO UPDATE SET content=$3,updated_at=$4',
        [id, category, html, Date.now()]
      );
    } else {
      await db.execute('DELETE FROM notes WHERE id=$1', [id]);
    }
  } catch (e) {
    console.error('[storage] persistNote failed', e);
  }
}

async function persistDeleteCategory(table: 'review_state' | 'notes', category: string): Promise<void> {
  if (!db) return;
  try {
    await db.execute(`DELETE FROM ${table} WHERE category=$1`, [category]);
  } catch (e) {
    console.error(`[storage] persistDelete ${table} failed`, e);
  }
}

// ===== 测试钩子(仅测试用) =====
export function _resetStorageForTest(): void {
  progressCache.clear();
  notesCache.clear();
  db = null;
  initPromise = null;
}

export function _setDbForTest(mockDb: Database): void {
  db = mockDb;
}
