import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Check, ChevronRight, Inbox } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { loadProgress } from '@/lib/storage';
import type { CardState } from '@/lib/sm2';
import { getProfile } from '@/lib/profile';
import { getJds, subscribeJds } from '@/lib/jd';
import { getRecentActivity, formatActivityTime, type Activity } from '@/lib/activity';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// 今日 v11「驾驶舱」:首屏 = 朱砂 hero 面板(应用替你排程:第一件未完成事 = 唯一主 CTA,
// 右侧大数字仪表)→ 横向计划时间线 → 预测/动态双栏 → 分类进度。
// 与 v4~v10 的「白卡片行列表」彻底换构成;交接逻辑(现在/接下来/零值不出现)沿用 v10。

interface CatEntry {
  slug: string;
  name: string;
  learned: number;
  total: number;
  dueToday: number;
  remaining: number;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

function dateLabel(now: Date): string {
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 周${WEEKDAYS[now.getDay()]}`;
}

interface PlanTask {
  key: 'review' | 'learn' | 'audit' | 'job';
  index: string;
  title: string;
  description: string;
  active: boolean;
  count: number | null;
  to: string;
  cta: string;
}

// hero 右侧仪表 tile:大数字 + 术语,整块可点
function MetricTile({ label, count, to, tone }: {
  label: string;
  count: number;
  to: string;
  tone?: 'dim';
}) {
  return (
    <Link
      to={to}
      className="group flex min-w-24 flex-col items-center rounded-xl border border-primary-foreground/25 px-5 py-3 transition-colors hover:bg-primary-foreground/10"
    >
      <span className={cn('font-display text-4xl font-semibold tabular-nums', tone === 'dim' ? 'text-primary-foreground/60' : 'text-primary-foreground')}>
        {count}
      </span>
      <span className="mt-1 text-xs text-primary-foreground/75">{label}</span>
    </Link>
  );
}

// 横向计划时间线的一步
function PlanStep({ task, state }: { task: PlanTask; state: 'done' | 'current' | 'next' }) {
  return (
    <Link
      to={task.to}
      className={cn(
        'group flex flex-col gap-1.5 rounded-xl bg-card p-4 text-left transition-colors',
        state === 'current' ? 'ring-1 ring-primary' : 'hover:bg-accent/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full font-display text-xs font-semibold tabular-nums',
          state === 'done' ? 'bg-success/15 text-success'
            : state === 'current' ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground',
        )}>
          {state === 'done' ? <Check className="size-3.5" aria-hidden /> : task.index}
        </span>
        <span className={cn('text-sm font-semibold', state === 'done' ? 'text-muted-foreground' : 'text-foreground')}>
          {task.title}
        </span>
        <ChevronRight className={cn('ml-auto size-4 transition-transform group-hover:translate-x-0.5',
          state === 'current' ? 'text-primary' : 'text-muted-foreground/50')} aria-hidden />
      </div>
      <div className="text-xs text-muted-foreground">
        {state === 'done' ? '已完成'
          : task.count != null ? <span className="tabular-nums">{task.count} 道</span>
          : '可完善'}
      </div>
    </Link>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const time = <span className="flex-none text-xs tabular-nums text-muted-foreground">{formatActivityTime(item.time)}</span>;
  const cls = 'flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/60';
  if (item.kind === 'study') {
    return (
      <Link to={`/library?category=${item.categorySlug}`} className={cls}>
        <span className="flex-1">学习了 <b className="font-semibold text-foreground">{item.categoryName}</b> {item.count} 道题{item.masteredCount > 0 && <span className="text-muted-foreground"> · 掌握 {item.masteredCount} 道</span>}</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'generated') {
    return (
      <Link to="/library?tab=review" className={cls}>
        <span className="flex-1">生成了 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题,待审核</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'approved') {
    return (
      <Link to="/library?category=my" className={cls}>
        <span className="flex-1">通过了生成的 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题,已入我的题库</span>
        {time}
      </Link>
    );
  }
  return (
    <Link to="/profile" className={cls}>
      <span className="flex-1">添加了 JD <b className="font-semibold text-foreground">{item.title.trim() || '(未填标题)'}</b>{item.company.trim() && <span className="text-muted-foreground"> · {item.company.trim()}</span>}</span>
      {time}
    </Link>
  );
}

export function TodayPage() {
  const { data, error, retry } = useQuestions();
  const [now, setNow] = useState(() => new Date());
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  useEffect(() => subscribeJds(() => bump((v) => v + 1)), []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();
  const jds = getJds();
  const profile = getProfile();

  const entries = useMemo(() => {
    const all = data?.questions ?? [];
    const official = (data?.categories ?? [])
      .filter((c) => c.slug !== 'my')
      .map((c) => {
        const s = getStats(c.slug, all.filter((q) => q.category === c.slug).map((q) => q.id));
        return { slug: c.slug, name: c.name, learned: s.learned, total: s.total, dueToday: s.dueToday, remaining: s.remaining };
      });
    const myStats = getStats('my', all.filter((q) => q.category === 'my').map((q) => q.id));
    return [
      ...official,
      { slug: 'my', name: myCategory.name, learned: myStats.learned, total: myStats.total, dueToday: myStats.dueToday, remaining: myStats.remaining },
    ];
  }, [data, myCategory]);

  // 深挖调度数据:连续天数 / 今日已练 / 7 天到期预测(全部来自本地 SM-2 进度)
  const studyStats = useMemo(() => {
    const dayStr = (ts: number) => new Date(ts).toDateString();
    const today = new Date();
    const startOfToday = new Date(today).setHours(0, 0, 0, 0);
    const dates = new Set<string>();
    let practicedToday = 0;
    const buckets = [0, 0, 0, 0, 0, 0, 0]; // 今天..6 天后
    for (const e of entries) {
      for (const card of Object.values(loadProgress(e.slug)) as CardState[]) {
        if (card.lastReview) {
          dates.add(dayStr(card.lastReview));
          if (dayStr(card.lastReview) === today.toDateString()) practicedToday += 1;
        }
        const day = Math.floor((card.due - startOfToday) / 86_400_000);
        if (day >= 0 && day < 7) buckets[day] += 1;
      }
    }
    let streak = 0;
    const cursor = new Date();
    if (!dates.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(cursor.toDateString())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { streak, practicedToday, buckets, weekTotal: buckets.reduce((a, b) => a + b, 0) };
  }, [entries]);

  const totalDue = entries.reduce((n, e) => n + e.dueToday, 0);
  const totalRemaining = entries.reduce((n, e) => n + e.remaining, 0);
  const learnedTotal = entries.reduce((n, e) => n + e.learned, 0);
  const learning = entries.filter((e) => e.learned > 0);
  const notStarted = entries.filter((e) => e.learned === 0);
  const activity = useMemo(
    () => getRecentActivity(entries.map((e) => ({ slug: e.slug, name: e.name }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, myCategory, pendingCount, jds],
  );

  // 交接式排程:复习 → 学习新题 → 审核 → 求职材料,第一个未完成项是「现在」
  const jobMissing = !profile?.resume.trim() || jds.length === 0;
  const tasks: PlanTask[] = [
    {
      key: 'review', index: '01', title: '复习', active: totalDue > 0,
      description: '之前学过、今天该再看的题(SM-2 到期)',
      count: totalDue, to: '/session?focus=due', cta: '开始复习',
    },
    {
      key: 'learn', index: '02', title: '学习新题', active: totalRemaining > 0,
      description: '从没学过的题,按分类顺序补位',
      count: totalRemaining, to: '/session?focus=new', cta: '开始学习',
    },
    {
      key: 'audit', index: '03', title: '审核', active: pendingCount > 0,
      description: 'AI 生成的题,人工把关后才进练习队列',
      count: pendingCount, to: '/library?tab=review', cta: '去审核',
    },
    {
      key: 'job', index: '04', title: '求职材料', active: jobMissing,
      description: 'JD 与简历,按 JD 生成深挖题的前提',
      count: null, to: '/profile', cta: jobMissing ? '去完善' : '查看',
    },
  ];
  const currentIndex = tasks.findIndex((t) => t.active);
  const currentTask = currentIndex >= 0 ? tasks[currentIndex] : null;
  const allDone = !currentTask;

  if (!data && !error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  const heroKicker = allDone
    ? '今日 · 全部完成'
    : `现在 · 第 ${currentIndex + 1} / ${tasks.length} 件事`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-7 px-8 py-8">

        {/* 页头:标题 + 日期 + 学习足迹 */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">今日</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {dateLabel(now)} · {learnedTotal > 0 ? `已累计学习 ${learnedTotal} 道题` : '还没有学习记录'}
              {studyStats.streak > 1 && ` · 连续学习 ${studyStats.streak} 天`}
              {studyStats.practicedToday > 0 && ` · 今天已练 ${studyStats.practicedToday} 题`}
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link to="/add">添加题目</Link>
          </Button>
        </div>

        {/* 朱砂 hero:唯一主行动 + 大数字仪表 */}
        <section className="relative overflow-hidden rounded-2xl bg-primary p-8 shadow-lg shadow-primary/25">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary-foreground/10 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.22em] text-primary-foreground/75">{heroKicker}</p>
              <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-primary-foreground">
                {allDone ? '今天的计划做完了' : currentTask!.title}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-primary-foreground/85">
                {allDone ? '休息一下,或者把学过的题再过一遍。' : currentTask!.description}
              </p>
              <Button
                asChild
                className="mt-6 h-12 rounded-xl bg-background px-8 text-base font-semibold text-primary shadow-none hover:bg-background/90"
              >
                <Link to={allDone ? '/session?force=all' : currentTask!.to}>
                  {allDone ? '再过一遍(全部题)' : currentTask!.cta}
                </Link>
              </Button>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <MetricTile label="待复习" count={totalDue} to="/session?focus=due" tone={totalDue === 0 ? 'dim' : undefined} />
              <MetricTile label="待学习" count={totalRemaining} to="/session?focus=new" tone={totalRemaining === 0 ? 'dim' : undefined} />
              <MetricTile label="待审核" count={pendingCount} to="/library?tab=review" tone={pendingCount === 0 ? 'dim' : undefined} />
            </div>
          </div>
          <p className="relative mt-7 text-right text-[11px] text-primary-foreground/60">本地优先 · 数据不上传</p>
        </section>

        {/* 计划时间线:四步横排,当前步高亮 */}
        <section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tasks.map((t) => {
              const idx = tasks.indexOf(t);
              const state = !t.active ? 'done' : idx === currentIndex ? 'current' : 'next';
              return <PlanStep key={t.key} task={t} state={allDone ? 'done' : state} />;
            })}
          </div>
        </section>

        {/* 预测 + 动态 双栏 */}
        <div className="grid gap-6 lg:grid-cols-5">
          {studyStats.weekTotal > 0 && (
            <section className="lg:col-span-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-foreground">复习预测</h2>
                <span className="text-xs tabular-nums text-muted-foreground">未来 7 天 {studyStats.weekTotal} 题</span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2 rounded-xl bg-card p-4">
                {studyStats.buckets.map((n, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const label = i === 0 ? '今天' : i === 1 ? '明天' : `周${'日一二三四五六'[d.getDay()]}`;
                  const max = Math.max(...studyStats.buckets, 1);
                  const isPeak = n > 0 && n === max;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <span className={cn('font-display text-lg font-semibold tabular-nums', isPeak ? 'text-primary' : n > 0 ? 'text-foreground' : 'text-foreground/30')}>{n}</span>
                      <div className="flex h-16 w-full items-end rounded-sm bg-muted" aria-hidden>
                        <div className="w-full rounded-sm bg-primary/70" style={{ height: `${Math.round((n / max) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className={studyStats.weekTotal > 0 ? 'lg:col-span-2' : 'lg:col-span-5'}>
            <h2 className="text-sm font-semibold tracking-wide text-foreground">最近动态</h2>
            {activity.length === 0 ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-card px-4 py-4 text-sm text-muted-foreground">
                <Inbox className="size-4 text-muted-foreground/50" aria-hidden />
                还没有动态。从上面开始第一件事。
              </div>
            ) : (
              <div className="mt-3 rounded-xl bg-card py-1">
                {activity.slice(0, 6).map((item, i) => <ActivityRow key={`${item.kind}-${item.time}-${i}`} item={item} />)}
              </div>
            )}
          </section>
        </div>

        {/* 题库进度:学习中/未开始 */}
        {(learning.length > 0 || notStarted.length > 0) && (
          <div className="grid gap-6 lg:grid-cols-2">
            {learning.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold tracking-wide text-foreground">学习中</h2>
                <div className="mt-3 rounded-xl bg-card py-1">
                  {learning.map((e) => renderCatRow(e))}
                </div>
              </section>
            )}
            {notStarted.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold tracking-wide text-foreground">未开始</h2>
                <div className="mt-3 rounded-xl bg-card py-1">
                  {notStarted.map((e) => renderCatRow(e))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 分类进度行 → 进题库对应分类
function renderCatRow(e: CatEntry) {
  const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
  const empty = e.total === 0;
  return (
    <Link
      key={e.slug}
      to={`/library?category=${e.slug}`}
      className="group flex items-center gap-5 px-3 py-2.5 transition-colors hover:bg-accent/60"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{e.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {empty ? '暂无题目' : `已学 ${e.learned}/${e.total}`}
          {e.dueToday > 0 && <span className="ml-2 font-medium text-warning">待复习 {e.dueToday}</span>}
          {e.remaining > 0 && <span className="ml-2">待学习 {e.remaining}</span>}
          {!empty && e.dueToday === 0 && e.remaining === 0 && <span className="ml-2 font-medium text-success">已清空</span>}
        </div>
      </div>
      {!empty && (
        <div className="hidden w-32 sm:block" aria-hidden>
          <div className="h-0.5 w-full bg-muted">
            <div className="h-0.5 bg-primary/70" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </Link>
  );
}
