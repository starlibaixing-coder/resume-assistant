// 题库领域:五档状态派生(§3.2,筛选与展示共用同一函数,禁止各写各的)、
// 计数口径、筛选与模糊搜索。全部纯函数。

import type { CardState, DerivedStatus, Question } from './types';

/** 五档互斥(ADR-0003):pending > 待学习 > 待复习 > 已掌握/已排期(按最后评分) */
export function deriveStatus(q: Question, card: CardState | null | undefined, now: number): DerivedStatus {
  if (q.status === 'pending') return 'pending';
  if (!card) return 'new';
  if (card.dueAt <= now) return 'due';
  return card.lastRating === 'ok' ? 'mastered' : 'scheduled';
}

export interface StatusCounts {
  pending: number;
  new: number;
  due: number;
  mastered: number;
  scheduled: number;
}

/** 计数口径:全库 approved + pending;「我的 N」= approved 的我的题(§3.2) */
export function countStatus(questions: Question[], cards: Map<string, CardState>, now: number): StatusCounts {
  const c: StatusCounts = { pending: 0, new: 0, due: 0, mastered: 0, scheduled: 0 };
  for (const q of questions) {
    c[deriveStatus(q, cards.get(q.id), now)] += 1;
  }
  return c;
}

export type StatusFilter = DerivedStatus | 'all';
export type DifficultyFilter = 'all' | '初' | '中' | '高';
export type SourceFilter = 'all' | 'official' | 'manual' | 'copy' | 'ai' | 'jd';

export interface QuestionFilter {
  status?: StatusFilter;
  difficulty?: DifficultyFilter;
  source?: SourceFilter;
  module?: number | 'all';
  search?: string;
}

export function filterQuestions(list: Question[], cards: Map<string, CardState>, f: QuestionFilter, now: number): Question[] {
  const kw = f.search?.trim().toLowerCase();
  return list.filter((q) => {
    if (f.status && f.status !== 'all' && deriveStatus(q, cards.get(q.id), now) !== f.status) return false;
    if (f.difficulty && f.difficulty !== 'all' && q.difficulty !== f.difficulty) return false;
    if (f.source && f.source !== 'all' && q.source !== f.source) return false;
    if (f.module !== undefined && f.module !== 'all' && q.module !== f.module) return false;
    if (kw) {
      const hay = `${q.title} ${q.focus} ${q.moduleName} ${q.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/** 模块列表(按 module 号升序,名称取该模块第一题) */
export function modulesOf(list: Question[]): { module: number; name: string; count: number }[] {
  const map = new Map<number, { module: number; name: string; count: number }>();
  for (const q of list) {
    let m = map.get(q.module);
    if (!m) {
      m = { module: q.module, name: q.moduleName, count: 0 };
      map.set(q.module, m);
    }
    m.count += 1;
  }
  return [...map.values()].sort((a, b) => a.module - b.module);
}

/** 来源信息口径(§3.2):优先 source_ref 快照,缺失回退 source 文案(D27) */
export function sourceLine(q: Question): string {
  if (q.sourceRef) return q.sourceRef;
  switch (q.source) {
    case 'ai':
      return 'AI 生成';
    case 'jd':
      return '按 JD 生成';
    case 'copy':
      return '官方复制';
    case 'manual':
      return '手动添加';
    default:
      return '官方题库';
  }
}
