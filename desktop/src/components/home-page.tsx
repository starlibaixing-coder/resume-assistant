import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Inbox, ChevronRight } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// 总览(桌面):左栏今日数字 + 快捷操作,右栏分类进度。
// web 版的营销文案留在冻结的 quiz-app;桌面首页回答"我现在该干嘛"。

export function HomePage() {
  const { data } = useQuestions();
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  const { cats, myStats, totalDue, totalRemaining, totalCount } = useMemo(() => {
    const all = data?.questions ?? [];
    const cats = (data?.categories ?? [])
      .filter((c) => c.slug !== 'my')
      .map((c) => ({ cat: c, stats: getStats(c.slug, all.filter((q) => q.category === c.slug).map((q) => q.id)) }));
    const myStats = getStats('my', all.filter((q) => q.category === 'my').map((q) => q.id));
    const totalDue = cats.reduce((n, { stats }) => n + stats.dueToday, 0) + myStats.dueToday;
    const totalRemaining = cats.reduce((n, { stats }) => n + stats.remaining, 0) + myStats.remaining;
    const totalCount = cats.reduce((n, { stats }) => n + stats.total, 0) + myStats.total;
    return { cats, myStats, totalDue, totalRemaining, totalCount };
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">总览</h1>
        <p className="text-sm text-muted-foreground">
          官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── 左栏:今日状态 + 快捷操作 ─────────────────── */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-5">
            <div>
              <div className="text-xs text-muted-foreground">今日待复习</div>
              <div className={`mt-1 font-mono text-4xl font-bold leading-none ${totalDue > 0 ? 'text-warning' : 'text-success'}`}>
                {totalDue}
              </div>
            </div>
            <div className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              共 {totalCount} 题 · 未学 {totalRemaining}
            </div>
          </div>

          <a
            href="#/drafts"
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary cursor-pointer"
          >
            <div>
              <div className="text-xs text-muted-foreground">草稿待审</div>
              <div className={`mt-1 font-mono text-2xl font-bold leading-none ${pendingCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                {pendingCount}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>

          <div className="space-y-2">
            <Button asChild className="w-full">
              <a href="#/generate"><Sparkles className="mr-1.5 h-4 w-4" />AI 生题</a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <a href="#/drafts"><Inbox className="mr-1.5 h-4 w-4" />草稿区</a>
            </Button>
          </div>
        </div>

        {/* ── 右栏:分类进度 ────────────────────────────── */}
        <div className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-2">
          {cats.map(({ cat, stats }) => {
            const pct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
            return (
              <a
                key={cat.slug}
                href={`#/${cat.slug}`}
                className="group flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary cursor-pointer"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold">{cat.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {stats.learned}/{stats.total}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 text-xs">
                    {stats.dueToday > 0 && <span className="text-warning">待复习 {stats.dueToday}</span>}
                    {stats.remaining > 0 && <span className="text-muted-foreground">未学 {stats.remaining}</span>}
                    {stats.remaining === 0 && stats.dueToday === 0 && <span className="text-success">已清空</span>}
                  </div>
                  <span className="flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {stats.dueToday > 0 ? '去复习' : '继续'} <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </a>
            );
          })}

          {/* 我的题库:双库并列(ADR-3),AI 生成 + 官方副本 */}
          <a
            href={myCategory.count > 0 ? '#/my' : '#/generate'}
            className={`group flex flex-col gap-2.5 rounded-lg border p-4 transition-colors cursor-pointer ${
              myCategory.count > 0 ? 'border-border bg-card hover:border-primary' : 'border-dashed border-border bg-card/50 hover:border-primary'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">我的题库</span>
              <span className="font-mono text-xs text-muted-foreground">
                {myStats.learned}/{myStats.total}
              </span>
            </div>
            {myCategory.count > 0 ? (
              <>
                <Progress value={myStats.total ? Math.round((myStats.learned / myStats.total) * 100) : 0} className="h-1.5" />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 text-xs">
                    {myStats.dueToday > 0 && <span className="text-warning">待复习 {myStats.dueToday}</span>}
                    <span className="text-muted-foreground">{myCategory.modules.length} 个批次</span>
                  </div>
                  <span className="flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {myStats.dueToday > 0 ? '去复习' : '继续'} <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">
                还是空的——去 AI 生题,或把官方题复制过来改
                <span className="ml-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">去生题 →</span>
              </div>
            )}
          </a>
        </div>
      </div>
    </div>
  );
}
