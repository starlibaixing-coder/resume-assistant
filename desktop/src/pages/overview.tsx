import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Bot, BookOpen, CheckCircle2, ChevronRight, CircleDashed, Code2, Inbox,
  Plus, Sparkles, Target, FileText, Zap, type LucideIcon,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { loadProgress } from '@/lib/storage';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { getProfile } from '@/lib/profile';
import { getJds, subscribeJds } from '@/lib/jd';
import { getRecentActivity, formatActivityTime, type Activity } from '@/lib/activity';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

// 总览 = 工作台(2026-09-03,对照 Ant Design Pro Workplace,方案经 HTML mock 确认):
// 问候区(时段问候 + 日期/累计学习 + 右侧三个指标)→ 左主栏(「学习中」「未开始」
// 「最近动态」平铺小节)→ 右侧「快捷入口」单卡(动作 + 求职两行)。
// 视觉:品牌暖色渐变 + 时间线动态 + 悬停微动效,色相全部来自现有 token。
// 术语按 specs/2026-09-02-terminology.md;出题统一走「添加题目」页(/add)。

interface CatEntry {
  slug: string;
  name: string;
  learned: number;
  total: number;
  dueToday: number;
  remaining: number;
  isMy: boolean;
}

// 分类图标与侧栏一致:官方两分类沿用侧栏图标,我的题库=Sparkles
function catIcon(slug: string): LucideIcon {
  if (slug === 'agent') return Bot;
  if (slug === 'fe') return Code2;
  if (slug === 'my') return Sparkles;
  return BookOpen;
}

function lastActiveOf(slug: string): number {
  let max = 0;
  for (const card of Object.values(loadProgress(slug))) {
    if (card.lastReview && card.lastReview > max) max = card.lastReview;
  }
  return max;
}

// 时段问候;深夜给「夜深了」而不是硬凑「早上好」
function greetingOf(h: number): string {
  if (h < 5) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

function dateLabel(now: Date): string {
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 周${WEEKDAYS[now.getDay()]}`;
}

// 快捷入口的目标分类:候选里挑最近学过的(没学过的按原序靠后),空候选返回 null
function pickCat(list: CatEntry[]): CatEntry | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];
}

// 小节标题行:图标章 + 标题 + 延伸 hairline
function SectionHead({ icon: Icon, title, right }: { icon: LucideIcon; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-6 flex-none items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
        <Icon className="size-3.5" />
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <span className="h-px flex-1 bg-border/70" aria-hidden />
      {right}
    </div>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const time = <span className="flex-none text-xs text-muted-foreground">{formatActivityTime(item.time)}</span>;
  const cls = 'group relative flex items-center gap-3 rounded-md py-2 pl-6 pr-2 text-sm transition-colors hover:bg-accent/50';
  const dot = <span className="absolute left-[3px] top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/10" aria-hidden />;
  if (item.kind === 'study') {
    return (
      <Link to={`/${item.categorySlug}`} className={cls}>
        {dot}
        <span className="flex-1">学习了 <b className="font-semibold text-foreground">{item.categoryName}</b> {item.count} 道题{item.masteredCount > 0 && <span className="text-muted-foreground"> · 掌握 {item.masteredCount} 道</span>}</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'generated') {
    return (
      <Link to="/drafts" className={cls}>
        {dot}
        <span className="flex-1">生成了 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题，待审核</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'approved') {
    return (
      <Link to="/my" className={cls}>
        {dot}
        <span className="flex-1">通过了生成的 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题，已入我的题库</span>
        {time}
      </Link>
    );
  }
  return (
    <Link to="/profile" className={cls}>
      {dot}
      <span className="flex-1">添加了 JD <b className="font-semibold text-foreground">{item.title.trim() || '(未填标题)'}</b>{item.company.trim() && <span className="text-muted-foreground"> · {item.company.trim()}</span>}</span>
      {time}
    </Link>
  );
}

export function OverviewPage() {
  const { data, error, retry } = useQuestions();
  const [now, setNow] = useState(() => new Date());
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  useEffect(() => subscribeJds(() => bump((v) => v + 1)), []);
  // 问候与日期在页面存活跨天时会过期,每分钟校准一次
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
    const official: CatEntry[] = (data?.categories ?? [])
      .filter((c) => c.slug !== 'my')
      .map((c) => {
        const s = getStats(c.slug, all.filter((q) => q.category === c.slug).map((q) => q.id));
        return { slug: c.slug, name: c.name, learned: s.learned, total: s.total, dueToday: s.dueToday, remaining: s.remaining, isMy: false };
      });
    const myStats = getStats('my', all.filter((q) => q.category === 'my').map((q) => q.id));
    const my: CatEntry = {
      slug: 'my', name: myCategory.name, learned: myStats.learned, total: myStats.total,
      dueToday: myStats.dueToday, remaining: myStats.remaining, isMy: true,
    };

    // 最近学习降序;从未学习(lastActive=0)保持原序靠后
    const withKey = [...official, my].map((e, idx) => ({ entry: e, idx, lastActive: lastActiveOf(e.slug) }));
    withKey.sort((a, b) => b.lastActive - a.lastActive || a.idx - b.idx);
    return withKey.map((x) => x.entry);
  }, [data, myCategory]);

  const totalDue = entries.reduce((n, e) => n + e.dueToday, 0);
  const totalRemaining = entries.reduce((n, e) => n + e.remaining, 0);
  const learnedTotal = entries.reduce((n, e) => n + e.learned, 0);
  // 「学习中」= 有学习记录的分类;从未学过的(含空我的题库)归「未开始」,不冒充学习进度
  const learning = entries.filter((e) => e.learned > 0);
  const notStarted = entries.filter((e) => e.learned === 0);
  const dueCat = pickCat(entries.filter((e) => e.dueToday > 0));
  const newCat = pickCat(entries.filter((e) => e.remaining > 0));
  const activity = useMemo(
    () => getRecentActivity(entries.map((e) => ({ slug: e.slug, name: e.name }))),
    // entries 引用变化即重算;订阅已保证数据变化触发渲染
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, myCategory, pendingCount, jds],
  );

  // 题库还没就绪(DB 加载/播种中):骨架屏,不闪"全部学完"假完成态
  if (!data && !error) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader title="总览" />
        <div className="flex gap-5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeader title="总览" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="text-foreground">题库加载失败</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button size="sm" variant="outline" onClick={retry}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const quickBtn = 'group w-full justify-between';

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* 问候区:品牌暖光氛围 + 大字问候 + 右侧三指标 */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card px-6 py-6">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-20 -bottom-28 size-64 rounded-full bg-warning/5 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
          <div className="flex items-center gap-4">
            <div className="flex size-12 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-primary to-warning text-primary-foreground shadow-lg shadow-primary/20" aria-hidden>
              <Zap className="size-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">{dateLabel(now)}</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">
                {greetingOf(now.getHours())}，<span className="bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">祝你离 offer 近一步。</span>
              </h1>
            </div>
          </div>
          <div className="flex text-right">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">待复习</div>
              <div className={`mt-1.5 text-3xl font-bold leading-none tabular-nums ${totalDue > 0 ? 'text-warning' : 'text-foreground/40'}`}>{totalDue}</div>
            </div>
            <div className="ml-8 border-l border-border pl-8 text-right">
              <div className="text-xs text-muted-foreground">待学习</div>
              <div className="mt-1.5 text-3xl font-bold leading-none tabular-nums">{totalRemaining}</div>
            </div>
            <div className="ml-8 border-l border-border pl-8 text-right">
              <div className="text-xs text-muted-foreground">待审核</div>
              {pendingCount > 0 ? (
                <Link to="/drafts" className="mt-1.5 inline-flex items-center gap-0.5 text-3xl font-bold leading-none tabular-nums text-warning transition-opacity hover:opacity-80">
                  {pendingCount}
                  <ChevronRight className="size-5" aria-hidden />
                </Link>
              ) : (
                <div className="mt-1.5 text-3xl font-bold leading-none tabular-nums text-foreground/40">{pendingCount}</div>
              )}
            </div>
          </div>
        </div>
        {learnedTotal > 0 && (
          <div className="relative mt-4 text-xs text-muted-foreground">已累计学习 {learnedTotal} 道题</div>
        )}
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 左主栏:平铺小节 */}
        <div className="space-y-10">
          {learning.length > 0 && (
            <section>
              <SectionHead icon={BookOpen} title="学习中" />
              <div className="mt-4 grid content-start gap-4 sm:grid-cols-2">
                {learning.map((e) => renderCatCard(e))}
              </div>
            </section>
          )}

          {notStarted.length > 0 && (
            <section>
              <SectionHead icon={CircleDashed} title="未开始" />
              <div className="mt-4 grid content-start gap-4 sm:grid-cols-2">
                {notStarted.map((e) => renderCatCard(e))}
              </div>
            </section>
          )}

          <section>
            <SectionHead icon={Inbox} title="最近动态" />
            {activity.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                <Inbox className="size-5 text-muted-foreground/50" aria-hidden />
                还没有动态。从「未开始」挑一个分类开始，或用快捷入口出题。
              </div>
            ) : (
              <div className="relative mt-2 before:absolute before:bottom-2 before:left-[6.5px] before:top-2 before:w-px before:bg-border/70" >
                {activity.map((item, i) => <ActivityRow key={`${item.kind}-${item.time}-${i}`} item={item} />)}
              </div>
            )}
          </section>
        </div>

        {/* 右侧栏:快捷入口单卡(动作 + 求职两行) */}
        <Card className="lg:sticky lg:top-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground">快捷入口</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {dueCat && (
                <Button asChild className={`${quickBtn} shadow-sm`}>
                  <Link to={`/${dueCat.slug}/quiz?focus=due`}>
                    <span className="flex items-center gap-2">
                      <BookOpen className="size-4" aria-hidden />
                      开始复习
                    </span>
                    <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-semibold tabular-nums">{totalDue}</span>
                  </Link>
                </Button>
              )}
              {newCat && (
                <Button asChild variant={dueCat ? 'outline' : 'default'} className={quickBtn}>
                  <Link to={`/${newCat.slug}/quiz?focus=new`}>
                    <span className="flex items-center gap-2">
                      <Sparkles className="size-4" aria-hidden />
                      开始学习
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{totalRemaining}</span>
                  </Link>
                </Button>
              )}
              {pendingCount > 0 && (
                <Button asChild variant="outline" className={quickBtn}>
                  <Link to="/drafts">
                    <span className="flex items-center gap-2">
                      <Inbox className="size-4" aria-hidden />
                      去审核
                    </span>
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning">{pendingCount}</span>
                  </Link>
                </Button>
              )}
              <Button asChild variant={dueCat || newCat ? 'outline' : 'default'} className={quickBtn}>
                <Link to="/add">
                  <span className="flex items-center gap-2">
                    <Plus className="size-4" aria-hidden />
                    添加题目
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-60 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <Link to="/profile" className="group/row flex items-center justify-between rounded-md px-1 py-2 text-sm transition-colors hover:bg-accent/50">
                <span className="flex items-center gap-2.5 text-muted-foreground">
                  <Target className="size-4 text-muted-foreground/70" aria-hidden />
                  JD
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  {jds.length > 0
                    ? <span className="text-foreground">{jds.length} 个 · {jds[0].title.trim() || '(未填标题)'}</span>
                    : <span className="text-primary">添加</span>}
                  <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover/row:translate-x-0.5" aria-hidden />
                </span>
              </Link>
              <Link to="/profile?tab=resume" className="group/row flex items-center justify-between rounded-md px-1 py-2 text-sm transition-colors hover:bg-accent/50">
                <span className="flex items-center gap-2.5 text-muted-foreground">
                  <FileText className="size-4 text-muted-foreground/70" aria-hidden />
                  简历
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  {profile?.resume.trim()
                    ? <span className="text-foreground">{profile.resume.trim().length} 字</span>
                    : <span className="text-primary">填写</span>}
                  <ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform duration-200 group-hover/row:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 分类卡(学习中/未开始两节共用):图标章 + 渐变进度条 + 状态 chip,悬停浮起
function renderCatCard(e: CatEntry) {
  const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
  const empty = e.isMy && e.total === 0;
  const Icon = catIcon(e.slug);
  if (empty) {
    return (
      <Link key={e.slug} to={`/${e.slug}`} className="group cursor-pointer">
        <Card className="h-full border-dashed bg-transparent transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
                  <Icon className="size-3.5" />
                </span>
                <span className="text-base font-semibold">{e.name}</span>
              </span>
              <span className="font-mono text-xs text-muted-foreground">0/0</span>
            </div>
            <div className="text-xs text-muted-foreground">暂无题目</div>
            <span className="mt-auto flex items-center gap-0.5 text-xs text-primary opacity-0 transition-all duration-200 group-hover:opacity-100">
              进入 <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </CardContent>
        </Card>
      </Link>
    );
  }
  return (
    <Link key={e.slug} to={`/${e.slug}`} className="group cursor-pointer">
      <Card className="h-full bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
                <Icon className="size-3.5" />
              </span>
              <span className="text-base font-semibold">{e.name}</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {e.learned}/{e.total}
            </span>
          </div>
          <Progress value={pct} className="h-1.5 bg-border/40 ring-0 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-warning" />
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              {e.dueToday > 0 && (
                <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning">待复习 {e.dueToday}</span>
              )}
              {e.remaining > 0 && <span className="text-muted-foreground">待学习 {e.remaining}</span>}
              {e.dueToday === 0 && e.remaining === 0 && (
                <span className="flex items-center gap-1 font-medium text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  已清空
                </span>
              )}
            </div>
            <span className="flex items-center gap-0.5 text-xs text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
              进入 <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
