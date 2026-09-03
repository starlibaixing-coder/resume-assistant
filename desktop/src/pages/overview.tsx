import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
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
// 「最近动态」平铺小节,不再套面板框)→ 右侧「快捷入口」单卡(动作 + 求职两行)。
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

function HeroMetric({ label, value, tone, to }: {
  label: string;
  value: number;
  tone?: 'warning';
  to?: string;
}) {
  const inner = (
    <>
      <div className={`text-2xl font-bold tabular-nums ${tone === 'warning' ? 'text-warning' : ''} ${to ? 'underline underline-offset-4' : ''}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="transition-opacity hover:opacity-80">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function ActivityRow({ item }: { item: Activity }) {
  const time = <span className="flex-none text-xs text-muted-foreground">{formatActivityTime(item.time)}</span>;
  if (item.kind === 'study') {
    return (
      <Link to={`/${item.categorySlug}`} className="flex items-center gap-2.5 border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
        <span className="size-1.5 flex-none rounded-full bg-primary" aria-hidden />
        <span className="flex-1">学习了 <b className="font-semibold text-foreground">{item.categoryName}</b> {item.count} 道题{item.masteredCount > 0 && <span className="text-muted-foreground"> · 掌握 {item.masteredCount} 道</span>}</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'generated') {
    return (
      <Link to="/drafts" className="flex items-center gap-2.5 border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
        <span className="size-1.5 flex-none rounded-full bg-primary" aria-hidden />
        <span className="flex-1">生成了 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题，待审核</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'approved') {
    return (
      <Link to="/my" className="flex items-center gap-2.5 border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
        <span className="size-1.5 flex-none rounded-full bg-primary" aria-hidden />
        <span className="flex-1">通过了生成的 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题，已入我的题库</span>
        {time}
      </Link>
    );
  }
  return (
    <Link to="/profile" className="flex items-center gap-2.5 border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
      <span className="size-1.5 flex-none rounded-full bg-primary" aria-hidden />
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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* 问候区 */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex items-center gap-4">
          <div className="flex size-12 flex-none items-center justify-center rounded-full border border-border bg-card text-2xl" aria-hidden>⚡</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{greetingOf(now.getHours())}，祝你离 offer 近一步。</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              今天是 {dateLabel(now)} · {learnedTotal > 0 ? `已累计学习 ${learnedTotal} 道题` : '还没有学习记录'}
            </p>
          </div>
        </div>
        <div className="flex gap-8 text-right">
          <HeroMetric label="待复习" value={totalDue} tone={totalDue > 0 ? 'warning' : undefined} />
          <HeroMetric label="待学习" value={totalRemaining} />
          {pendingCount > 0
            ? <HeroMetric label="待审核" value={pendingCount} tone="warning" to="/drafts" />
            : <HeroMetric label="待审核" value={0} />}
        </div>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 左主栏:平铺小节,分类卡不再套面板框 */}
        <div className="space-y-8">
          {learning.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground">学习中</h2>
              <div className="mt-3 grid content-start gap-4 sm:grid-cols-2">
                {learning.map((e) => renderCatCard(e))}
              </div>
            </section>
          )}

          {notStarted.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-foreground">未开始</h2>
              <div className="mt-3 grid content-start gap-4 sm:grid-cols-2">
                {notStarted.map((e) => renderCatCard(e))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-foreground">最近动态</h2>
            {activity.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">还没有动态。从「未开始」挑一个分类开始，或用快捷入口出题。</p>
            ) : (
              <div className="mt-1">
                {activity.map((item, i) => <ActivityRow key={`${item.kind}-${item.time}-${i}`} item={item} />)}
              </div>
            )}
          </section>
        </div>

        {/* 右侧栏:快捷入口单卡(动作 + 求职两行),求职不再单开面板 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground">快捷入口</h2>
            <div className="mt-4 flex flex-col gap-2.5">
              {dueCat && (
                <Button asChild className="justify-between">
                  <Link to={`/${dueCat.slug}/quiz?focus=due`}>
                    开始复习
                    <span className="text-xs font-normal opacity-75 tabular-nums">{totalDue}</span>
                  </Link>
                </Button>
              )}
              {newCat && (
                <Button asChild variant={dueCat ? 'outline' : 'default'} className="justify-between">
                  <Link to={`/${newCat.slug}/quiz?focus=new`}>
                    开始学习
                    <span className="text-xs font-normal opacity-75 tabular-nums">{totalRemaining}</span>
                  </Link>
                </Button>
              )}
              {pendingCount > 0 && (
                <Button asChild variant="outline" className="justify-between">
                  <Link to="/drafts">
                    去审核
                    <span className="text-xs font-normal opacity-75 tabular-nums">{pendingCount}</span>
                  </Link>
                </Button>
              )}
              <Button asChild variant={dueCat || newCat ? 'outline' : 'default'} className="justify-between">
                <Link to="/add">
                  添加题目
                  <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="mt-5 border-t border-border pt-1">
              <Link to="/profile" className="flex items-center justify-between border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
                <span className="text-muted-foreground">JD</span>
                {jds.length > 0
                  ? <b className="font-semibold">{jds.length} 个 · {jds[0].title.trim() || '(未填标题)'}</b>
                  : <b className="font-semibold text-primary">添加</b>}
              </Link>
              <Link to="/profile?tab=resume" className="flex items-center justify-between border-b border-border/60 py-2.5 text-sm transition-colors last:border-0 hover:bg-accent/50">
                <span className="text-muted-foreground">简历</span>
                {profile?.resume.trim()
                  ? <b className="font-semibold">{profile.resume.trim().length} 字</b>
                  : <b className="font-semibold text-primary">填写</b>}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 分类卡(学习中/未开始两节共用):空我的题库走虚线卡,其余带进度条与状态数字
function renderCatCard(e: CatEntry) {
  const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
  const empty = e.isMy && e.total === 0;
  if (empty) {
    return (
      <Link key={e.slug} to={`/${e.slug}`} className="group cursor-pointer">
        <Card className="h-full border-dashed bg-card/50 transition-colors hover:border-primary">
          <CardContent className="flex h-full flex-col gap-2.5 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{e.name}</span>
              <span className="font-mono text-xs text-muted-foreground">0/0</span>
            </div>
            <div className="text-xs text-muted-foreground">暂无题目</div>
            <span className="mt-auto flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
              进入 <ChevronRight className="h-3 w-3" />
            </span>
          </CardContent>
        </Card>
      </Link>
    );
  }
  return (
    <Link key={e.slug} to={`/${e.slug}`} className="group cursor-pointer">
      <Card className="h-full bg-card transition-colors hover:border-primary">
        <CardContent className="flex h-full flex-col gap-2.5 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-semibold">{e.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {e.learned}/{e.total}
            </span>
          </div>
          <Progress value={pct} className="h-1.5 ring-1 ring-border" />
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-xs">
              {e.dueToday > 0 && <span className="text-warning">待复习 {e.dueToday}</span>}
              {e.remaining > 0 && <span className="text-muted-foreground">待学习 {e.remaining}</span>}
              {e.dueToday === 0 && e.remaining === 0 && <span className="text-success">已清空</span>}
              {e.isMy && <span className="text-muted-foreground">· 我的题库</span>}
            </div>
            <span className="flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
              进入 <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
