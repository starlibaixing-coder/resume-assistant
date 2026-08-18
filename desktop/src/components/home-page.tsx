import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Inbox, ChevronRight } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { loadProgress } from '@/lib/storage';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

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

export function HomePage() {
  const { data } = useQuestions();
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="总览" subtitle="官方题库只读共享,你刷的进度和 AI 生成的题都存在本机。" />

      {/* 行动卡:现在刷什么 */}
      {hero ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
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
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-xl font-bold text-success">全部学完 ✓</div>
            <div className="mt-1 text-sm text-muted-foreground">没有待复习和新题,再过一遍保持记忆。</div>
          </div>
          {entries.find((e) => !e.isMy) && (
            <Button asChild size="lg" variant="outline">
              <a href={`#/${entries.find((e) => !e.isMy)!.slug}/quiz`}>再过一遍</a>
            </Button>
          )}
        </Card>
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

      {/* 快捷操作:生题是核心功能,一级入口 */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href="#/generate"><Sparkles className="mr-1.5 h-4 w-4" />AI 生题</a>
        </Button>
        <Button asChild variant="outline">
          <a href="#/drafts"><Inbox className="mr-1.5 h-4 w-4" />草稿区{pendingCount > 0 ? `(${pendingCount})` : ''}</a>
        </Button>
      </div>

      {/* 分类进度网格:按最近学习排序 */}
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {entries.map((e) => {
          const pct = e.total ? Math.round((e.learned / e.total) * 100) : 0;
          const empty = e.isMy && e.total === 0;
          return (
            <a
              key={e.slug}
              href={empty ? '#/generate' : `#/${e.slug}`}
              className={`group flex flex-col gap-2.5 rounded-lg border p-4 transition-colors cursor-pointer ${
                empty ? 'border-dashed border-border bg-card/50 hover:border-primary' : 'border-border bg-card hover:border-primary'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{e.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {e.learned}/{e.total}
                </span>
              </div>
              {empty ? (
                <div className="text-xs text-muted-foreground">
                  还是空的——去 AI 生题,或把官方题复制过来改
                  <span className="ml-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">去生题 →</span>
                </div>
              ) : (
                <>
                  <Progress value={pct} className="h-1.5" />
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
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
