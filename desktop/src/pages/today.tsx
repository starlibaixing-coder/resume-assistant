// 今日(M2):驾驶舱纵排 —— 问候 + 主计划卡(hero,第一件未完成事 = 唯一主 CTA)
// + 复习预测(仅有到期数据时出现)+ 题库概览 + 最近学习记录。零值不渲染;全清走 EmptyState。

import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightIcon, CheckCheckIcon } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/biz/states';
import { ActivityList } from '@/components/biz/activity-list';
import { Button } from '@/components/ui/button';
import { startSession } from '@/lib/session';
import { useMyQuestions, useOfficialQuestions, useStatusCounts } from '@/lib/hooks';
import { getMeta, getReviewStates } from '@/lib/storage';
import type { BatchSize, Question } from '@/lib/types';
import { cn } from '@/lib/utils';

export function TodayPage() {
  const navigate = useNavigate();
  const counts = useStatusCounts();
  const official = useOfficialQuestions();
  const my = useMyQuestions();
  const now = Date.now();

  const pool = useMemo(
    () => [...official, ...my.filter((q) => q.status === 'approved')],
    [official, my],
  );

  const dueList = useMemo(
    () =>
      pool
        .filter((q) => q.status === 'approved' && (getReviewStates().get(q.id)?.dueAt ?? Infinity) <= now)
        .sort((a, b) => (getReviewStates().get(a.id)?.dueAt ?? 0) - (getReviewStates().get(b.id)?.dueAt ?? 0)),
    [pool, now],
  );

  const batchMeta = getMeta('batch_size');
  const batch: BatchSize = batchMeta === '20' || batchMeta === '50' || batchMeta === 'all' ? batchMeta : '50';
  const studyN = batch === 'all' ? counts.new : Math.min(counts.new, Number(batch));

  const practiceSingle = (id: string) => {
    const q = pool.find((x) => x.id === id);
    if (!q) return;
    startSession({ type: 'single', questions: pool, cards: getReviewStates(), batchSize: 'all', singleQid: id });
    navigate('/session');
  };

  const start = (type: 'review' | 'study' | 'again') => {
    startSession({ type, questions: pool, cards: getReviewStates(), batchSize: type === 'study' ? (batch === 'all' ? 'all' : Number(batch)) : 'all' });
    navigate('/session');
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const dateLine = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  const hero = counts.due > 0
    ? { key: 'review', title: `复习 ${counts.due} 题`, desc: '尚未掌握、需要再次复习的题目。', cta: '复习', onClick: () => start('review') }
    : counts.new > 0
      ? { key: 'study', title: `学习 ${studyN} 题`, desc: '当前没有到期的复习,先学一批新题。', cta: '学习', onClick: () => start('study') }
      : null;

  return (
    <div className="h-full overflow-y-auto" data-testid="today-page">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-10">
        <PageHeader title={`${greeting}`} description={dateLine} />

        {hero ? (
          <section
            data-testid={`plan-${hero.key}`}
            className="rounded-xl bg-card p-8 shadow-sm shadow-black/5 ring-1 ring-primary/15"
          >
            <div className="text-xs font-medium tracking-wide text-primary">现在</div>
            <h2 className="mt-2 font-display text-3xl">{hero.title}</h2>
            <p className="mt-2 max-w-[38rem] text-sm text-muted-foreground">{hero.desc}</p>
            <div className="mt-6 flex items-center gap-3">
              <Button size="lg" onClick={hero.onClick} className="px-8">
                {hero.cta} <ArrowRightIcon />
              </Button>
              {counts.due > 0 && counts.new > 0 && (
                <Button size="lg" variant="ghost" onClick={() => start('study')}>
                  学习 {studyN} 题
                </Button>
              )}
            </div>
            {hero.key === 'review' && <DueList due={dueList} total={counts.due} onPractice={practiceSingle} />}
          </section>
        ) : (
          <EmptyState
            className="rounded-xl bg-card py-12 shadow-sm"
            icon={<CheckCheckIcon className="size-10" strokeWidth={1.5} />}
            title="今日计划已完成"
            description="今天没有要复习的,也没有要学的新内容。"
            action={
              pool.length > 0 && (
                <Button variant="outline" onClick={() => start('again')}>
                  学习全部题目
                </Button>
              )
            }
          />
        )}

        <section>
          <SectionTitle title="题库概览" />
          <div className="grid grid-cols-4 gap-3">
            <StatTile label="待学习" n={counts.new} onClick={() => navigate('/library?cat=all&status=new')} />
            <StatTile label="待复习" n={counts.due} onClick={() => navigate('/library?cat=all&status=due')} />
            <StatTile label="待审核" n={counts.pending} onClick={() => navigate('/review')} accent />
            <StatTile label="已掌握" n={counts.mastered} onClick={() => navigate('/library?cat=all&status=mastered')} />
          </div>
        </section>

        <section>
          <SectionTitle title="最近学习" />
          <ActivityList now={now} onPractice={practiceSingle} />
        </section>
      </div>

    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
    </div>
  );
}

function StatTile({ label, n, onClick, accent }: { label: string; n: number; onClick: () => void; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl bg-card p-4 text-left shadow-sm transition-shadow duration-200 hover:shadow-md',
        n === 0 && 'opacity-60',
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-display text-2xl tabular-nums', accent && n > 0 && 'text-warning')}>
        {n}
      </div>
    </button>
  );
}

/** 到期题明细:回答「是哪些题」;点击在本页打开详情抽屉 */
function DueList({ due, total, onPractice }: { due: Question[]; total: number; onPractice: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <ul className="mt-5 divide-y divide-border/60 border-t border-border/60 pt-1" data-testid="due-list">
      {due.slice(0, 5).map((q) => (
        <li key={q.id}>
          <button
            type="button"
            onClick={() => onPractice(q.id)}
            className="flex w-full cursor-pointer items-center gap-3 py-2 text-left transition-colors duration-150 hover:text-primary"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{q.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground/70">{q.moduleName}</span>
          </button>
        </li>
      ))}
      {total > due.length && (
        <li>
          <button
            type="button"
            onClick={() => navigate('/library?cat=all&status=due')}
            className="cursor-pointer py-2 text-sm text-primary"
          >
            查看全部 {total} 道
          </button>
        </li>
      )}
    </ul>
  );
}
