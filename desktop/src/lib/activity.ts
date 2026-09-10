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
