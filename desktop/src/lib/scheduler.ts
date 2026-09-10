// SM-2 调度(纯函数,tech-design §4.1;ADR-0002 评分映射 no=2/fuzzy=4/ok=5,ADR-0005 单一评分通道)。
// 数值锚点(单测):首评 ok→3 天;第二次 ok→7 天;第三次 ok(EF=2.5)→18 天;
// 间隔 30 天评 fuzzy→18 天(max(1, round(30×0.6)));评 no→次日。
// 注:文档样例「EF 2.5→2.18」与公式矛盾(公式 q=4 时 EF 不变),以公式为准,已在设计文档回报。

import { nextDayStart, todayStart } from './utils';
import type { CardState, Rating } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const QUALITY: Record<Rating, number> = { no: 2, fuzzy: 4, ok: 5 };

export function newCard(now: number): CardState {
  return { ef: 2.5, intervalDays: 0, reps: 0, lastRating: null, lastRatedAt: null, dueAt: now };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function rate(card: CardState | null, rating: Rating, now: number): CardState {
  const q = QUALITY[rating];
  let ef = card?.ef ?? 2.5;
  const prevInterval = card?.intervalDays ?? 0;
  let reps = card?.reps ?? 0;
  let interval: number;

  ef = clamp(ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)), 1.3, 2.5);
  if (rating === 'no') {
    reps = 0;
    interval = 1;
  } else if (reps === 0) {
    // 首评:no=1 / fuzzy=2 / ok=3(Q7)
    interval = rating === 'fuzzy' ? 2 : 3;
    reps = 1;
  } else if (rating === 'ok') {
    reps += 1;
    interval = reps === 2 ? 7 : Math.max(1, Math.round(prevInterval * ef));
  } else {
    reps += 1;
    interval = Math.max(1, Math.round(prevInterval * 0.6));
  }

  return {
    ef,
    intervalDays: interval,
    reps,
    lastRating: rating,
    lastRatedAt: now,
    // due_at 粒度 = 自然日:interval 天后的 00:00(本地时区)
    dueAt: todayStart(now) + interval * DAY_MS,
  };
}

/** 连续学习天数(D4):从今天(无记录则从昨天)向回数有评分的连续天数 */
export function streak(daysWithRatings: Set<string>, now: number): number {
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  if (!daysWithRatings.has(dayKeyOf(cursor))) cursor.setTime(cursor.getTime() - DAY_MS);
  let n = 0;
  while (daysWithRatings.has(dayKeyOf(cursor))) {
    n += 1;
    cursor.setTime(cursor.getTime() - DAY_MS);
  }
  return n;
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export { nextDayStart };
