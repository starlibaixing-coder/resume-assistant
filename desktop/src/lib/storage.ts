// 存储网关 —— 内存缓存为唯一读源;写 = 改缓存 → fire-and-forget SQL → notify(key)。
// UI 只读缓存快照,一切写经此层(单向数据流,tech-design §2)。
//
// 后端冻结说明:review_state.last_rating / questions.is_code·source_ref·jd_id /
// meta / rating_log 由本层启动时幂等补齐(DDL 见 ensureSchema),
// Rust 迁移注册表未动——正式化建议见 docs/product/backend-todo.md。
// 浏览器降级(isTauri()===false):db=null,缓存即全部真相,官方库走包内 questions.json。

import type Database from '@tauri-apps/plugin-sql';

import { openDb } from './db';
import { logger } from './logger';
import { nextDayStart } from './utils';
import type { ActivityDay, CardState, Difficulty, Jd, Profile, Question, QStatus, Rating } from './types';

// ===== 行类型(SQLite 实际列) =====

interface OfficialRow {
  id: string;
  category: string;
  module: number;
  module_name: string;
  index_real: number;
  difficulty: Difficulty;
  title: string;
  focus: string;
  answer: string;
  followups: string;
  tags: string;
  synced_at: number;
}

export interface MyRow {
  id: string;
  category: string;
  module: number;
  module_name: string;
  index_real: number;
  difficulty: Difficulty;
  title: string;
  focus: string;
  answer: string;
  followups: string;
  tags: string;
  status: QStatus;
  source: 'manual' | 'ai' | 'jd' | 'copy';
  source_id: string | null;
  source_ref: string | null;
  jd_id: number | null;
  is_code: number | null;
  created_at: number;
  updated_at: number;
}

export interface ReviewRow {
  id: string;
  category: string;
  interval: number;
  ease: number;
  reps: number;
  due: number;
  last_review: number | null;
  last_rating: Rating | null;
}

export interface RatingLogRow {
  question_id: string;
  day: string;
  rating: Rating;
  rated_at: number;
}

export interface CategoryMeta {
  slug: string;
  name: string;
  description: string;
}

export function cardToRow(card: CardState, category: string): ReviewRow {
  return {
    id: '',
    category,
    interval: card.intervalDays,
    ease: card.ef,
    reps: card.reps,
    due: card.dueAt,
    last_review: card.lastRatedAt,
    last_rating: card.lastRating,
  };
}

export function rowToCard(r: Omit<ReviewRow, 'id' | 'category'>): CardState {
  return {
    ef: r.ease,
    intervalDays: r.interval,
    reps: r.reps,
    lastRating: r.last_rating,
    lastRatedAt: r.last_review,
    dueAt: r.due,
  };
}

function safeJsonArray(s: string | null): string[] {
  try {
    const v = JSON.parse(s ?? '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ===== 缓存(模块级单例) =====

const officialCache: Question[] = [];
const categoryCache: CategoryMeta[] = [];
const myCache: Question[] = [];
const reviewCache = new Map<string, CardState>();
const noteCache = new Map<string, string>();
const draftCache = new Map<string, string>();
const jdCache: Jd[] = [];
const metaCache = new Map<string, string>();
const secretCache = new Map<string, string>();
const ratingLogCache = new Map<string, RatingLogRow>();
let profileCache: Profile = { resume: '', preferences: '{}' };

let db: Database | null = null;
let initPromise: Promise<void> | null = null;
let persistErrorHook: ((msg: string) => void) | null = null;

// ===== pub-sub =====

export type StorageKey = 'official' | 'my' | 'review' | 'notes' | 'drafts' | 'jds' | 'profile' | 'secrets' | 'meta' | 'activity';
const listeners = new Map<StorageKey | '*', Set<() => void>>();

export function subscribe(key: StorageKey | '*', fn: () => void): () => void {
  if (!listeners.has(key)) listeners.set(key as StorageKey, new Set());
  listeners.get(key as StorageKey)!.add(fn);
  return () => listeners.get(key as StorageKey)?.delete(fn);
}

let version = 0;

function notify(...keys: StorageKey[]): void {
  version += 1;
  for (const k of keys) listeners.get(k)?.forEach((fn) => fn());
  listeners.get('*' as StorageKey)?.forEach((fn) => fn());
}

/** 全局版本号(hooks 以此为稳定快照键) */
export function getVersion(): number {
  return version;
}

// ===== 持久化(fire-and-forget;失败 log + hook,不阻塞 UI) =====

function persist(run: (db: Database) => Promise<unknown>, what: string): void {
  if (!db) return;
  void run(db).catch((e) => {
    const msg = `[storage] ${what} 持久化失败: ${e instanceof Error ? e.message : String(e)}`;
    logger.error(msg);
    persistErrorHook?.(msg);
  });
}

export function setOnPersistError(fn: (msg: string) => void): void {
  persistErrorHook = fn;
}

// ===== 幂等补列(后端冻结;正式化进 Rust 迁移的建议见 docs/product/backend-todo.md) =====

export async function ensureSchema(database: Database): Promise<void> {
  const ddl: [string, RegExp][] = [
    ['ALTER TABLE review_state ADD COLUMN last_rating TEXT', /duplicate column/i],
    ['ALTER TABLE questions ADD COLUMN source_ref TEXT NOT NULL DEFAULT \'\'', /duplicate column/i],
    ['ALTER TABLE questions ADD COLUMN jd_id INTEGER', /duplicate column/i],
    ['ALTER TABLE questions ADD COLUMN is_code INTEGER NOT NULL DEFAULT 0', /duplicate column/i],
    ['CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)', /^$/],
    [
      'CREATE TABLE IF NOT EXISTS rating_log (' +
        'question_id TEXT NOT NULL, day TEXT NOT NULL, rating TEXT NOT NULL, rated_at INTEGER NOT NULL, ' +
        'PRIMARY KEY(question_id, day))',
      /^$/,
    ],
  ];
  for (const [sql, ignorable] of ddl) {
    try {
      await database.execute(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!ignorable.test(msg)) {
        logger.error(`[storage] ensureSchema 失败: ${msg}`);
        throw e;
      }
    }
  }
}

// ===== 官方库 / 我的库 行映射 =====

export function officialRowToQuestion(r: OfficialRow, slug: string): Question {
  return {
    id: r.id,
    origin: 'official',
    category: slug,
    module: r.module,
    moduleName: r.module_name,
    index: r.index_real,
    difficulty: r.difficulty,
    title: r.title,
    focus: r.focus,
    answer: safeJsonArray(r.answer),
    followups: safeJsonArray(r.followups),
    tags: safeJsonArray(r.tags),
    status: 'approved',
    source: 'official',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: r.synced_at,
    updatedAt: r.synced_at,
  };
}

export function myRowToQuestion(r: MyRow): Question {
  return {
    id: r.id,
    origin: 'my',
    category: 'my',
    module: r.module,
    moduleName: r.module_name,
    index: r.index_real,
    difficulty: r.difficulty,
    title: r.title,
    focus: r.focus,
    answer: safeJsonArray(r.answer),
    followups: safeJsonArray(r.followups),
    tags: safeJsonArray(r.tags),
    status: r.status,
    source: r.source,
    sourceId: r.source_id,
    sourceRef: r.source_ref ?? '',
    jdId: r.jd_id,
    isCode: !!r.is_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function questionToMyRow(q: Question): MyRow {
  return {
    id: q.id,
    category: q.category,
    module: q.module,
    module_name: q.moduleName,
    index_real: q.index,
    difficulty: q.difficulty,
    title: q.title,
    focus: q.focus,
    answer: JSON.stringify(q.answer),
    followups: JSON.stringify(q.followups),
    tags: JSON.stringify(q.tags),
    status: q.status,
    source: q.source === 'official' ? 'manual' : q.source,
    source_id: q.sourceId,
    source_ref: q.sourceRef,
    jd_id: q.jdId,
    is_code: q.isCode ? 1 : 0,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
  };
}

const MY_COLS =
  'id,category,module,module_name,index_real,difficulty,title,focus,answer,followups,tags,status,source,source_id,source_ref,jd_id,is_code,created_at,updated_at';

function upsertMySql(): string {
  return (
    `INSERT INTO questions (${MY_COLS}) VALUES ` +
    '($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ' +
    'ON CONFLICT(id) DO UPDATE SET module=$3,module_name=$4,index_real=$5,difficulty=$6,title=$7,focus=$8,' +
    'answer=$9,followups=$10,tags=$11,status=$12,source=$13,source_id=$14,source_ref=$15,jd_id=$16,is_code=$17,updated_at=$19'
  );
}

function myRowParams(r: MyRow): unknown[] {
  return [
    r.id, r.category, r.module, r.module_name, r.index_real, r.difficulty, r.title, r.focus,
    r.answer, r.followups, r.tags, r.status, r.source, r.source_id, r.source_ref, r.jd_id,
    r.is_code, r.created_at, r.updated_at,
  ];
}

// ===== 初始化 =====

export async function initStorage(
  opts: { file?: string; loadBundledBank?: boolean; db?: Database | null } = {},
): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { file = 'sqlite:resume.db', loadBundledBank = true, db: injected } = opts;
    db = injected !== undefined ? injected : await openDb(file);
    if (db) {
      await ensureSchema(db);

      // 官方库
      const officialRows = await db.select<OfficialRow[]>('SELECT * FROM official_questions');
      for (const r of officialRows) officialCache.push(officialRowToQuestion(r, r.category));

      const catRows = await db.select<CategoryMeta[]>(
        'SELECT slug, name, description FROM official_categories ORDER BY slug',
      );
      categoryCache.push(...catRows);

      // 我的库
      const myRows = await db.select<MyRow[]>(`SELECT ${MY_COLS} FROM questions`);
      for (const r of myRows) myCache.push(myRowToQuestion(r));

      // 进度
      const reviewRows = await db.select<ReviewRow[]>(
        'SELECT id, category, interval, ease, reps, due, last_review, last_rating FROM review_state',
      );
      for (const r of reviewRows) reviewCache.set(r.id, rowToCard(r));

      // 笔记 / 草稿
      const noteRows = await db.select<{ id: string; content: string }[]>('SELECT id, content FROM notes');
      for (const n of noteRows) noteCache.set(n.id, n.content);
      const draftRows = await db.select<{ id: string; content: string }[]>('SELECT id, content FROM code_drafts');
      for (const d of draftRows) draftCache.set(d.id, d.content);

      // JD
      const jdRows = await db.select<{
        id: number; title: string; company: string; content: string; created_at: number; last_active_at: number;
      }[]>('SELECT id, title, company, content, created_at, last_active_at FROM jds ORDER BY last_active_at DESC');
      for (const j of jdRows)
        jdCache.push({ id: j.id, title: j.title, company: j.company, content: j.content, createdAt: j.created_at, lastActiveAt: j.last_active_at });

      // 档案 / meta / secrets
      const profileRows = await db.select<Profile[]>('SELECT resume, preferences FROM profile WHERE id = 1');
      if (profileRows[0]) profileCache = profileRows[0];
      const metaRows = await db.select<{ key: string; value: string }[]>('SELECT key, value FROM meta');
      for (const m of metaRows) metaCache.set(m.key, m.value);
      const secretRows = await db.select<{ name: string; value: string }[]>('SELECT name, value FROM secrets');
      for (const s of secretRows) secretCache.set(s.name, s.value);

      // 评分日志(activity 派生源)
      const logRows = await db.select<RatingLogRow[]>('SELECT question_id, day, rating, rated_at FROM rating_log');
      for (const l of logRows) ratingLogCache.set(`${l.question_id}|${l.day}`, l);
    } else if (loadBundledBank) {
      // 浏览器降级:官方库直接吃包内 questions.json(只读快照)
      await loadBundledIntoCaches();
    }
    logger.info(
      `[storage] init 完成: 官方 ${officialCache.length} 题 / 我的 ${myCache.length} 题 / 进度 ${reviewCache.size} / JD ${jdCache.length}`,
    );
  })();
  return initPromise;
}

async function loadBundledIntoCaches(): Promise<void> {
  try {
    const res = await fetch('/questions.json');
    const data = (await res.json()) as {
      categories: { slug: string; name: string; description: string }[];
      questions: Record<string, unknown>[];
    };
    categoryCache.push(...data.categories.map((c) => ({ slug: c.slug, name: c.name, description: c.description })));
    for (const q of data.questions) {
      officialCache.push({
        id: String(q.id),
        origin: 'official',
        category: String(q.category),
        module: Number(q.module),
        moduleName: String(q.moduleName),
        index: Number(q.index),
        difficulty: q.difficulty as Difficulty,
        title: String(q.title),
        focus: String(q.focus ?? ''),
        answer: safeJsonArray(JSON.stringify(q.answer ?? [])),
        followups: safeJsonArray(JSON.stringify(q.followups ?? [])),
        tags: safeJsonArray(JSON.stringify(q.tags ?? [])),
        status: 'approved',
        source: 'official',
        sourceId: null,
        sourceRef: '',
        jdId: null,
        isCode: false,
        createdAt: 0,
        updatedAt: 0,
      });
    }
  } catch (e) {
    logger.error(`[storage] 包内题库加载失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ===== 读(同步,缓存快照) =====

export function getOfficialQuestions(): Question[] {
  return [...officialCache];
}

export function getCategories(): CategoryMeta[] {
  return categoryCache;
}

export function getMyQuestions(): Question[] {
  return [...myCache];
}

export function getAllQuestions(): Question[] {
  return [...officialCache, ...myCache];
}

export function getQuestion(id: string): Question | undefined {
  return officialCache.find((q) => q.id === id) ?? myCache.find((q) => q.id === id);
}

export function getCard(id: string): CardState | null {
  return reviewCache.get(id) ?? null;
}

export function getReviewStates(): Map<string, CardState> {
  return reviewCache;
}

export function getNote(id: string): string {
  return noteCache.get(id) ?? '';
}

export function getCodeDraft(id: string): string {
  return draftCache.get(id) ?? '';
}

export function getJds(): Jd[] {
  return [...jdCache];
}

export function getProfile(): Profile {
  return profileCache;
}

export function getMeta(key: string): string {
  return metaCache.get(key) ?? '';
}

export function getSecret(name: string): string {
  return secretCache.get(name) ?? '';
}

export function getRatingLog(): RatingLogRow[] {
  return [...ratingLogCache.values()];
}

// ===== 写:题目 =====

export function saveMyQuestion(q: Question): void {
  const row = questionToMyRow(q);
  const i = myCache.findIndex((x) => x.id === q.id);
  if (i >= 0) myCache[i] = q;
  else myCache.push(q);
  persist((d) => d.execute(upsertMySql(), myRowParams(row)), 'saveMyQuestion');
  notify('my');
}

/** 通过待审核:生成正式 my.<模块>.<序号> id,原位转 approved(D8);source_ref/jd_id 保留 */
export function approvePending(pendingId: string): string | null {
  const q = myCache.find((x) => x.id === pendingId);
  if (!q || q.status !== 'pending') return null;
  const siblings = myCache.filter((x) => x.module === q.module && x.status === 'approved' && x.id.startsWith('my.'));
  const maxSeq = siblings.reduce((m, x) => Math.max(m, Number(x.id.split('.')[2]) || 0), 0);
  q.id = `my.${q.module}.${maxSeq + 1}`;
  q.status = 'approved';
  q.updatedAt = Date.now();
  const row = questionToMyRow(q);
  persist(async (d) => {
    await d.execute('DELETE FROM questions WHERE id = $1', [pendingId]);
    await d.execute(upsertMySql(), myRowParams(row));
  }, 'approvePending');
  notify('my');
  return q.id;
}

/** 级联删除(§3.3):先删附属,再删题目行 */
export function deleteMyQuestion(id: string): void {
  const i = myCache.findIndex((x) => x.id === id);
  if (i < 0) return;
  myCache.splice(i, 1);
  reviewCache.delete(id);
  noteCache.delete(id);
  draftCache.delete(id);
  for (const [k, l] of ratingLogCache) if (l.question_id === id) ratingLogCache.delete(k);
  persist(
    async (d) => {
      await d.execute('DELETE FROM review_state WHERE id = $1', [id]);
      await d.execute('DELETE FROM notes WHERE id = $1', [id]);
      await d.execute('DELETE FROM code_drafts WHERE id = $1', [id]);
      await d.execute('DELETE FROM rating_log WHERE question_id = $1', [id]);
      await d.execute('DELETE FROM questions WHERE id = $1', [id]);
    },
    'deleteMyQuestion',
  );
  notify('my', 'review', 'activity');
}

// ===== 写:进度 =====

export function saveCard(id: string, card: CardState, category: string): void {
  reviewCache.set(id, card);
  const r = cardToRow(card, category);
  persist(
    (d) =>
      d.execute(
        'INSERT INTO review_state(id,category,interval,ease,reps,due,last_review,last_rating) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ' +
          'ON CONFLICT(id) DO UPDATE SET interval=$3,ease=$4,reps=$5,due=$6,last_review=$7,last_rating=$8',
        [id, r.category, r.interval, r.ease, r.reps, r.due, r.last_review, r.last_rating],
      ),
    'saveCard',
  );
  notify('review');
}

export function deleteCard(id: string): void {
  reviewCache.delete(id);
  persist((d) => d.execute('DELETE FROM review_state WHERE id = $1', [id]), 'deleteCard');
  notify('review');
}

/** 评分日志 upsert(按题+自然日一行,取当日最终评分;activity 由此派生,§4.2) */
export function recordRating(id: string, rating: Rating, at: number): void {
  const day = toDayKey(at);
  const row: RatingLogRow = { question_id: id, day, rating, rated_at: at };
  ratingLogCache.set(`${id}|${day}`, row);
  persist(
    (d) =>
      d.execute(
        'INSERT INTO rating_log(question_id,day,rating,rated_at) VALUES($1,$2,$3,$4) ' +
          'ON CONFLICT(question_id,day) DO UPDATE SET rating=$3,rated_at=$4',
        [row.question_id, row.day, row.rating, row.rated_at],
      ),
    'recordRating',
  );
  notify('activity');
}

// ===== 写:笔记 / 草稿 =====

export function saveNote(id: string, content: string): void {
  if (content.trim()) noteCache.set(id, content);
  else noteCache.delete(id);
  persist(
    (d) =>
      content.trim()
        ? d.execute('INSERT INTO notes(id,category,content,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET content=$3,updated_at=$4', [id, 'my', content, Date.now()])
        : d.execute('DELETE FROM notes WHERE id = $1', [id]),
    'saveNote',
  );
  notify('notes');
}

export function saveCodeDraft(id: string, content: string): void {
  if (content.trim()) draftCache.set(id, content);
  else draftCache.delete(id);
  persist(
    (d) =>
      content.trim()
        ? d.execute('INSERT INTO code_drafts(id,category,content,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET content=$3,updated_at=$4', [id, 'my', content, Date.now()])
        : d.execute('DELETE FROM code_drafts WHERE id = $1', [id]),
    'saveCodeDraft',
  );
  notify('drafts');
}

// ===== 写:JD =====

export function saveJd(jd: Jd): void {
  const i = jdCache.findIndex((j) => j.id === jd.id);
  if (i >= 0) jdCache[i] = jd;
  else jdCache.push(jd);
  jdCache.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  persist(
    (d) =>
      d.execute(
        'INSERT INTO jds(id,title,company,content,created_at,last_active_at) VALUES($1,$2,$3,$4,$5,$6) ' +
          'ON CONFLICT(id) DO UPDATE SET title=$2,company=$3,content=$4,last_active_at=$6',
        [jd.id, jd.title, jd.company, jd.content, jd.createdAt, jd.lastActiveAt],
      ),
    'saveJd',
  );
  notify('jds');
}

export function deleteJd(id: number): void {
  const i = jdCache.findIndex((j) => j.id === id);
  if (i >= 0) jdCache.splice(i, 1);
  persist((d) => d.execute('DELETE FROM jds WHERE id = $1', [id]), 'deleteJd');
  notify('jds');
}

export function touchJd(id: number): void {
  const jd = jdCache.find((j) => j.id === id);
  if (!jd) return;
  jd.lastActiveAt = Date.now();
  jdCache.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  persist((d) => d.execute('UPDATE jds SET last_active_at = $2 WHERE id = $1', [id, jd.lastActiveAt]), 'touchJd');
  notify('jds');
}

export function nextJdId(): number {
  return jdCache.reduce((m, j) => Math.max(m, j.id), 0) + 1;
}

// ===== 写:档案 / meta / secrets =====

export function saveProfile(p: Profile): void {
  profileCache = p;
  persist(
    (d) =>
      d.execute(
        'INSERT INTO profile(id,resume,preferences) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET resume=$1,preferences=$2',
        [p.resume, p.preferences],
      ),
    'saveProfile',
  );
  notify('profile');
}

export function setMeta(key: string, value: string): void {
  metaCache.set(key, value);
  persist(
    (d) => d.execute('INSERT INTO meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [key, value]),
    'setMeta',
  );
  notify('meta');
}

/** 写失败抛出(key 是用户显式录入的凭据,调用方提示) */
export async function setSecret(name: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    secretCache.delete(name);
    if (db) await db.execute('DELETE FROM secrets WHERE name = $1', [name]);
    return;
  }
  secretCache.set(name, v);
  if (db)
    await db.execute('INSERT INTO secrets(name,value) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET value=$2', [name, v]);
  notify('secrets');
}

// ===== activity 派生(§4.2:rated=当日至少评分一次的题数;ok=其中当日最终评分为 ok 的题数) =====

export function activityDays(): ActivityDay[] {
  const byDay = new Map<string, ActivityDay>();
  for (const l of ratingLogCache.values()) {
    let d = byDay.get(l.day);
    if (!d) {
      d = { day: l.day, rated: 0, ok: 0, lastAt: 0 };
      byDay.set(l.day, d);
    }
    d.rated += 1;
    if (l.rating === 'ok') d.ok += 1;
    d.lastAt = Math.max(d.lastAt, l.rated_at);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

function toDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 备份导入导出(§3.4;不含 secrets) =====

export interface BackupEnvelope {
  version: 1;
  exported_at: number;
  tables: {
    questions: MyRow[];
    review_state: ReviewRow[];
    notes: { id: string; category: string; content: string; updated_at: number }[];
    code_drafts: { id: string; category: string; content: string; updated_at: number }[];
    jds: Jd[];
    profile: Profile[];
    meta: { key: string; value: string }[];
    rating_log: RatingLogRow[];
  };
}

export function buildEnvelope(): BackupEnvelope {
  const now = Date.now();
  return {
    version: 1,
    exported_at: now,
    tables: {
      questions: myCache.map(questionToMyRow),
      review_state: [...reviewCache.entries()].map(([id, c]) => ({ ...cardToRow(c, 'my'), id })),
      notes: [...noteCache.entries()].map(([id, content]) => ({ id, category: 'my', content, updated_at: now })),
      code_drafts: [...draftCache.entries()].map(([id, content]) => ({ id, category: 'my', content, updated_at: now })),
      jds: [...jdCache],
      profile: [profileCache],
      meta: [...metaCache.entries()].map(([key, value]) => ({ key, value })),
      rating_log: [...ratingLogCache.values()],
    },
  };
}

/** 整库覆盖导入(BEGIN/COMMIT 走同一连接);成功后重灌缓存,失败回滚并抛出 */
export async function importEnvelope(env: BackupEnvelope): Promise<void> {
  if (!db) {
    applyEnvelopeToCaches(env);
    notify('official', 'my', 'review', 'notes', 'drafts', 'jds', 'profile', 'meta', 'activity');
    return;
  }
  await db.execute('BEGIN');
  try {
    await db.execute('DELETE FROM questions');
    await db.execute('DELETE FROM review_state');
    await db.execute('DELETE FROM notes');
    await db.execute('DELETE FROM code_drafts');
    await db.execute('DELETE FROM jds');
    await db.execute('DELETE FROM meta');
    await db.execute('DELETE FROM rating_log');
    for (const r of env.tables.questions) await db.execute(upsertMySql(), myRowParams(r));
    for (const r of env.tables.review_state) {
      await db.execute(
        'INSERT INTO review_state(id,category,interval,ease,reps,due,last_review,last_rating) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ' +
          'ON CONFLICT(id) DO UPDATE SET interval=$3,ease=$4,reps=$5,due=$6,last_review=$7,last_rating=$8',
        [r.id, r.category, r.interval, r.ease, r.reps, r.due, r.last_review, r.last_rating],
      );
    }
    for (const n of env.tables.notes)
      await db.execute('INSERT INTO notes(id,category,content,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET content=$3', [n.id, n.category, n.content, n.updated_at]);
    for (const c of env.tables.code_drafts)
      await db.execute('INSERT INTO code_drafts(id,category,content,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET content=$3', [c.id, c.category, c.content, c.updated_at]);
    for (const j of env.tables.jds)
      await db.execute('INSERT INTO jds(id,title,company,content,created_at,last_active_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET title=$2,company=$3,content=$4,last_active_at=$6', [j.id, j.title, j.company, j.content, j.createdAt, j.lastActiveAt]);
    for (const p of env.tables.profile)
      await db.execute('INSERT INTO profile(id,resume,preferences) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET resume=$1,preferences=$2', [p.resume, p.preferences]);
    for (const m of env.tables.meta)
      await db.execute('INSERT INTO meta(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2', [m.key, m.value]);
    for (const l of env.tables.rating_log)
      await db.execute('INSERT INTO rating_log(question_id,day,rating,rated_at) VALUES($1,$2,$3,$4) ON CONFLICT(question_id,day) DO UPDATE SET rating=$3,rated_at=$4', [l.question_id, l.day, l.rating, l.rated_at]);
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK').catch(() => undefined);
    throw e;
  }
  applyEnvelopeToCaches(env);
  notify('official', 'my', 'review', 'notes', 'drafts', 'jds', 'profile', 'meta', 'activity');
}

function applyEnvelopeToCaches(env: BackupEnvelope): void {
  myCache.length = 0;
  myCache.push(...env.tables.questions.map(myRowToQuestion));
  reviewCache.clear();
  for (const r of env.tables.review_state) reviewCache.set(r.id, rowToCard(r));
  noteCache.clear();
  for (const n of env.tables.notes) noteCache.set(n.id, n.content);
  draftCache.clear();
  for (const c of env.tables.code_drafts) draftCache.set(c.id, c.content);
  jdCache.length = 0;
  jdCache.push(...env.tables.jds);
  if (env.tables.profile[0]) profileCache = env.tables.profile[0];
  metaCache.clear();
  for (const m of env.tables.meta) metaCache.set(m.key, m.value);
  ratingLogCache.clear();
  for (const l of env.tables.rating_log) ratingLogCache.set(`${l.question_id}|${l.day}`, l);
}

// ===== 官方库同步写入(sync.ts 调用) =====

export async function upsertOfficialQuestions(rows: OfficialRow[], slug: string, name: string, description: string): Promise<void> {
  if (!db) return;
  await db.execute(
    'INSERT INTO official_categories(slug,name,description,synced_at) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO UPDATE SET name=$2,description=$3,synced_at=$4',
    [slug, name, description, Date.now()],
  );
  for (const r of rows) {
    await db.execute(
      'INSERT INTO official_questions(id,category,module,module_name,index_real,difficulty,title,focus,answer,followups,tags,synced_at) ' +
        'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET module=$3,module_name=$4,index_real=$5,difficulty=$6,title=$7,focus=$8,answer=$9,followups=$10,tags=$11,synced_at=$12',
      [r.id, slug, r.module, r.module_name, r.index_real, r.difficulty, r.title, r.focus, r.answer, r.followups, r.tags, Date.now()],
    );
  }
}

/** 官方下架级联清理(ADR-9:id 作废不复用) */
export async function deleteOfficialQuestion(id: string): Promise<void> {
  if (!db) return;
  await db.execute('DELETE FROM review_state WHERE id = $1', [id]);
  await db.execute('DELETE FROM notes WHERE id = $1', [id]);
  await db.execute('DELETE FROM code_drafts WHERE id = $1', [id]);
  await db.execute('DELETE FROM rating_log WHERE question_id = $1', [id]);
  await db.execute('DELETE FROM official_questions WHERE id = $1', [id]);
}

export function applyOfficialCache(questions: Question[], categories: CategoryMeta[]): void {
  officialCache.length = 0;
  officialCache.push(...questions);
  categoryCache.length = 0;
  categoryCache.push(...categories);
  notify('official');
}

export function resetReviewCachesForSync(removedIds: string[]): void {
  for (const id of removedIds) reviewCache.delete(id);
  notify('review', 'official');
}

// ===== 官方题复制到我的库 =====

export function copyOfficialToMy(officialId: string): Question | null {
  const q = officialCache.find((x) => x.id === officialId);
  if (!q) return null;
  const copy: Question = {
    ...q,
    id: nextMyId(q.module),
    origin: 'my',
    category: 'my',
    status: 'approved',
    source: 'copy',
    sourceId: q.id,
    sourceRef: q.title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  myCache.push(copy);
  persist((d) => d.execute(upsertMySql(), myRowParams(questionToMyRow(copy))), 'copyOfficialToMy');
  notify('my');
  return copy;
}

function nextMyId(module: number): string {
  const seq = myCache.filter((x) => x.id.startsWith(`my.${module}.`)).reduce((m, x) => Math.max(m, Number(x.id.split('.')[2]) || 0), 0);
  return `my.${module}.${seq + 1}`;
}

/** 手动添加题目时生成正式 id(人写即人审,直接 approved) */
export function nextMyQuestionId(module: number): string {
  return nextMyId(module);
}

export function nextPendingId(): string {
  return `gen.${Date.now()}.${Math.floor(Math.random() * 1000)}`;
}

// ===== 测试钩子 =====

export function _resetStorageForTest(): void {
  officialCache.length = 0;
  categoryCache.length = 0;
  myCache.length = 0;
  reviewCache.clear();
  noteCache.clear();
  draftCache.clear();
  jdCache.length = 0;
  metaCache.clear();
  secretCache.clear();
  ratingLogCache.clear();
  profileCache = { resume: '', preferences: '{}' };
  db = null;
  initPromise = null;
}

export function _seedForTest(seed: {
  official?: Question[];
  my?: Question[];
  cards?: Record<string, CardState>;
  notes?: Record<string, string>;
  jds?: Jd[];
  profile?: Profile;
  meta?: Record<string, string>;
  ratingLog?: RatingLogRow[];
}): void {
  if (seed.official) {
    const known = new Set(officialCache.map((q) => q.id));
    officialCache.push(...seed.official.filter((q) => !known.has(q.id)));
  }
  if (seed.my) {
    const known = new Set(myCache.map((q) => q.id));
    myCache.push(...seed.my.filter((q) => !known.has(q.id)));
  }
  if (seed.cards) for (const [id, c] of Object.entries(seed.cards)) reviewCache.set(id, c);
  if (seed.notes) for (const [id, c] of Object.entries(seed.notes)) noteCache.set(id, c);
  if (seed.jds) {
    const known = new Set(jdCache.map((j) => j.id));
    jdCache.push(...seed.jds.filter((j) => !known.has(j.id)));
  }
  if (seed.profile) profileCache = seed.profile;
  if (seed.meta) for (const [k, v] of Object.entries(seed.meta)) metaCache.set(k, v);
  if (seed.ratingLog) for (const l of seed.ratingLog) ratingLogCache.set(`${l.question_id}|${l.day}`, l);
  notify('official', 'my', 'review', 'notes', 'drafts', 'jds', 'profile', 'meta', 'activity');
}

/** 供 e2e/dev 注入演示数据 */
export const _testHooks = { _seedForTest, _resetStorageForTest, activityDays, nextDayStart };
