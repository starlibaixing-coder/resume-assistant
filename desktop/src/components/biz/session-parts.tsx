// 会话组件:评分三键(kbd 提示)/ 结果反馈条(语义色,1s 自动推进)/ 进度头 / 小结面板(M3)。

import { useEffect, useState } from 'react';
import { CheckIcon, HelpCircleIcon, Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MarkdownText } from './markdown-text';
import { cn, formatDate } from '@/lib/utils';
import { nextDayStart } from '@/lib/utils';
import { rate } from '@/lib/scheduler';
import type { Rating } from '@/lib/types';

export function RatingBar({ disabled, onRate }: { disabled?: boolean; onRate: (r: Rating) => void }) {
  const items: { r: Rating; label: string; cls: string; icon: typeof CheckIcon }[] = [
    { r: 'no', label: '不会', cls: 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40', icon: XIcon },
    { r: 'fuzzy', label: '模糊', cls: 'hover:bg-warning/10 hover:text-warning hover:border-warning/40', icon: HelpCircleIcon },
    { r: 'ok', label: '掌握', cls: 'hover:bg-success/10 hover:text-success hover:border-success/40', icon: CheckIcon },
  ];
  return (
    <div className="flex gap-2.5" data-testid="rating-bar">
      {items.map(({ r, label, cls, icon: Icon }) => (
        <Button key={r} variant="outline" disabled={disabled} onClick={() => onRate(r)} className={cn('h-11 flex-1 text-sm', cls)}>
          <Icon className="size-4" strokeWidth={1.75} />
          {label}
        </Button>
      ))}
    </div>
  );
}

/** 结果反馈:就地替换评分条,语义色 + 具体复习日期,~1s 后 onDone(220ms 淡出由 CSS 承担) */
export function ResultFlash({ rating, onDone }: { rating: Rating; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1000);
    const t2 = setTimeout(onDone, 1220);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const card = rate(null, rating, Date.now());
  const dueLabel = formatDate(nextDayStart(card.dueAt) - 24 * 60 * 60 * 1000);
  const map = {
    no: { text: `不会 · ${dueLabel} 复习`, cls: 'bg-destructive/10 text-destructive' },
    fuzzy: { text: `模糊 · ${dueLabel} 复习`, cls: 'bg-warning/12 text-warning' },
    ok: { text: `掌握 · ${dueLabel} 复习`, cls: 'bg-success/12 text-success' },
  }[rating];

  return (
    <div
      data-testid="result-flash"
      className={cn(
        'flex h-11 items-center justify-center rounded-md text-sm font-medium transition-opacity duration-200',
        map.cls,
        leaving && 'opacity-0',
      )}
    >
      {map.text}
    </div>
  );
}

export function ProgressHeader({
  type,
  index,
  total,
  focusMode,
  onToggleFocus,
  onEnd,
}: {
  type: string;
  index: number;
  total: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{type}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${total === 0 ? 0 : ((index + 1) / total) * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
        {Math.min(index + 1, total)} / {total}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleFocus}
        title={focusMode ? '退出专注 (Esc)' : '专注模式 (F)'}
        className="text-muted-foreground"
        data-testid="focus-btn"
      >
        {focusMode ? <Minimize2Icon /> : <Maximize2Icon />} {focusMode ? '退出专注' : '专注'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onEnd}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        data-testid="end-btn"
      >
        结束
      </Button>
    </div>
  );
}

export interface SummaryEntryView {
  title: string;
  final: Rating;
  isRetry: boolean;
}

export function SummaryPanel({
  total,
  mastered,
  weak,
  entries,
  onFinish,
}: {
  total: number;
  mastered: number;
  weak: number;
  entries: SummaryEntryView[];
  onFinish: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-10" data-testid="session-summary">
      <div className="text-center">
        <h2 className="font-display text-2xl">本次小结</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          学习了 <span className="font-medium text-foreground tabular-nums">{total}</span> 道题 · 掌握{' '}
          <span className="font-medium text-success tabular-nums">{mastered}</span> · 偏弱{' '}
          <span className="font-medium text-warning tabular-nums">{weak}</span>
        </p>
      </div>
      <ul className="divide-y divide-border/70 rounded-xl bg-card px-4">
        {entries.map((e) => (
          <li key={e.title} className="flex items-center gap-3 py-3">
            <MarkdownText text={e.title} className="min-w-0 flex-1 truncate [&_p]:my-0" />
            {e.isRetry && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">重练后</span>
            )}
            <span
              className={cn(
                'shrink-0 text-xs font-medium',
                e.final === 'ok' ? 'text-success' : e.final === 'fuzzy' ? 'text-warning' : 'text-destructive',
              )}
            >
              {e.final === 'ok' ? '掌握' : e.final === 'fuzzy' ? '模糊' : '不会'}
            </span>
          </li>
        ))}
      </ul>
      <Button onClick={onFinish} className="mx-auto h-10 px-8">
        完成
      </Button>
    </div>
  );
}
