import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Inbox, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { loadProgress } from '@/lib/storage';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

// 总览(桌面,行动优先):第一眼回答"现在刷什么"——
// 行动卡(待复习最多/新题最多的分类 + 大按钮),数字行,分类进度网格。
// 分类卡片按「最近学习」降序(该分类所有题最近一次复习时间的最大值),没学过的保持原序靠后。

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

export function OverviewPage() {
  const { data, error, retry } = useQuestions();
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  const { entries, hero } = useMemo(() => {
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
    const entries = withKey.map((x) => x.entry);

    // 行动卡目标:优先"待复习最多",没有则"新题最多",全空则 null(学完态)
    const byDue = [...official, my]
      .filter((e) => e.dueToday > 0)
      .sort((a, b) => b.dueToday - a.dueToday)[0];
    const hero = byDue
      ? { ...byDue, mode: 'due' as const }
      : (() => {
          const byNew = [...official, my].filter((e) => e.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0];
          return byNew ? { ...byNew, mode: 'new' as const } : null;
        })();

    return { entries, hero };
  }, [data, myCategory]);

  const totalDue = entries.reduce((n, e) => n + e.dueToday, 0);
  const totalRemaining = entries.reduce((n, e) => n + e.remaining, 0);
  const totalCount = entries.reduce((n, e) => n + e.total, 0);

  // 题库还没就绪(DB 加载/播种中):骨架屏,不闪"全部学完"假完成态(审计 C4)
  if (!data && !error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="总览" subtitle="官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。" />
        <Skeleton className="h-24 w-full" />
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="总览" subtitle="官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。" />
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="总览" subtitle="官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。" />

      {/* 行动卡:现在刷什么 */}
      {hero ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="font-mono text-xs text-muted-foreground">
                {hero.mode === 'due' ? '现在最该刷' : '开始学新题'}
              </div>
              <div className="mt-1 truncate text-xl font-bold leading-snug">{hero.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {hero.mode === 'due' ? `${hero.dueToday} 题待复习` : `${hero.remaining} 题没学过`}
              </div>
            </div>
            <Button asChild size="lg">
              <Link to={`/${hero.slug}/quiz`}>
                {hero.mode === 'due' ? '继续刷题' : '开始学习'} <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2 text-xl font-bold text-success">
                <CheckCircle2 className="size-5" aria-hidden />
                全部学完
              </div>
              <div className="mt-1 text-sm text-muted-foreground">没有待复习和新题,再过一遍保持记忆。</div>
            </div>
            {(() => {
              // 只跳有题的官方分类(空分类进去也是死胡同)
              const target = entries.find((e) => !e.isMy && e.total > 0);
              return target ? (
                <Button asChild size="lg" variant="outline">
                  <Link to={`/${target.slug}/quiz`}>再过一遍</Link>
                </Button>
              ) : null;
            })()}
          </CardContent>
        </Card>
      )}

      {/* 数字行 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className={totalDue > 0 ? 'text-warning' : 'text-muted-foreground'}>待复习 {totalDue}</span>
        <span className="text-muted-foreground">未学 {totalRemaining} / 共 {totalCount}</span>
        <Link
          to="/drafts"
          className={pendingCount > 0 ? 'text-warning hover:underline' : 'text-muted-foreground hover:text-foreground'}
        >
          草稿待审 {pendingCount}
        </Link>
      </div>

      {/* 快捷操作:生题是核心功能,一级入口 */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/generate"><Sparkles className="mr-1.5 h-4 w-4" />出题</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/drafts"><Inbox className="mr-1.5 h-4 w-4" />待审核{pendingCount > 0 ? `(${pendingCount})` : ''}</Link>
        </Button>
      </div>

      {/* 分类进度网格:按最近学习排序 */}
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {entries.map((e) => {
          const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
          const empty = e.isMy && e.total === 0;
          // 空卡不做整卡链接:承诺与目标一致——常显两个动作按钮直达生题(审计 D/E7)
          if (empty) {
            return (
              <Card key={e.slug} className="h-full border-dashed bg-card/50">
                <CardContent className="flex h-full flex-col gap-2.5 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-base font-semibold">{e.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">0/0</span>
                  </div>
                  <div className="text-xs text-muted-foreground">还是空的——去出题,或手动写一道</div>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm">
                      <Link to="/generate?mode=manual">
                        <Plus className="size-3.5" aria-hidden />
                        手动加题
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/generate">
                        <Sparkles className="size-3.5" aria-hidden />
                        AI 出题
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return (
            <Link key={e.slug} to={`/${e.slug}`} className="group cursor-pointer">
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex h-full flex-col gap-2.5 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{e.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {e.learned}/{e.total}
                </span>
              </div>
                  <>
                  <Progress value={pct} className="h-1.5 ring-1 ring-border" />
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2 text-xs">
                      {e.dueToday > 0 && <span className="text-warning">待复习 {e.dueToday}</span>}
                      {e.remaining > 0 && <span className="text-muted-foreground">未学 {e.remaining}</span>}
                      {e.remaining === 0 && e.dueToday === 0 && <span className="text-success">已清空</span>}
                      {e.isMy && <span className="text-muted-foreground">· {myCategory.modules.length} 个批次</span>}
                    </div>
                    <span className="flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {e.dueToday > 0 ? '去复习' : '继续'} <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </>
              </CardContent>
            </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
