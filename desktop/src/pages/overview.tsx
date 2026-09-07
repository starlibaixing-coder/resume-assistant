import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Inbox } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { loadProgress } from '@/lib/storage';
import type { CardState } from '@/lib/sm2';
import { getProfile } from '@/lib/profile';
import { getJds, subscribeJds } from '@/lib/jd';
import { getRecentActivity, formatActivityTime, type Activity } from '@/lib/activity';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SectionHead } from '@/components/section-head';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

// 今日(v4「今日驱动」IA + v10 交接式排程):调度决策由应用做好——
// 第一件未完成的事放大为「现在」卡(唯一主 CTA),其余未完成项弱化为「接下来」,
// 已完成项不再出现;全部完成给完成态。分类细节收进题库空间。

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
  countTone?: 'warning' | 'primary';
  to: string;
  cta?: string;
  right?: ReactNode;
}

// 「现在」卡:当前任务的唯一主行动,数字是版面主角
function CurrentTaskCard({ task }: { task: PlanTask }) {
  return (
    <div className="flex items-center gap-5 p-5">
      <span className="w-8 flex-none text-center font-display text-3xl font-semibold tabular-nums text-primary" aria-hidden>
        {task.index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold tracking-widest text-primary">现在</span>
          <span className="text-xs text-muted-foreground/70">先做这件事</span>
        </div>
        <div className="mt-0.5 font-display text-xl font-semibold text-foreground">{task.title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{task.description}</div>
      </div>
      {task.count != null && (
        <span className={`font-display text-5xl font-semibold tabular-nums ${task.countTone === 'warning' ? 'text-warning' : task.countTone === 'primary' ? 'text-primary' : 'text-foreground'}`}>
          {task.count}
        </span>
      )}
      {task.right}
      <Button asChild className="shrink-0">
        <Link to={task.to}>{task.cta}</Link>
      </Button>
    </div>
  );
}

// 「接下来」行:弱化的后续任务,仍可单独进入
function NextTaskRow({ task }: { task: PlanTask }) {
  return (
    <Link
      to={task.to}
      className="group flex items-center gap-4 px-5 py-2.5 transition-colors hover:bg-accent/60"
    >
      <span className="w-8 flex-none text-center font-display text-sm tabular-nums text-muted-foreground/70" aria-hidden>
        {task.index}
      </span>
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">
        {task.title}
        {task.count != null && <span className="ml-2 tabular-nums">{task.count}</span>}
      </div>
      {task.right}
      <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
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
      description: '之前学过、今天到该再看一遍的题(SM-2 到期)',
      count: totalDue, countTone: 'warning', to: '/session?focus=due', cta: '开始复习',
    },
    {
      key: 'learn', index: '02', title: '学习新题', active: totalRemaining > 0,
      description: '从没学过的题,按分类顺序补位',
      count: totalRemaining, countTone: 'primary', to: '/session?focus=new', cta: '开始学习',
    },
    {
      key: 'audit', index: '03', title: '审核', active: pendingCount > 0,
      description: 'AI 生成的题,人工把关后才进练习队列',
      count: pendingCount, countTone: 'warning', to: '/library?tab=review', cta: '去审核',
    },
    {
      key: 'job', index: '04', title: '求职材料', active: jobMissing,
      description: 'JD 与简历,按 JD 生成深挖题的前提',
      count: null, to: '/profile', cta: jobMissing ? '去完善' : '查看',
      right: (
        <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:inline">
          JD {jds.length}{profile?.resume.trim() ? ` · 简历 ${profile.resume.trim().length} 字` : ' · 简历未填'}
        </span>
      ),
    },
  ];
  const currentTask = tasks.find((t) => t.active) ?? null;
  const nextTasks = tasks.filter((t) => t.active && t !== currentTask);
  const allDone = !currentTask;

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="今日" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="今日"
        description={`${dateLabel(now)} · ${learnedTotal > 0 ? `已累计学习 ${learnedTotal} 道题` : '还没有学习记录'}${studyStats.streak > 1 ? ` · 连续学习 ${studyStats.streak} 天` : ''}${studyStats.practicedToday > 0 ? ` · 今天已练 ${studyStats.practicedToday} 题` : ''}`}
        actions={
          <Button variant="secondary" asChild>
            <Link to="/add">添加题目</Link>
          </Button>
        }
      />

      {/* 今天的计划:交接式——「现在」卡是唯一主行动,其余弱化;全部完成给完成态 */}
      <section>
        <SectionHead title="计划" description="应用已按序排好,从第一件事开始;其余项可单独进入。" />
        <div className="mt-2 divide-y divide-border rounded-lg bg-card">
          {allDone ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
              <div className="font-display text-xl font-semibold text-foreground">今天的计划已全部完成</div>
              <p className="text-sm text-muted-foreground">休息一下,或者把学过的题再过一遍。</p>
              <Button variant="secondary" size="sm" asChild className="mt-1">
                <Link to="/session?force=all">再过一遍(全部题)</Link>
              </Button>
            </div>
          ) : (
            <>
              {currentTask && <CurrentTaskCard task={currentTask} />}
              {nextTasks.map((t) => <NextTaskRow key={t.key} task={t} />)}
            </>
          )}
        </div>
      </section>

      {/* 复习预测:SM-2 未来 7 天的到期分布(有数据才出现) */}
      {studyStats.weekTotal > 0 && (
        <section>
          <SectionHead
            title="复习预测"
            description="按每道题的记忆曲线到期时间统计,提前看到负荷。"
            right={<span className="text-xs tabular-nums text-muted-foreground">未来 7 天 {studyStats.weekTotal} 题</span>}
          />
          <div className="mt-3 grid grid-cols-7 gap-2">
            {studyStats.buckets.map((n, i) => {
              const d = new Date();
              d.setDate(d.getDate() + i);
              const label = i === 0 ? '今天' : i === 1 ? '明天' : `周${'日一二三四五六'[d.getDay()]}`;
              const max = Math.max(...studyStats.buckets, 1);
              const isPeak = n > 0 && n === max;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className={`font-display text-xl font-semibold tabular-nums ${isPeak ? 'text-primary' : n > 0 ? 'text-foreground' : 'text-foreground/30'}`}>{n}</span>
                  <div className="flex h-12 w-full items-end rounded-sm bg-muted" aria-hidden>
                    <div className="w-full rounded-sm bg-primary/70" style={{ height: `${Math.round((n / max) * 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 题库进度:学习中/未开始 */}
      {learning.length > 0 && (
        <section>
          <SectionHead title="学习中" />
          <div className="mt-2 rounded-lg bg-card divide-y divide-border">
            {learning.map((e) => renderCatRow(e))}
          </div>
        </section>
      )}
      {notStarted.length > 0 && (
        <section>
          <SectionHead title="未开始" />
          <div className="mt-2 rounded-lg bg-card divide-y divide-border">
            {notStarted.map((e) => renderCatRow(e))}
          </div>
        </section>
      )}

      {/* 最近动态 */}
      <section>
        <SectionHead title="最近动态" />
        {activity.length === 0 ? (
          <div className="mt-1 flex items-center gap-3 rounded-md bg-secondary/60 px-4 py-4 text-sm text-muted-foreground">
            <Inbox className="size-4 text-muted-foreground/50" aria-hidden />
            还没有动态。从上面的「计划」开始第一道题。
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-card divide-y divide-border">
            {activity.map((item, i) => <ActivityRow key={`${item.kind}-${item.time}-${i}`} item={item} />)}
          </div>
        )}
      </section>
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
        <div className="hidden w-36 sm:block" aria-hidden>
          <div className="h-0.5 w-full bg-muted">
            <div className="h-0.5 bg-primary/70" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      <span className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary">
        进入 <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}
