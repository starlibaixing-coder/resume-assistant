// deriveStatus 五档互斥(ADR-0003)+ 计数口径 + 筛选

import { describe, expect, it } from 'vitest';

import { countStatus, deriveStatus, filterQuestions, modulesOf, sourceLine } from './bank';
import { _seedForTest, _resetStorageForTest, getReviewStates } from './storage';
import type { Question } from './types';

const NOW = new Date('2026-09-09T10:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

function q(partial: Partial<Question>): Question {
  return {
    id: 'x.1.1',
    origin: 'my',
    category: 'my',
    module: 1,
    moduleName: 'm',
    index: 1,
    difficulty: '中',
    title: 't',
    focus: 'f',
    answer: ['a'.repeat(60)],
    followups: [],
    tags: [],
    status: 'approved',
    source: 'manual',
    sourceId: null,
    sourceRef: '',
    jdId: null,
    isCode: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('deriveStatus 五档互斥', () => {
  it('pending → 待审核(优先于一切进度)', () => {
    const r = deriveStatus(q({ status: 'pending' }), { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: NOW, dueAt: NOW - DAY }, NOW);
    expect(r).toBe('pending');
  });

  it('approved 无进度行 → 待学习', () => {
    expect(deriveStatus(q({}), null, NOW)).toBe('new');
  });

  it('有行且 due≤now → 待复习(即使最后评分为 ok)', () => {
    const r = deriveStatus(q({}), { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: NOW - 5 * DAY, dueAt: NOW }, NOW);
    expect(r).toBe('due');
  });

  it('due>now + last_rating=ok → 已掌握;!=ok(含 null 旧行)→ 已排期', () => {
    const base = { ef: 2.5, intervalDays: 3, reps: 1, lastRatedAt: NOW - DAY, dueAt: NOW + DAY };
    expect(deriveStatus(q({}), { ...base, lastRating: 'ok' }, NOW)).toBe('mastered');
    expect(deriveStatus(q({}), { ...base, lastRating: 'fuzzy' }, NOW)).toBe('scheduled');
    expect(deriveStatus(q({}), { ...base, lastRating: 'no' }, NOW)).toBe('scheduled');
    expect(deriveStatus(q({}), { ...base, lastRating: null }, NOW)).toBe('scheduled');
  });
});

describe('countStatus 计数口径', () => {
  it('五档全量计数与互斥(总数守恒)', () => {
    _resetStorageForTest();
    const list = [
      q({ id: 'a', status: 'pending' }),
      q({ id: 'b' }),
      q({ id: 'c' }),
      q({ id: 'd' }),
      q({ id: 'e' }),
    ];
    const cards = getReviewStates();
    cards.set('c', { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: NOW - DAY, dueAt: NOW - 1 });
    cards.set('d', { ef: 2.5, intervalDays: 3, reps: 1, lastRating: 'ok', lastRatedAt: NOW - DAY, dueAt: NOW + DAY });
    cards.set('e', { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'fuzzy', lastRatedAt: NOW - DAY, dueAt: NOW + DAY });
    const c = countStatus(list, cards, NOW);
    expect(c).toEqual({ pending: 1, new: 1, due: 1, mastered: 1, scheduled: 1 });
    expect(c.pending + c.new + c.due + c.mastered + c.scheduled).toBe(list.length);
  });
});

describe('filterQuestions / modulesOf / sourceLine', () => {
  const list = [
    q({ id: '1', difficulty: '初', source: 'ai', module: 1, moduleName: '基础', title: '闭包是什么', tags: ['必问'] }),
    q({ id: '2', difficulty: '高', source: 'manual', module: 2, moduleName: '进阶', title: '手写 Promise' }),
    q({ id: '3', status: 'pending', source: 'jd', module: 1, moduleName: '基础', title: '事件循环' }),
  ];

  it('按状态/难度/来源/搜索组合筛选', () => {
    const cards = getReviewStates();
    expect(filterQuestions(list, cards, { status: 'pending' }, NOW)).toHaveLength(1);
    expect(filterQuestions(list, cards, { difficulty: '初' }, NOW)).toHaveLength(1);
    expect(filterQuestions(list, cards, { source: 'ai' }, NOW)).toHaveLength(1);
    expect(filterQuestions(list, cards, { search: 'promise' }, NOW)).toHaveLength(1);
    expect(filterQuestions(list, cards, { module: 1 }, NOW)).toHaveLength(2);
  });

  it('modulesOf 按模块聚合计数', () => {
    expect(modulesOf(list)).toEqual([
      { module: 1, name: '基础', count: 2 },
      { module: 2, name: '进阶', count: 1 },
    ]);
  });

  it('sourceLine:source_ref 快照优先(D27)', () => {
    expect(sourceLine(q({ sourceRef: '按 JD 生成 · 前端岗' }))).toBe('按 JD 生成 · 前端岗');
    expect(sourceLine(q({ source: 'ai' }))).toBe('AI 生成');
    expect(sourceLine(q({ source: 'copy' }))).toBe('官方复制');
  });
});

// seed 钩子在本文件的用途说明(避免 no-unused 私有导入告警的等价物)
void _seedForTest;
