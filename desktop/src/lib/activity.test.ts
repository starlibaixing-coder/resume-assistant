import { describe, it, expect } from 'vitest';
import {
  dayKey,
  formatActivityTime,
  groupStudyByDay,
  groupGenerationsByDay,
  getRecentActivity,
  type CategoryRef,
} from './activity';
import type { CardState } from './sm2';
import type { MyQuestion } from '@/types/question';

// 2026-09-03(周四) 15:00 本地时间
const NOW = new Date(2026, 8, 3, 15, 0, 0).getTime();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function card(lastReview: number, interval = 0): CardState {
  return { due: lastReview + DAY, interval, ease: 2.5, reps: 1, lastReview };
}

function myQ(partial: Partial<MyQuestion> & Pick<MyQuestion, 'id'>): MyQuestion {
  return {
    category: 'my', module: 1, moduleName: 'React Hooks 深入', index: 1, type: 'qa',
    difficulty: '中', tags: [], title: 't', focus: 'f', answer: ['a'], followups: [],
    status: 'pending', sourceId: null, source: 'ai', createdAt: NOW, updatedAt: NOW,
    ...partial,
  };
}

const CATS: CategoryRef[] = [{ slug: 'fe', name: '前端工程师' }];

describe('dayKey / formatActivityTime', () => {
  it('dayKey 输出本地时区 YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 8, 3, 9, 30).getTime())).toBe('2026-09-03');
  });
  it('同日显示 HH:mm,昨天显示「昨天」,更早显示 M 月 D 日', () => {
    const t1 = new Date(2026, 8, 3, 9, 5).getTime();
    expect(formatActivityTime(t1, NOW)).toBe('09:05');
    const t2 = new Date(2026, 8, 2, 22, 0).getTime();
    expect(formatActivityTime(t2, NOW)).toBe('昨天');
    const t3 = new Date(2026, 7, 30, 12, 0).getTime();
    expect(formatActivityTime(t3, NOW)).toBe('8 月 30 日');
  });
});

describe('groupStudyByDay', () => {
  it('按天聚合并统计掌握数,time 取当天最晚一次', () => {
    const cards = {
      a: card(NOW - HOUR, 16),          // 今天,已掌握
      b: card(NOW - 2 * HOUR),          // 今天,未掌握
      c: card(NOW - DAY - HOUR, 20),    // 昨天,已掌握
      d: card(NOW - 30 * DAY),          // 窗口外,忽略
      e: card(NOW + HOUR),              // 未来时间(脏数据),忽略
    };
    const r = groupStudyByDay(cards, 'fe', '前端工程师', NOW, 7 * DAY);
    expect(r).toHaveLength(2);
    const today = r.find((x) => x.time === NOW - HOUR)!;
    expect(today.count).toBe(2);
    expect(today.masteredCount).toBe(1);
    expect(today.categoryName).toBe('前端工程师');
    expect(r.some((x) => x.count === 1 && x.masteredCount === 1)).toBe(true);
  });
  it('空进度返回空数组', () => {
    expect(groupStudyByDay({}, 'fe', '前端工程师', NOW, 7 * DAY)).toEqual([]);
  });
});

describe('groupGenerationsByDay', () => {
  it('pending 按 createdAt 聚合,approved 按 updatedAt(通过时刻)聚合', () => {
    const qs = [
      myQ({ id: 'my.1.1', moduleName: 'Event Loop', createdAt: NOW - HOUR }),
      myQ({ id: 'my.1.2', moduleName: 'Event Loop', createdAt: NOW - 2 * HOUR }),
      myQ({ id: 'my.2.1', moduleName: 'RAG', status: 'approved', createdAt: NOW - 3 * DAY, updatedAt: NOW - HOUR, source: 'jd' }),
      myQ({ id: 'my.2.2', moduleName: '手动模块', status: 'approved', source: 'manual' }), // manual 不进动态
    ];
    const r = groupGenerationsByDay(qs, NOW, 7 * DAY);
    const gen = r.find((x) => x.kind === 'generated')!;
    expect(gen).toMatchObject({ kind: 'generated', moduleName: 'Event Loop', count: 2 });
    const app = r.find((x) => x.kind === 'approved')!;
    expect(app).toMatchObject({ kind: 'approved', moduleName: 'RAG', count: 1 });
    expect(r.filter((x) => x.moduleName === '手动模块')).toHaveLength(0);
  });
});

describe('getRecentActivity', () => {
  it('空数据返回空数组,limit 截断生效', () => {
    // 单测环境无 Tauri:storage/mylib/jd 都是内存空库,只验证查询入口不炸且返回数组
    const r = getRecentActivity(CATS, { now: NOW, limit: 2 });
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r.every((x) => ['study', 'generated', 'approved', 'jd'].includes(x.kind))).toBe(true);
  });
});
