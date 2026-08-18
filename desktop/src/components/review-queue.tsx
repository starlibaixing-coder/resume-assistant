import { useMemo } from 'react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { MY_CATEGORY_SLUG } from '@/lib/mylib';
import { loadLimit } from '@/lib/prefs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

// 分类队列页:今日数字 + 开始按钮 + 模块入口。
// 每次学习题量是全局偏好,在设置页「刷题」分区配置(此页不再临时选)。

export function ReviewQueue({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const limit = loadLimit();

  const { ids, stats, queue } = useMemo(() => {
    if (!data) return { ids: [] as string[], stats: null, queue: null };
    const ids = data.questions.filter((q) => q.category === category).map((q) => q.id);
    return {
      ids,
      stats: getStats(category, ids),
      queue: getReviewQueue(category, ids, limit),
    };
  }, [data, category, limit]);

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data || !stats || !queue) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;

  const cat = data.categories.find((c) => c.slug === category);
  // 我的库无 approved 题时聚合里没有该分类,给引导空态(而非误导的"今日已清空")
  if (!cat) {
    if (category === MY_CATEGORY_SLUG) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader title="我的题库" />
          <Card>
            <CardContent className="space-y-3 py-16 text-center">
              <div className="text-foreground">我的题库还没有题</div>
              <div className="text-sm text-muted-foreground">AI 生题进草稿区,通过后就会出现在这里。</div>
              <a href="#/generate" className="inline-block text-primary hover:underline text-sm">去生题 →</a>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <div className="text-muted-foreground p-8 text-center">分类不存在: {category}</div>;
  }
  const dueCount = queue.dueIds.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={cat?.name || category} />
        {category === MY_CATEGORY_SLUG && (
          <Button asChild size="sm" className="shrink-0">
            <a href="#/generate">＋ AI 生题</a>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
        <div className="space-y-1 text-center">
          {dueCount > 0 ? (
            <>
              <div className="font-mono text-4xl font-bold text-primary">{dueCount}</div>
              <div className="text-sm text-muted-foreground">题待复习</div>
            </>
          ) : stats.remaining > 0 ? (
            <>
              <div className="font-mono text-4xl font-bold text-primary">{stats.remaining}</div>
              <div className="text-sm text-muted-foreground">题未学习</div>
            </>
          ) : (
            <>
              <div className="text-4xl font-bold text-success">✓</div>
              <div className="text-sm text-muted-foreground">今日已清空,全部学过</div>
            </>
          )}
        </div>

        <div className="text-center text-xs text-muted-foreground font-mono">
          每次学 {limit === 0 ? '全部' : limit} 题(可在设置中调整)
        </div>

        <Button asChild size="lg" className="w-full">
          <a href={`#/${category}/quiz`}>
            开始{dueCount > 0 ? '复习' : stats.remaining > 0 ? '学习' : '再过一遍'} →
          </a>
        </Button>

        <div className="space-y-1.5">
          <Progress value={learnPct} className="h-1.5" />
          <div className="text-xs text-muted-foreground font-mono text-center">
            已学 {stats.learned} / {stats.total} · {learnPct}%
          </div>
        </div>
        </CardContent>
      </Card>

      <div>
        <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-3">模块浏览</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cat?.modules.map((mod) => (
            <a
              key={mod.id}
              href={`#/${category}/browse?m=${mod.id}`}
              className="flex justify-between items-center p-3 bg-card border border-border rounded-md hover:border-primary transition-colors cursor-pointer"
            >
              <div>
                <div className="text-sm text-foreground">{mod.name}</div>
                <div className="text-xs text-muted-foreground font-mono">模块 {String(mod.id).padStart(2, '0')}</div>
              </div>
              <div className="text-xs text-muted-foreground">{mod.count} 题</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
