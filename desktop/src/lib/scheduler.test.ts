// SM-2 数值锚点(§4.1 五例)+ 连续天数(D4)

import { describe, expect, it } from 'vitest';

import { newCard, rate, streak } from './scheduler';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-09T10:00:00').getTime();

function dueDays(from: number, dueAt: number): number {
  return Math.round((dueAt - from) / DAY);
}

describe('rate 数值样例(实现必须复现)', () => {
  it('首评 ok → 3 天后', () => {
    const c = rate(null, 'ok', NOW);
    expect(c.intervalDays).toBe(3);
    expect(c.reps).toBe(1);
    expect(dueDays(new Date(NOW).setHours(0, 0, 0, 0), c.dueAt)).toBe(3);
  });

  it('该题第二次 ok → 7 天后', () => {
    const first = rate(null, 'ok', NOW - DAY);
    const second = rate(first, 'ok', NOW);
    expect(second.intervalDays).toBe(7);
    expect(second.reps).toBe(2);
  });

  it('第三次 ok(EF=2.5)→ 18 天后(7×2.5 四舍五入)', () => {
    const first = rate(null, 'ok', NOW - 10 * DAY);
    const second = rate(first, 'ok', NOW - 3 * DAY);
    const third = rate(second, 'ok', NOW);
    expect(third.ef).toBeCloseTo(2.5, 5);
    expect(third.intervalDays).toBe(18);
  });

  it('间隔 30 天的题评 fuzzy → 18 天后(max(1, round(30×0.6)))', () => {
    const base: Parameters<typeof rate>[0] = {
      ef: 2.5,
      intervalDays: 30,
      reps: 5,
      lastRating: 'ok',
      lastRatedAt: NOW - 30 * DAY,
      dueAt: NOW,
    };
    const c = rate(base, 'fuzzy', NOW);
    expect(c.intervalDays).toBe(18);
    // 公式:q=4 时 EF 增量为 0(文档样例「2.5→2.18」与公式矛盾,以公式为准)
    expect(c.ef).toBeCloseTo(2.5, 5);
  });

  it('评 no → 次日,reps 归零', () => {
    const base: Parameters<typeof rate>[0] = { ...newCard(NOW), intervalDays: 15, reps: 3 };
    const c = rate(base, 'no', NOW);
    expect(c.intervalDays).toBe(1);
    expect(c.reps).toBe(0);
    expect(dueDays(new Date(NOW).setHours(0, 0, 0, 0), c.dueAt)).toBe(1);
  });

  it('EF 下限 1.3:连续 no 不击穿', () => {
    let c = newCard(NOW);
    for (let i = 0; i < 10; i++) c = rate(c, 'no', NOW + i);
    expect(c.ef).toBeGreaterThanOrEqual(1.3);
  });

  it('due 落在自然日 00:00(本地时区)', () => {
    const c = rate(null, 'ok', NOW);
    const d = new Date(c.dueAt);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe('streak 连续学习天数(D4)', () => {
  it('从今天向回数;今天无记录从昨天数', () => {
    const day = (offset: number) => {
      const d = new Date(NOW + offset * DAY);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    expect(streak(new Set([day(0), day(-1), day(-2)]), NOW)).toBe(3);
    expect(streak(new Set([day(-1), day(-2)]), NOW)).toBe(2);
    expect(streak(new Set([day(-3)]), NOW)).toBe(0);
    expect(streak(new Set(), NOW)).toBe(0);
  });
});
