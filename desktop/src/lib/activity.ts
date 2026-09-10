// activity 派生读取:连续天数(D4)+ 最近学习记录(B4)。聚合数据来自 storage.activityDays()。

import { streak } from './scheduler';
import type { ActivityDay } from './types';

export function currentStreak(days: ActivityDay[], now: number): number {
  return streak(new Set(days.filter((d) => d.rated > 0).map((d) => d.day)), now);
}

/** 最近学习记录,最多 n 条(已按日期倒序) */
export function recentActivity(days: ActivityDay[], n = 7): ActivityDay[] {
  return days.filter((d) => d.rated > 0).slice(0, n);
}

/** 未来 k 天的到期分桶(M2 复习预测;含今天,k 默认 7) */
export function dueForecast(cards: Map<string, { dueAt: number }>, now: number, k = 7): { day: string; count: number }[] {
  const buckets: { day: string; count: number }[] = [];
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const labels: string[] = [];
  const starts: number[] = [];
  for (let i = 0; i < k; i++) {
    const start = d.getTime() + i * 24 * 60 * 60 * 1000;
    starts.push(start);
    labels.push(i === 0 ? '今天' : i === 1 ? '明天' : `${new Date(start).getMonth() + 1}/${new Date(start).getDate()}`);
    buckets.push({ day: labels[i], count: 0 });
  }
  for (const c of cards.values()) {
    for (let i = k - 1; i >= 0; i--) {
      if (c.dueAt < starts[i] + 24 * 60 * 60 * 1000 && c.dueAt >= starts[i]) {
        buckets[i].count += 1;
        break;
      }
    }
  }
  return buckets;
}
