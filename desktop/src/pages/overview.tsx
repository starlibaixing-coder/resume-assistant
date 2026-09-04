import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Inbox, Plus } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getStats } from '@/lib/schedule';
import { loadProgress } from '@/lib/storage';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { getProfile } from '@/lib/profile';
import { getJds, subscribeJds } from '@/lib/jd';
import { getRecentActivity, formatActivityTime, type Activity } from '@/lib/activity';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SectionHead } from '@/components/section-head';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

// 总览 v3「桌面工作台」(2026-09-04):紧凑仪表页——页头 + 四格计数条 +
// 细线行列表(学习中/未开始/求职/最近动态)。密度对齐桌面工具,
// 无营销化大字;计数格可点直达。术语按 specs/2026-09-02-terminology.md。

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

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

function dateLabel(now: Date): string {
  return `${now.getMonth() + 1} 月 ${now.getDate()} 日 周${WEEKDAYS[now.getDay()]}`;
}

// 快捷行动的目标分类:候选里挑最近学过的(没学过的按原序靠后),空候选返回 null
function pickCat(list: CatEntry[]): CatEntry | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];
}

// 计数格:label + 数字;to 存在时可点直达
function StatTile({ label, value, to, tone }: {
  label: string;
  value: number;
  to?: string;
  tone?: 'warning' | 'primary';
}) {
  const numColor = tone === 'warning' && value > 0
    ? 'text-warning'
    : tone === 'primary' && value > 0
      ? 'text-primary'
      : value > 0
        ? 'text-foreground'
        : 'text-foreground/35';
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold leading-none tabular-nums ${numColor}`}>{value}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="group flex flex-1 flex-col gap-1 p-4 transition-colors hover:bg-accent/50">
        {body}
        <span className="inline-flex items-center gap-0.5 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
          查看 <ChevronRight className="size-3" aria-hidden />
        </span>
      </Link>
    );
  }
  return <div className="flex flex-1 flex-col gap-1 p-4">{body}</div>;
}

function ActivityRow({ item }: { item: Activity }) {
  const time = <span className="flex-none text-xs tabular-nums text-muted-foreground">{formatActivityTime(item.time)}</span>;
  const cls = 'flex items-center gap-3 border-b border-border py-2 text-sm transition-colors last:border-b-0 hover:bg-accent/40';
  if (item.kind === 'study') {
    return (
      <Link to={`/${item.categorySlug}`} className={cls}>
        <span className="flex-1">学习了 <b className="font-semibold text-foreground">{item.categoryName}</b> {item.count} 道题{item.masteredCount > 0 && <span className="text-muted-foreground"> · 掌握 {item.masteredCount} 道</span>}</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'generated') {
    return (
      <Link to="/drafts" className={cls}>
        <span className="flex-1">生成了 <b className="font-semibold text-foreground">{item.moduleName}</b> {item.count} 道题,待审核</span>
        {time}
      </Link>
    );
  }
  if (item.kind === 'approved') {
    return (
      <Link to="/my" className={cls}>
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

export function OverviewPage() {
  const { data, error, retry } = useQuestions();
  const [now, setNow] = useState(() => new Date());
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  useEffect(() => subscribeJds(() => bump((v) => v + 1)), []);
  // 日期跨天过期,每分钟校准
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
    const withKey = [...official, my].map((e, idx) => ({ entry: e, idx, lastActive: lastActiveOf(e.slug) }));
    withKey.sort((a, b) => b.lastActive - a.lastActive || a.idx - b.idx);
    return withKey.map((x) => x.entry);
  }, [data, myCategory]);

  // 全库已掌握数(getStats 无该口径,走模块级统计聚合)
  const masteredTotal = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const c of data.categories) {
      const ms = getModuleStats(c.slug, data.questions.filter((q) => q.category === c.slug));
      for (const m of Object.values(ms)) n += m.mastered;
    }
    return n;
  }, [data]);

  const totalDue = entries.reduce((n, e) => n + e.dueToday, 0);
  const totalRemaining = entries.reduce((n, e) => n + e.remaining, 0);
  const learnedTotal = entries.reduce((n, e) => n + e.learned, 0);
  const learning = entries.filter((e) => e.learned > 0);
  const notStarted = entries.filter((e) => e.learned === 0);
  const dueCat = pickCat(entries.filter((e) => e.dueToday > 0));
  const newCat = pickCat(entries.filter((e) => e.remaining > 0));
  const activity = useMemo(
    () => getRecentActivity(entries.map((e) => ({ slug: e.slug, name: e.name }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, myCategory, pendingCount, jds],
  );

  if (!data && !error) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="总览" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="总览"
        description={`${dateLabel(now)} · ${learnedTotal > 0 ? `已累计学习 ${learnedTotal} 道题` : '还没有学习记录'}`}
        actions={
          <>
            {dueCat && (
              <Button size="sm" asChild>
                <Link to={`/${dueCat.slug}/quiz?focus=due`}>开始复习 {dueCat.dueToday} 题</Link>
              </Button>
            )}
            {newCat && (
              <Button size="sm" variant="outline" asChild>
                <Link to={`/${newCat.slug}/quiz?focus=new`}>开始学习 {newCat.remaining} 题</Link>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/add">
                <Plus className="size-3.5" aria-hidden />
                添加题目
              </Link>
            </Button>
          </>
        }
      />

      {/* 计数条:四格,待审核可点直达 */}
      <div className="flex divide-x divide-border rounded-md border border-border bg-card">
        <StatTile label="待复习" value={totalDue} tone="warning" />
        <StatTile label="待学习" value={totalRemaining} tone="primary" />
        <StatTile label="待审核" value={pendingCount} tone="warning" to={pendingCount > 0 ? '/drafts' : undefined} />
        <StatTile label="已掌握" value={masteredTotal} />
      </div>

      {learning.length > 0 && (
        <section>
          <SectionHead title="学习中" />
          <div className="mt-1 border-t border-border">
            {learning.map((e) => renderCatRow(e))}
          </div>
        </section>
      )}

      {notStarted.length > 0 && (
        <section>
          <SectionHead title="未开始" />
          <div className="mt-1 border-t border-border">
            {notStarted.map((e) => renderCatRow(e))}
          </div>
        </section>
      )}

      <section>
        <SectionHead title="求职" />
        <div className="mt-1 border-t border-border">
          <Link to="/profile" className="flex items-center gap-3 border-b border-border py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent/40">
            <span className="w-24 flex-none text-muted-foreground">JD</span>
            <span className="flex-1 font-medium">
              {jds.length > 0
                ? <span className="text-foreground">{jds.length} 个 · {jds[0].title.trim() || '(未填标题)'}</span>
                : <span className="text-primary">添加</span>}
            </span>
            <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
          </Link>
          <Link to="/profile?tab=resume" className="flex items-center gap-3 border-b border-border py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent/40">
            <span className="w-24 flex-none text-muted-foreground">简历</span>
            <span className="flex-1 font-medium">
              {profile?.resume.trim()
                ? <span className="text-foreground">{profile.resume.trim().length} 字</span>
                : <span className="text-primary">填写</span>}
            </span>
            <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
          </Link>
        </div>
      </section>

      <section>
        <SectionHead title="最近动态" />
        {activity.length === 0 ? (
          <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            <Inbox className="size-4 text-muted-foreground/50" aria-hidden />
            还没有动态。从「未开始」挑一个分类开始。
          </div>
        ) : (
          <div className="mt-1 border-t border-border">
            {activity.map((item, i) => <ActivityRow key={`${item.kind}-${item.time}-${i}`} item={item} />)}
          </div>
        )}
      </section>
    </div>
  );
}

// 分类行:名称 + 已学/总数 + 待复习/待学习 + 细进度线 + 进入
function renderCatRow(e: CatEntry) {
  const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
  const empty = e.isMy && e.total === 0;
  return (
    <Link
      key={e.slug}
      to={`/${e.slug}`}
      className="group flex items-center gap-5 border-b border-border py-2.5 transition-colors last:border-b-0 hover:bg-accent/40"
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
