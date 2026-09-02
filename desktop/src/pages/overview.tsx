import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { loadProgress } from '@/lib/storage';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';

// 总览(2026-09-02 按两大块重排;同日两轮瘦身):只服务刷题——数字行只放刷题侧的
// 工作量与审核状态(可点规则统一——仅待审核 >0 时是链接,落点 /drafts),
// 【题库】分类网格(空态卡与非空卡同一模式:整卡可点 + hover「进入」)。
// 求职区已删(用户指示:总览的求职卡没用,导航归侧栏,状态等阶段 3 再说)。
// 不再做"行动卡"替用户选入口——两种刷法(复习/学新题)在分类页里自己选。
// 分类卡片按「最近学习」降序;没学过的保持原序靠后。

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
  const allCleared = entries.length > 0 && entries.every((e) => e.dueToday === 0 && e.remaining === 0);

  // 题库还没就绪(DB 加载/播种中):骨架屏,不闪"全部学完"假完成态
  if (!data && !error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
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
      <div className="mx-auto max-w-5xl space-y-6">
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="总览" />

      {/* 数字行:刷题侧今日工作量 + 审核状态。可点规则统一:默认全为纯文本,
          仅待审核 >0 时渲染为链接(下划线,落点 /drafts);待复习/待学习无全局落点
          (quiz 按分类路由),保持纯文本,不用链接样式伪装可点 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className={totalDue > 0 ? 'text-warning' : 'text-muted-foreground'}>待复习 {totalDue}</span>
        <span className="text-muted-foreground">待学习 {totalRemaining}</span>
        {pendingCount > 0 ? (
          <Link to="/drafts" className="text-warning underline underline-offset-2 transition-opacity hover:opacity-80">
            待审核 {pendingCount}
          </Link>
        ) : (
          <span className="text-muted-foreground">待审核 0</span>
        )}
      </div>
      {allCleared && (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          全部学完,没有到期待复习的题——保持节奏,过几天再来。
        </div>
      )}

      {/* 题库:分类进度网格,点卡片进分类页选刷法 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">题库</h2>
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {entries.map((e) => {
            const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
            const empty = e.isMy && e.total === 0;
            if (empty) {
              // 空的我的题库:与非空卡同一模式(整卡可点 + hover「进入」),文案中性
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
                <Card className="h-full transition-colors hover:border-primary">
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
                        {e.isMy && <span className="text-muted-foreground">· {myCategory.modules.length} 个模块</span>}
                      </div>
                      <span className="flex items-center text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        进入 <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
