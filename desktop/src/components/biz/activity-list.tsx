// 最近学习(M2):按天聚合的评分记录,取最近几条;空态给缺省说明。

import { recentActivity } from '@/lib/activity';
import type { ActivityDay } from '@/lib/types';

function dayLabel(day: string, now: number): string {
  const today = new Date(now);
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now - 24 * 60 * 60 * 1000);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (day === key) return '今天';
  if (day === yKey) return '昨天';
  const [, m, d] = day.split('-');
  return `${Number(m)} 月 ${Number(d)} 日`;
}

export function ActivityList({ days, now }: { days: ActivityDay[]; now: number }) {
  const rows = recentActivity(days, 6);
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-testid="activity-empty">
        暂无学习记录。
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70 rounded-xl bg-card px-4">
      {rows.map((d) => (
        <li key={d.day} className="flex items-center justify-between py-2.5 text-sm">
          <span>{dayLabel(d.day, now)}</span>
          <span className="text-muted-foreground">
            学了 <span className="font-medium text-foreground tabular-nums">{d.rated}</span> 道
            {d.ok > 0 && (
              <>
                {' · 掌握 '}
                <span className="font-medium text-success tabular-nums">{d.ok}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
