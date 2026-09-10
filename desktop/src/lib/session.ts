// 会话引擎(tech-design §4.2):状态仅内存,模块级单例,useSyncExternalStore 订阅。
// 队列:|Q| 全部先按 due_at 升序、同日按 id 升序;
//   复习 = approved 且 due≤now,不限量(ADR-0001)
//   学习 = 待学习按 id 升序,上限 batch_size
//   学习全部题目 = 全部 approved,id 升序,不限量(Q9)
//   单题直练 = [qid]
// 重练:评 no 且本轮未重练过 → push 副本(D17;重练覆盖 = 直接再调 rate,以最后评分为准)
// 消失题(ADR-0004):渲染前查存在性,缺失 → 跳过不计小结。
// activity:每次评分后 rating_log 按题重算当日行(中途退出不丢统计)。

import { rate } from './scheduler';
import { getCard, getQuestion, recordRating, saveCard } from './storage';

export type SessionType = 'review' | 'study' | 'again' | 'single';

export interface SessionItem {
  qid: string;
  isRetry?: boolean;
}

export interface QueueInput {
  type: SessionType;
  /** 全部 approved 题(单题直练除外) */
  questions: { id: string; dueAt?: number }[];
  cards: Map<string, { dueAt: number }>;
  batchSize: number | 'all';
  singleQid?: string;
  /** 可注入时钟(单测);缺省取当前时间 */
  now?: number;
}

/** 队列构造(纯函数,单测锚点) */
export function buildQueue(input: QueueInput): SessionItem[] {
  const { type, questions, cards, batchSize, singleQid } = input;
  const now = input.now ?? Date.now();
  if (type === 'single') return singleQid ? [{ qid: singleQid }] : [];
  const approved = [...questions].sort((a, b) => {
    const da = cards.get(a.id)?.dueAt ?? Number.MAX_SAFE_INTEGER;
    const dbb = cards.get(b.id)?.dueAt ?? Number.MAX_SAFE_INTEGER;
    if (da !== dbb) return da - dbb;
    return a.id < b.id ? -1 : 1;
  });
  if (type === 'review') {
    return approved.filter((q) => (cards.get(q.id)?.dueAt ?? Number.MAX_SAFE_INTEGER) <= now).map((q) => ({ qid: q.id }));
  }
  if (type === 'study') {
    const isNew = (id: string) => !cards.has(id);
    const list = approved.filter((q) => isNew(q.id));
    const cap = batchSize === 'all' ? list.length : Math.min(list.length, batchSize);
    return list.slice(0, cap).map((q) => ({ qid: q.id }));
  }
  return approved.map((q) => ({ qid: q.id }));
}

export interface SummaryEntry {
  qid: string;
  final: 'ok' | 'fuzzy' | 'no';
  isRetry: boolean;
}

export interface SessionSummary {
  total: number;
  mastered: number;
  weak: number;
  entries: SummaryEntry[];
}

export interface SessionSnapshot {
  type: SessionType;
  items: SessionItem[];
  index: number;
  revealed: boolean;
  finished: boolean;
}

interface ActiveSession {
  type: SessionType;
  items: SessionItem[];
  index: number;
  revealed: boolean;
  finished: boolean;
  /** 评分后锁定到结果条播完,期间再评无效(反馈归属当前题) */
  locked: boolean;
  /** 按题去重的最终评分(小结与 activity 口径) */
  finals: Map<string, { final: 'ok' | 'fuzzy' | 'no'; isRetry: boolean }>;
}

let session: ActiveSession | null = null;
let cachedSnap: SessionSnapshot | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  cachedSnap = session
    ? { type: session.type, items: session.items, index: session.index, revealed: session.revealed, finished: session.finished }
    : null;
  for (const fn of listeners) fn();
}

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSessionSnapshot(): SessionSnapshot | null {
  return cachedSnap;
}

export function startSession(input: QueueInput): void {
  const items = buildQueue(input);
  session = { type: input.type, items, index: 0, revealed: false, finished: items.length === 0, locked: false, finals: new Map() };
  if (items.length === 0) session.finished = true;
  emit();
}

export function endSession(): void {
  session = null;
  emit();
}

/** 当前题是否存在(ADR-0004:删除的题渲染前拦截) */
export function currentQuestionExists(): boolean {
  if (!session || session.finished) return false;
  return !!getQuestion(session.items[session.index].qid);
}

/** 消失题:原位跳过,不计小结 */
export function skipMissing(): void {
  if (!session) return;
  advance();
}

export function reveal(): void {
  if (!session || session.finished) return;
  session.revealed = true;
  emit();
}

/** 隐藏答案(重新自测);␣/Enter 可再次揭示 */
export function hideAnswer(): void {
  if (!session || session.finished || !session.revealed) return;
  session.revealed = false;
  emit();
}

/** 评分:单一通道写 review_state + rating_log;评 no 触发重练副本。
 *  写入后锁定,由 UI 在结果条(~1s)播完调 confirmAdvance() 推进(§4.2 结果条节奏)。 */
export function rateCurrent(rating: 'ok' | 'fuzzy' | 'no', now = Date.now()): void {
  if (!session || session.finished || !session.revealed || session.locked) return;
  const qid = session.items[session.index].qid;
  const isRetry = !!session.items[session.index].isRetry;
  const q = getQuestion(qid);
  if (q) {
    const card = rate(getCard(qid), rating, now);
    saveCard(qid, card, q.category);
    recordRating(qid, rating, now);
    session.finals.set(qid, { final: rating, isRetry });
    // 重练:仅首遇 no 且本轮未重练过
    const alreadyRetried = session.items.some((it) => it.qid === qid && it.isRetry);
    if (rating === 'no' && !isRetry && !alreadyRetried) {
      session.items.push({ qid, isRetry: true });
    }
  }
  session.locked = true;
  emit();
}

/** 结果条播完后的推进 */
export function confirmAdvance(): void {
  if (!session?.locked) return;
  session.locked = false;
  advance();
}

/** 强制解锁(结束会话/切题等路径) */
export function forceUnlock(): void {
  if (session) session.locked = false;
}

function advance(): void {
  if (!session) return;
  session.index += 1;
  session.revealed = false;
  if (session.index >= session.items.length) session.finished = true;
  emit();
}

/** 小结(Q12):按题去重,重练题标 isRetry 取最终评分 */
export function buildSummary(): SessionSummary {
  const finals = session?.finals ?? new Map();
  const entries: SummaryEntry[] = [];
  for (const it of session?.items ?? []) {
    const f = finals.get(it.qid);
    if (!f) continue;
    if (!entries.some((e) => e.qid === it.qid)) entries.push({ qid: it.qid, final: f.final, isRetry: f.isRetry });
  }
  const mastered = entries.filter((e) => e.final === 'ok').length;
  return { total: entries.length, mastered, weak: entries.length - mastered, entries };
}

export function isInSession(): boolean {
  return !!session && !session.finished;
}
