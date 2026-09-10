// 今日页组件:7 日到期预测柱(M2)/ 最近学习记录(B4)。

import { useMemo } from 'react';

import { dueForecast, recentActivity } from '@/lib/activity';
import type { ActivityDay } from '@/lib/types';
import { getReviewStates } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function ForecastBars({ now }: { now: number }) {
  const buckets = useMemo(() => dueForecast(getReviewStates(), now, 7), [now]);
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="flex h-28 items-end gap-2">
      {buckets.map((b) => (
        <div key={b.day} className="flex flex-1 flex-col items-center gap-1.5">
          <span className={cn('text-xs tabular-nums', b.count === 0 ? 'text-muted-foreground/40' : 'font-medium text-primary')}>
            {b.count}
          </span>
          <div
            className={cn(
              'w-full max-w-9 rounded-t-md transition-colors duration-150',
              b.count === 0 ? 'h-1 bg-muted' : 'bg-primary/70 hover:bg-primary',
            )}
            style={b.count === 0 ? undefined : { height: `${Math.max(8, (b.count / max) * 72)}px` }}
            title={`${b.day}:${b.count} 题到期`}
          />
          <span className="text-[11px] text-muted-foreground">{b.day}</span>
        </div>
      ))}
    </div>
  );
}

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
        暂无学习记录。完成一次评分后,这里会按天汇总。
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/70 rounded-xl bg-card px-4">
      {rows.map((d) => (
        <li key={d.day} className="flex items-center justify-between py-2.5 text-sm">
          <span>{dayLabel(d.day, now)}</span>
          <span className="text-muted-foreground">
            评分 <span className="font-medium text-foreground tabular-nums">{d.rated}</span> 道
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
