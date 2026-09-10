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

/** 按天的评分明细(最近学习展示用):从 rating_log 分组,题目标题由调用方解析 */
export function activityDetail(
  logs: { question_id: string; day: string; rating: string; rated_at: number }[],
  n = 6,
): { day: string; items: { questionId: string; rating: string }[] }[] {
  const byDay = new Map<string, { items: { questionId: string; rating: string }[]; lastAt: number }>();
  for (const l of logs) {
    let d = byDay.get(l.day);
    if (!d) {
      d = { items: [], lastAt: 0 };
      byDay.set(l.day, d);
    }
    d.items.push({ questionId: l.question_id, rating: l.rating });
    d.lastAt = Math.max(d.lastAt, l.rated_at);
  }
  return [...byDay.entries()]
    .map(([day, v]) => ({ day, items: v.items }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, n);
}
