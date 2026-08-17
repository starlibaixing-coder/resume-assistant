import { useEffect, useMemo, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// 总览(桌面,行动优先):第一眼回答"现在刷什么"——
// 最上面一张行动卡(待复习最多/新题最多的分类 + 大按钮),下面数字行 + 分类网格。
// web 版的营销文案留在冻结的 quiz-app。

interface HeroTarget {
  slug: string;
  name: string;
  dueToday: number;
  remaining: number;
  mode: 'due' | 'new';
}

const MY_NAME = '我的题库';

export function HomePage() {
  const { data } = useQuestions();
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  const { cats, myStats, totalDue, totalRemaining, totalCount, hero } = useMemo(() => {
    const all = data?.questions ?? [];
    const cats = (data?.categories ?? [])
      .filter((c) => c.slug !== 'my')
      .map((c) => ({ cat: c, stats: getStats(c.slug, all.filter((q) => q.category === c.slug).map((q) => q.id)) }));
    const myStats = getStats('my', all.filter((q) => q.category === 'my').map((q) => q.id));
    const totalDue = cats.reduce((n, { stats }) => n + stats.dueToday, 0) + myStats.dueToday;
    const totalRemaining = cats.reduce((n, { stats }) => n + stats.remaining, 0) + myStats.remaining;
    const totalCount = cats.reduce((n, { stats }) => n + stats.total, 0) + myStats.total;

    // 行动卡目标:优先"待复习最多"的分类,没有则"新题最多"的,全空则 null(学完态)
    const entries: Array<{ slug: string; name: string; dueToday: number; remaining: number }> = [
      ...cats.map(({ cat, stats }) => ({ slug: cat.slug, name: cat.name, dueToday: stats.dueToday, remaining: stats.remaining })),
      { slug: 'my', name: MY_NAME, dueToday: myStats.dueToday, remaining: myStats.remaining },
    ];
    const byDue = entries.filter((e) => e.dueToday > 0).sort((a, b) => b.dueToday - a.dueToday)[0];
    const hero: HeroTarget | null = byDue
      ? { ...byDue, mode: 'due' }
      : (() => {
          const byNew = entries.filter((e) => e.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0];
          return byNew ? { ...byNew, mode: 'new' } : null;
        })();

    return { cats, myStats, totalDue, totalRemaining, totalCount, hero };
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">总览</h1>
        <p className="text-sm text-muted-foreground">
          官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。
        </p>
      </header>

      {/* 行动卡:现在刷什么 */}
      {hero ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-6">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">
              {hero.mode === 'due' ? '现在最该刷' : '开始学新题'}
            </div>
            <div className="mt-1 truncate text-xl font-bold">{hero.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {hero.mode === 'due' ? `${hero.dueToday} 题待复习` : `${hero.remaining} 题没学过`}
            </div>
          </div>
          <Button asChild size="lg">
            <a href={`#/${hero.slug}/quiz`}>
              {hero.mode === 'due' ? '继续刷题' : '开始学习'} <ChevronRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-6">
          <div>
            <div className="text-xl font-bold text-success">全部学完 ✓</div>
            <div className="mt-1 text-sm text-muted-foreground">没有待复习和新题,再过一遍保持记忆。</div>
          </div>
          {cats[0] && (
            <Button asChild size="lg" variant="outline">
              <a href={`#/${cats[0].cat.slug}/quiz`}>再过一遍</a>
            </Button>
          )}
        </div>
      )}

      {/* 数字行 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className={totalDue > 0 ? 'text-warning' : 'text-muted-foreground'}>待复习 {totalDue}</span>
        <span className="text-muted-foreground">未学 {totalRemaining} / 共 {totalCount}</span>
        <a
          href="#/drafts"
          className={pendingCount > 0 ? 'text-warning hover:underline' : 'text-muted-foreground hover:text-foreground'}
        >
          草稿待审 {pendingCount}
        </a>
      </div>

      {/* 分类进度网格 */}
      <div className="grid content-start gap-3 sm:grid-cols-2">
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

        {/* AI 生题空位入口 */}
        <a
          href="#/generate"
          className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary cursor-pointer"
        >
          <Sparkles className="h-5 w-5" />
          <span className="text-sm">AI 生题</span>
        </a>
      </div>
    </div>
  );
}
