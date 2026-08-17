import { useMemo, useState } from 'react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { MY_CATEGORY_SLUG } from '@/lib/mylib';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

const LIMIT_OPTIONS = [20, 50, 100, 0] as const;

export function ReviewQueue({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [limit, setLimit] = useState<number>(50);

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
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">●</span> 我的题库
          </h1>
          <div className="text-center py-16 space-y-3 rounded-lg border border-border bg-card">
            <div className="text-foreground">我的题库还没有题</div>
            <div className="text-sm text-muted-foreground">AI 生题进草稿区,通过后就会出现在这里。</div>
            <a href="#/generate" className="inline-block text-primary hover:underline text-sm">去生题 →</a>
          </div>
        </div>
      );
    }
    return <div className="text-muted-foreground p-8 text-center">分类不存在: {category}</div>;
  }
  const dueCount = queue.dueIds.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">
        <span className="text-primary">●</span> {cat?.name || category}
      </h1>

      <Card className="p-6 space-y-4">
        <div className="text-center space-y-1">
          {dueCount > 0 ? (
            <>
              <div className="text-4xl font-bold text-primary font-mono">{dueCount}</div>
              <div className="text-sm text-muted-foreground">题待复习</div>
            </>
          ) : stats.remaining > 0 ? (
            <>
              <div className="text-4xl font-bold text-primary font-mono">{stats.remaining}</div>
              <div className="text-sm text-muted-foreground">题未学习</div>
            </>
          ) : (
            <>
              <div className="text-4xl font-bold text-success">✓</div>
              <div className="text-sm text-muted-foreground">今日已清空,全部学过</div>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">每次</span>
          {LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                limit === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
              onClick={() => setLimit(opt)}
            >
              {opt === 0 ? '全部' : opt}
            </button>
          ))}
          <span className="text-muted-foreground">题</span>
        </div>

        <Button asChild size="lg" className="w-full">
          <a href={`#/${category}/quiz${limit !== 50 ? `?limit=${limit}` : ''}`}>
            开始{dueCount > 0 ? '复习' : stats.remaining > 0 ? '学习' : '再过一遍'} →
          </a>
        </Button>

        <div className="space-y-1.5">
          <Progress value={learnPct} className="h-1.5" />
          <div className="text-xs text-muted-foreground font-mono text-center">
            已学 {stats.learned} / {stats.total} · {learnPct}%
          </div>
        </div>
      </Card>

      <div>
        <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground mb-3">模块浏览</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cat?.modules.map((mod) => (
            <a
              key={mod.id}
              href={`#/${category}/browse?m=${mod.id}`}
              className="flex justify-between items-center p-3 bg-card border border-border rounded-md hover:border-primary transition-colors"
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

