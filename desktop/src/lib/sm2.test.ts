// SM-2 间隔重复算法 —— 特征化测试,锁住当前行为(迁移安全网)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { newCard, review, isDue, isMastered, type CardState } from './sm2';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-01-01T00:00:00Z').getTime();

function card(partial: Partial<CardState> = {}): CardState {
  return { due: 0, interval: 0, ease: 2.5, reps: 0, lastReview: null, ...partial };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('newCard', () => {
  it('初始状态 reps=0 / interval=0 / ease=2.5 / lastReview=null / due=now', () => {
    expect(newCard()).toEqual({
      reps: 0, interval: 0, ease: 2.5, due: NOW, lastReview: null,
    });
  });
});

describe('review - 不会(失败)', () => {
  it('重置 reps=0 / interval=1 / ease 降 0.2', () => {
    const next = review(card({ reps: 5, interval: 30, ease: 2.5 }), '不会');
    expect(next.reps).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.due).toBe(NOW + DAY_MS);
    expect(next.lastReview).toBe(NOW);
  });

  it('ease 不跌破下限 1.3', () => {
    expect(review(card({ ease: 1.4 }), '不会').ease).toBe(1.3);
    expect(review(card({ ease: 1.3 }), '不会').ease).toBe(1.3);
  });

  it('失败后 reps 归零,再次通过回到 interval=1', () => {
    const failed = review(card({ reps: 3, interval: 9, ease: 2.5 }), '不会');
    const recovered = review(failed, '掌握');
    expect(recovered.reps).toBe(1);
    expect(recovered.interval).toBe(1);
  });
});

describe('review - 掌握(通过)', () => {
  it('首次: reps=1 / interval=1 / ease+0.1', () => {
    const next = review(newCard(), '掌握');
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.ease).toBe(2.6);
  });

  it('第二次: reps=2 / interval=3', () => {
    const next = review(review(newCard(), '掌握'), '掌握');
    expect(next.reps).toBe(2);
    expect(next.interval).toBe(3);
    expect(next.ease).toBe(2.7);
  });

  it('第三次起: interval=round(prev*ease)', () => {
    const c1 = review(newCard(), '掌握'); // reps1 int1 ease2.6
    const c2 = review(c1, '掌握');        // reps2 int3 ease2.7
    const c3 = review(c2, '掌握');        // reps3 int=round(3*2.7)=8 ease2.8
    expect(c3.reps).toBe(3);
    expect(c3.interval).toBe(8);
    // ease 浮点累加: 2.7+0.1 实际为 2.8000...003,锁真实行为用 toBeCloseTo
    expect(c3.ease).toBeCloseTo(2.8, 5);
  });
});

describe('review - 模糊(勉强通过)', () => {
  it('通过 reps+1 但 ease 降 0.14', () => {
    const next = review(newCard(), '模糊');
    expect(next.reps).toBe(1);
    expect(next.interval).toBe(1);
    expect(next.ease).toBeCloseTo(2.36, 5); // 2.5 - 0.14
  });

  it('模糊也递进 interval(第二次=3)', () => {
    const next = review(review(newCard(), '模糊'), '模糊');
    expect(next.reps).toBe(2);
    expect(next.interval).toBe(3);
  });
});

describe('isDue', () => {
  it('due<=now 到期', () => {
    expect(isDue(card({ due: NOW }))).toBe(true);
    expect(isDue(card({ due: NOW - 1 }))).toBe(true);
  });

  it('due>now 未到期', () => {
    expect(isDue(card({ due: NOW + DAY_MS }))).toBe(false);
  });

  it('可注入 now 参数', () => {
    expect(isDue(card({ due: 1001 }), 1000)).toBe(false);
    expect(isDue(card({ due: 1000 }), 1000)).toBe(true);
  });
});

describe('isMastered', () => {
  it('interval>=3 已掌握', () => {
    expect(isMastered(card({ interval: 3 }))).toBe(true);
    expect(isMastered(card({ interval: 9 }))).toBe(true);
  });

  it('interval<3 未掌握', () => {
    expect(isMastered(card({ interval: 2 }))).toBe(false);
    expect(isMastered(card({ interval: 0 }))).toBe(false);
  });

  it('null 未掌握', () => {
    expect(isMastered(null)).toBe(false);
  });
});
