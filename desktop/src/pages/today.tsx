// 今日(M2):驾驶舱纵排 —— 问候 + 主计划卡(hero,第一件未完成事 = 唯一主 CTA)
// + 复习预测(仅有到期数据时出现)+ 题库概览 + 最近学习记录。零值不渲染;全清走 EmptyState。

import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRightIcon, CheckCheckIcon } from 'lucide-react';

import { PageHeader, EmptyState } from '@/components/biz/states';
import { ActivityList, ForecastBars } from '@/components/biz/forecast-bars';
import { Button } from '@/components/ui/button';
import { startSession } from '@/lib/session';
import { useActivityList, useMyQuestions, useOfficialQuestions, useStatusCounts } from '@/lib/hooks';
import { getMeta, getReviewStates } from '@/lib/storage';
import type { BatchSize } from '@/lib/types';
import { cn } from '@/lib/utils';

export function TodayPage() {
  const navigate = useNavigate();
  const counts = useStatusCounts();
  const official = useOfficialQuestions();
  const my = useMyQuestions();
  const activity = useActivityList();
  const now = Date.now();

  const pool = useMemo(
    () => [...official, ...my.filter((q) => q.status === 'approved')],
    [official, my],
  );
  const batchMeta = getMeta('batch_size');
  const batch: BatchSize = batchMeta === '20' || batchMeta === '50' || batchMeta === 'all' ? batchMeta : '50';
  const studyN = batch === 'all' ? counts.new : Math.min(counts.new, Number(batch));

  const start = (type: 'review' | 'study' | 'again') => {
    startSession({ type, questions: pool, cards: getReviewStates(), batchSize: type === 'study' ? (batch === 'all' ? 'all' : Number(batch)) : 'all' });
    navigate('/session');
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const dateLine = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  const hero = counts.due > 0
    ? { key: 'review', title: `复习 ${counts.due} 题`, desc: '先完成今日到期的复习,新内容随后安排。', cta: '开始复习', onClick: () => start('review') }
    : counts.new > 0
      ? { key: 'study', title: `学习 ${studyN} 题`, desc: '当前没有到期复习,直接开始学习。', cta: '开始学习', onClick: () => start('study') }
      : null;

  const hasForecast = counts.due > 0;

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
                  开始学习 {studyN} 题
                </Button>
              )}
            </div>
          </section>
        ) : (
          <EmptyState
            className="rounded-xl bg-card py-12 shadow-sm"
            icon={<CheckCheckIcon className="size-10" strokeWidth={1.5} />}
            title="今日计划已完成"
            description="没有到期的复习,也没有待学习的题目。想保持手感,可将全部题目再过一遍。"
            action={
              pool.length > 0 && (
                <Button variant="outline" onClick={() => start('again')}>
                  再过一遍
                </Button>
              )
            }
          />
        )}

        {hasForecast && (
          <section className="rounded-xl bg-card p-6 shadow-sm">
            <SectionTitle title="复习预测" desc="未来 7 天,每天到期的题目数量。" />
            <ForecastBars now={now} />
          </section>
        )}

        <section>
          <SectionTitle title="题库概览" />
          <div className="grid grid-cols-4 gap-3">
            <StatTile label="待学习" n={counts.new} onClick={() => navigate('/library?status=new')} />
            <StatTile label="待复习" n={counts.due} onClick={() => navigate('/library?status=due')} />
            <StatTile label="待审核" n={counts.pending} onClick={() => navigate('/review')} accent />
            <StatTile label="已掌握" n={counts.mastered} onClick={() => navigate('/library?status=mastered')} />
          </div>
        </section>

        <section>
          <SectionTitle title="最近学习" />
          <ActivityList days={activity} now={now} />
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
