// 队列构造(五类 + 上限)/ 重练覆盖与去重 / 消失题跳过 / 小结 / activity 口径

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildQueue, buildSummary, confirmAdvance, currentQuestionExists, endSession, getSessionSnapshot, rateCurrent, reveal, skipMissing, startSession } from './session';
import { _resetStorageForTest, _seedForTest, activityDays, deleteMyQuestion, getMyQuestions, getReviewStates } from './storage';
import { rate } from './scheduler';
import type { Question } from './types';

const NOW = new Date('2026-09-09T10:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

function fakeQ(id: string): Question {
  return {
    id,
    origin: 'my',
    category: 'my',
    module: 1,
    moduleName: 'm',
    index: 1,
    difficulty: '中',
    title: `题 ${id}`,
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
  };
}

beforeEach(() => {
  _resetStorageForTest();
  endSession();
  vi.restoreAllMocks();
});

describe('buildQueue 队列构造', () => {
  const cards = new Map([
    ['due.1', { dueAt: NOW - 2 * DAY }],
    ['due.2', { dueAt: NOW - DAY }],
    ['future', { dueAt: NOW + DAY }],
    ['ok.scheduled', { dueAt: NOW + 2 * DAY }],
  ]);
  const questions = [
    { id: 'future' },
    { id: 'due.2' },
    { id: 'new.a' },
    { id: 'due.1' },
    { id: 'new.b' },
    { id: 'new.c' },
    { id: 'ok.scheduled' },
  ];

  const at = { now: NOW };

  it('复习 = approved 且 due≤now,按 due 升序,不限量', () => {
    const out = buildQueue({ type: 'review', questions, cards, batchSize: 'all', ...at });
    expect(out.map((x) => x.qid)).toEqual(['due.1', 'due.2']);
  });

  it('学习 = 待学习按 id 升序,上限 batch_size', () => {
    const out = buildQueue({ type: 'study', questions, cards, batchSize: 2, ...at });
    expect(out.map((x) => x.qid)).toEqual(['new.a', 'new.b']);
  });

  it('学习 = batchSize all 不截断', () => {
    const out = buildQueue({ type: 'study', questions, cards, batchSize: 'all', ...at });
    expect(out).toHaveLength(3);
  });

  it('全库练习(UI:练习全部题目)= 全部 approved(id 升序),不限量', () => {
    const out = buildQueue({ type: 'again', questions: [{ id: 'b' }, { id: 'a' }], cards, batchSize: 'all' });
    expect(out.map((x) => x.qid)).toEqual(['a', 'b']);
  });

  it('单题直练 = [qid]', () => {
    expect(buildQueue({ type: 'single', questions: [], cards, batchSize: 'all', singleQid: 'x' })).toEqual([{ qid: 'x' }]);
    expect(buildQueue({ type: 'single', questions: [], cards, batchSize: 'all' })).toEqual([]);
  });
});

describe('会话引擎:评分 / 重练 / 小结', () => {
  it('评 no 触发重练副本;重练题不重复入队(D17)', () => {
    _seedForTest({ my: [fakeQ('a'), fakeQ('b')] });
    startSession({ type: 'study', questions: [{ id: 'a' }, { id: 'b' }], cards: new Map(), batchSize: 'all' });
    reveal();
    rateCurrent('no', NOW);
    const snap = getSessionSnapshot();
    expect(snap!.items.map((i) => [i.qid, !!i.isRetry])).toEqual([['a', false], ['b', false], ['a', true]]);
    // 结果条期间锁定:再评无效,最终仍为 no
    rateCurrent('fuzzy', NOW + 1);
    confirmAdvance();
    expect(getReviewStates().get('a')!.lastRating).toBe('no');
  });

  it('重练覆盖:同题第二次评分以最后为准,小结按题去重(Q12)', () => {
    _seedForTest({ my: [fakeQ('a')] });
    startSession({ type: 'study', questions: [{ id: 'a' }], cards: new Map(), batchSize: 'all' });
    reveal();
    rateCurrent('no', NOW);
    // 重练副本:推进到重练题
    confirmAdvance();
    reveal();
    rateCurrent('ok', NOW + 1000);
    confirmAdvance();
    const summary = buildSummary();
    expect(summary.total).toBe(1);
    expect(summary.mastered).toBe(1);
    expect(summary.weak).toBe(0);
    expect(summary.entries[0].isRetry).toBe(true);
    expect(getReviewStates().get('a')!.lastRating).toBe('ok');
  });

  it('消失题:渲染前查存在性,跳过不计小结(ADR-0004)', () => {
    _seedForTest({ my: [fakeQ('a')], cards: { gone: { ef: 2.5, intervalDays: 1, reps: 1, lastRating: 'no', lastRatedAt: NOW - DAY, dueAt: NOW - 1 } } });
    // gone 有进度但题目行已删:构造时即被排除
    startSession({
      type: 'review',
      questions: [{ id: 'a' }],
      cards: new Map([['a', { dueAt: NOW - 1 }], ['gone', { dueAt: NOW - 2 }]]),
      batchSize: 'all',
    });
    const snap0 = getSessionSnapshot();
    expect(snap0!.items.map((i) => i.qid)).toEqual(['a']); // gone 不在 questions 里,构造即排除
    // 队列内的题被删除 → currentQuestionExists false → skipMissing 推进
    expect(currentQuestionExists()).toBe(true);
    deleteMyQuestion('a');
    expect(currentQuestionExists()).toBe(false);
    skipMissing();
    expect(getSessionSnapshot()!.finished).toBe(true);
    expect(buildSummary().total).toBe(0);
  });

  it('activity:当日 rating_log 按题去重(rated/ok 口径)', () => {
    _seedForTest({ my: [fakeQ('a'), fakeQ('b'), fakeQ('c')] });
    startSession({ type: 'study', questions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], cards: new Map(), batchSize: 'all' });
    reveal();
    rateCurrent('no', NOW);
    confirmAdvance();
    reveal();
    rateCurrent('ok', NOW + 1000);
    confirmAdvance();
    reveal();
    rateCurrent('ok', NOW + 2000);
    confirmAdvance();
    // 重练副本 a:评 ok,覆盖当日 a 的 no
    reveal();
    rateCurrent('ok', NOW + 3000);
    confirmAdvance();
    const days = activityDays();
    const today = days.find((d) => d.day === localDay(NOW))!;
    // a=no 后重练 ok(覆盖)→ rated=3,ok=3
    expect(today.rated).toBe(3);
    expect(today.ok).toBe(3);
    expect(getMyQuestions()).toHaveLength(3);
  });

  it('SM-2 经由评分通道写入 review_state(单一通道,ADR-0005)', () => {
    _seedForTest({ my: [fakeQ('a')] });
    startSession({ type: 'study', questions: [{ id: 'a' }], cards: new Map(), batchSize: 'all' });
    reveal();
    rateCurrent('ok', NOW);
    confirmAdvance();
    expect(getReviewStates().get('a')!.intervalDays).toBe(rate(null, 'ok', NOW).intervalDays);
  });
});

function localDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
