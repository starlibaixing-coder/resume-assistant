// 最近学习(M2):按天分组,每天展示当日的题目(点击打开详情抽屉),超出省略计数。

import { useMemo } from 'react';

import { activityDetail } from '@/lib/activity';
import { getQuestion, getRatingLog } from '@/lib/storage';

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

const RATING_LABEL = { ok: '掌握', fuzzy: '模糊', no: '不会' } as const;

export function ActivityList({ now, onOpenQuestion }: { now: number; onOpenQuestion: (qid: string) => void }) {
  const groups = useMemo(() => activityDetail(getRatingLog(), 4), [now]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-testid="activity-empty">
        还没有学习记录。
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70 rounded-xl bg-card px-4" data-testid="activity-list">
      {groups.map((g) => {
        const shown = g.items.slice(0, 3);
        const rest = g.items.length - shown.length;
        return (
          <li key={g.day} className="py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{dayLabel(g.day, now)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{g.items.length} 道</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {shown.map((it) => {
                const q = getQuestion(it.questionId);
                const rating = it.rating as keyof typeof RATING_LABEL;
                return (
                  <li key={it.questionId}>
                    <button
                      type="button"
                      onClick={() => onOpenQuestion(it.questionId)}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                    >
                      <span className={cnRating(rating)}>{RATING_LABEL[rating] ?? '—'}</span>
                      <span className="min-w-0 flex-1 truncate">{q ? q.title : '(题目已删除)'}</span>
                    </button>
                  </li>
                );
              })}
              {rest > 0 && (
                <li className="px-2 text-xs text-muted-foreground">等 {g.items.length} 道</li>
              )}
            </ul>
          </li>
        );
      })}
      {total > 0 && (
        <li className="py-2 text-center text-[11px] text-muted-foreground/70">仅显示最近 {groups.length} 天</li>
      )}
    </ul>
  );
}

function cnRating(rating: string): string {
  const base = 'inline-flex shrink-0 justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-4';
  if (rating === 'ok') return `${base} bg-success/12 text-success`;
  if (rating === 'fuzzy') return `${base} bg-warning/12 text-warning`;
  return `${base} bg-destructive/10 text-destructive`;
}
