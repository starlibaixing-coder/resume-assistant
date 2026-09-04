import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Inbox } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { getProfile } from '@/lib/profile';
import { getJds, subscribeJds } from '@/lib/jd';
import { getRecentActivity, formatActivityTime, type Activity } from '@/lib/activity';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SectionHead } from '@/components/section-head';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

// 今日(v4「今日驱动」IA):产品主入口不再是分类,而是"今天的计划"——
// 复习 → 新学 → 审核 → 材料,四条计划行 + 唯一主 CTA「开始练习」
// (跨全库混排会话)。调度决策由应用做好;分类细节收进题库空间。

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

// 计划行:步骤序号 + 名称/说明 + 右侧数量;整行可点;零值灰显但仍可见
function PlanRow({ index, title, description, count, countTone, to, right }: {
  index: string;
  title: string;
  description: string;
  count: number | null;
  countTone?: 'warning' | 'primary';
  to: string;
  right?: ReactNode;
}) {
  const zero = count === 0;
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 border-b border-border py-3 transition-colors last:border-b-0 hover:bg-accent/40 ${zero ? 'opacity-60' : ''}`}
    >
      <span className="w-5 flex-none text-center font-mono text-xs tabular-nums text-muted-foreground" aria-hidden>
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${zero ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      {count != null && (
        <span className={`text-lg font-semibold tabular-nums ${countTone === 'warning' && count > 0 ? 'text-warning' : countTone === 'primary' && count > 0 ? 'text-primary' : 'text-foreground/35'}`}>
          {count}
        </span>
      )}
      {right}
      <ChevronRight className={`size-4 transition-transform group-hover:translate-x-0.5 ${zero ? 'text-muted-foreground/50' : 'text-primary'}`} aria-hidden />
    </Link>
  );
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
        description={`${dateLabel(now)} · ${learnedTotal > 0 ? `已累计学习 ${learnedTotal} 道题` : '还没有学习记录'}`}
        actions={
          <>
            <Button asChild>
              <Link to="/session">开始练习</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/add">添加题目</Link>
            </Button>
          </>
        }
      />

      {/* 今天的计划:调度决策由应用做好,用户按序执行 */}
      <section>
        <SectionHead title="计划" description="按序执行即可;每项也可单独进入。" />
        <div className="mt-1 border-t border-border">
          <PlanRow
            index="01"
            title="复习"
            description="之前学过、今天到该再看一遍的题(SM-2 到期)"
            count={totalDue}
            countTone="warning"
            to="/session?focus=due"
          />
          <PlanRow
            index="02"
            title="学习新题"
            description="从没学过的题,按分类顺序补位"
            count={totalRemaining}
            countTone="primary"
            to="/session?focus=new"
          />
          <PlanRow
            index="03"
            title="审核"
            description="AI 生成的题,人工把关后才进练习队列"
            count={pendingCount}
            countTone="warning"
            to="/library?tab=review"
          />
          <PlanRow
            index="04"
            title="求职材料"
            description="JD 与简历,按 JD 生成深挖题的前提"
            count={null}
            to="/profile"
            right={
              profile?.resume.trim() || jds.length > 0 ? (
                <span className="text-sm font-medium tabular-nums text-foreground">
                  JD {jds.length} · 简历 {profile?.resume.trim() ? `${profile.resume.trim().length} 字` : '未填'}
                </span>
              ) : (
                <span className="text-sm font-medium text-primary">填写</span>
              )
            }
          />
        </div>
      </section>

      {/* 题库进度:学习中/未开始 */}
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

      {/* 最近动态 */}
      <section>
        <SectionHead title="最近动态" />
        {activity.length === 0 ? (
          <div className="mt-1 flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
            <Inbox className="size-4 text-muted-foreground/50" aria-hidden />
            还没有动态。点右上角「开始练习」学第一道题。
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

// 分类进度行 → 进题库对应分类
function renderCatRow(e: CatEntry) {
  const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
  const empty = e.total === 0;
  return (
    <Link
      key={e.slug}
      to={`/library?category=${e.slug}`}
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
