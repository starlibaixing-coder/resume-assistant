// 最近学习(M2):最近 3 天的学习明细,每条带具体日期时间与掌握情况,点击直接练习该题。

import { useMemo } from 'react';

import { getQuestion, getRatingLog } from '@/lib/storage';

const RATING_LABEL = { ok: '掌握', fuzzy: '模糊', no: '不会' } as const;
const DAYS = 3;
const LIMIT = 9;

interface RecentItem {
  questionId: string;
  rating: keyof typeof RATING_LABEL;
  ratedAt: number;
}

export function ActivityList({ now, onPractice }: { now: number; onPractice: (qid: string) => void }) {
  const items = useMemo<RecentItem[]>(() => {
    const cutoff = now - DAYS * 24 * 60 * 60 * 1000;
    return getRatingLog()
      .filter((l) => l.rated_at >= cutoff)
      .sort((a, b) => b.rated_at - a.rated_at)
      .slice(0, LIMIT)
      .map((l) => ({ questionId: l.question_id, rating: l.rating as keyof typeof RATING_LABEL, ratedAt: l.rated_at }));
  }, [now]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground" data-testid="activity-empty">
        最近 {DAYS} 天还没有学习记录。
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/70 rounded-xl bg-card px-4" data-testid="activity-list">
      {items.map((it) => {
        const q = getQuestion(it.questionId);
        return (
          <li key={`${it.questionId}-${it.ratedAt}`}>
            <button
              type="button"
              disabled={!q}
              onClick={() => onPractice(it.questionId)}
              className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50 disabled:cursor-default"
            >
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtTime(it.ratedAt)}</span>
              <span className={cnRating(it.rating)}>{RATING_LABEL[it.rating]}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{q ? q.title : '(题目已删除)'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return `今天 ${hm}`;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${hm}`;
}

function cnRating(rating: keyof typeof RATING_LABEL): string {
  const base = 'inline-flex shrink-0 justify-center rounded-full px-1.5 py-0.5 text-[11px] leading-4';
  if (rating === 'ok') return `${base} bg-success/12 text-success`;
  if (rating === 'fuzzy') return `${base} bg-warning/12 text-warning`;
  return `${base} bg-destructive/10 text-destructive`;
}
