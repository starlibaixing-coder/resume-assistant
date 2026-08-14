// 队列调度 + 进度统计 —— 用真实 localStorage(jsdom)间接覆盖 storage 集成
import { describe, it, expect, beforeEach } from 'vitest';
import { getReviewQueue, getStats, getModuleStats, getQuestionStatus } from './schedule';
import { saveCard } from './storage';
import type { CardState } from './sm2';
import type { Question } from '@/types/question';

const CAT = 'agent';
const FUTURE = 9_999_999_999_999; // 远未来,保证未到期

function card(partial: Partial<CardState> = {}): CardState {
  return { due: 0, interval: 0, ease: 2.5, reps: 0, lastReview: null, ...partial };
}

function q(partial: Partial<Question> & { id: string }): Question {
  return {
    id: '', category: CAT, module: 1, moduleName: 'm', index: 1, type: 'qa',
    difficulty: '中', tags: [], title: 't', focus: 'f', answer: [], followups: [],
    ...partial,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('getReviewQueue', () => {
  it('待复习按 due 升序,新题在后,未到期的不出现', () => {
    saveCard(CAT, 'a', card({ due: 100 }));
    saveCard(CAT, 'b', card({ due: 50 }));     // 更早,应排前
    // c 无进度(unseen)
    saveCard(CAT, 'd', card({ due: FUTURE, interval: 2 })); // 有进度但未到期

    const { dueIds, unseen, queue } = getReviewQueue(CAT, ['a', 'b', 'c', 'd']);
    expect(dueIds).toEqual(['b', 'a']);
    expect(unseen).toEqual(['c']);
    expect(queue).toEqual(['b', 'a', 'c']);     // d 未到期,不出现在队列
  });

  it('limit 截断(待复习优先,新题可能被挤掉)', () => {
    saveCard(CAT, 'a', card({ due: 100 }));
    saveCard(CAT, 'b', card({ due: 50 }));
    const { queue } = getReviewQueue(CAT, ['a', 'b', 'c'], 2);
    expect(queue).toEqual(['b', 'a']);          // 截断 2,新题 c 被挤掉
  });

  it('limit=0 不限制', () => {
    saveCard(CAT, 'a', card({ due: 100 }));
    const { queue } = getReviewQueue(CAT, ['a', 'b', 'c'], 0);
    expect(queue).toEqual(['a', 'b', 'c']);
  });
});

describe('getStats', () => {
  it('统计 total/learned/dueToday/remaining', () => {
    saveCard(CAT, 'a', card({ due: 0 }));          // 到期
    saveCard(CAT, 'b', card({ due: FUTURE }));     // 有进度未到期
    // c 无进度
    const s = getStats(CAT, ['a', 'b', 'c']);
    expect(s.total).toBe(3);
    expect(s.learned).toBe(2);
    expect(s.dueToday).toBe(1);
    expect(s.remaining).toBe(1);
  });
});

describe('getModuleStats', () => {
  it('按 module 分组 + 难度桶 + learned/mastered/dueToday', () => {
    const questions = [
      q({ id: 'a', module: 1, difficulty: '初' }),
      q({ id: 'b', module: 1, difficulty: '中' }),
      q({ id: 'c', module: 2, difficulty: '高' }),
    ];
    saveCard(CAT, 'a', card({ due: 0, interval: 1 }));       // 学习中 + 到期
    saveCard(CAT, 'b', card({ due: FUTURE, interval: 5 }));  // 已掌握 + 未到期
    const stats = getModuleStats(CAT, questions);

    expect(stats[1].total).toBe(2);
    expect(stats[1].learned).toBe(2);
    expect(stats[1].mastered).toBe(1);            // b interval>=3
    expect(stats[1].dueToday).toBe(1);            // a 到期
    expect(stats[1].byDifficulty['初'].total).toBe(1);
    expect(stats[1].byDifficulty['初'].learned).toBe(1);
    expect(stats[1].byDifficulty['中'].learned).toBe(1);

    expect(stats[2].total).toBe(1);               // 仅 c
    expect(stats[2].learned).toBe(0);             // c 无进度
  });
});

describe('getQuestionStatus', () => {
  it('unseen / due / learning / mastered', () => {
    expect(getQuestionStatus(CAT, 'x')).toBe('unseen');      // 无进度
    saveCard(CAT, 'a', card({ due: 0, interval: 1 }));       // 到期 + 未掌握
    expect(getQuestionStatus(CAT, 'a')).toBe('due');
    saveCard(CAT, 'b', card({ due: FUTURE, interval: 1 }));  // 未到期 + 未掌握
    expect(getQuestionStatus(CAT, 'b')).toBe('learning');
    saveCard(CAT, 'c', card({ due: FUTURE, interval: 5 }));  // 未到期 + 已掌握
    expect(getQuestionStatus(CAT, 'c')).toBe('mastered');
  });

  it('到期优先于已掌握(该复习的先复习)', () => {
    saveCard(CAT, 'a', card({ due: 0, interval: 5 }));       // 已掌握但到期
    expect(getQuestionStatus(CAT, 'a')).toBe('due');
  });
});
