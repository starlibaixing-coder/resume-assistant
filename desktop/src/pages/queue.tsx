import { useMemo } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ChevronRight, LibraryBig, Plus } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { MY_CATEGORY_SLUG } from '@/lib/mylib';
import { loadLimit } from '@/lib/prefs';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

// 题库分类页 v2「纸面编辑部」:巨号分类题名 + 双巨号数字(待复习/待学习)对开排 +
// 墨色主行动 + 模块细线目录。去卡片化。两种学法分开选,不替用户做主;
// "是哪些题"深链到题目列表状态筛选;出题入口 = 「添加题目」页(/add)。

export function QueuePage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  const limit = loadLimit();

  const { stats, review } = useMemo(() => {
    if (!data) return { stats: null, review: null };
    const ids = data.questions.filter((q) => q.category === category).map((q) => q.id);
    return {
      stats: getStats(category, ids),
      review: getReviewQueue(category, ids, limit),
    };
  }, [data, category, limit]);

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="题库" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }
  if (!data || !stats || !review) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const cat = data.categories.find((c) => c.slug === category);
  const isMy = category === MY_CATEGORY_SLUG;
  // 我的库无 approved 题时聚合里没有该分类,给引导空态(而非误导的"已清空")
  if (!cat) {
    if (isMy) {
      return (
        <div className="space-y-8">
          <PageHeader title="我的题库" />
          <EmptyState
            icon={LibraryBig}
            title="我的题库还没有题"
            description="手动添加直接入库;AI 生成的题通过审核后出现在这里。"
            action={
              <Button size="sm" asChild>
                <Link to="/add">
                  <Plus className="size-3.5" aria-hidden />
                  添加题目
                </Link>
              </Button>
            }
          />
        </div>
      );
    }
    return <div className="text-muted-foreground">分类不存在: {category}</div>;
  }

  const dueCount = review.dueIds.length;
  const newCount = review.unseen.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
  const cleared = dueCount === 0 && newCount === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={cat?.name || category}
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden />
              添加题目
            </Link>
          </Button>
        }
      />

      {/* 双巨号数字对开 + 行动:版面主角是"今天还剩多少" */}
      {cleared ? (
        <div className="flex flex-col items-center gap-4 border-y border-border py-16 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <div className="text-lg font-semibold">今天的都学完了,没有待复习的题</div>
          <Button asChild size="lg">
            <Link to={`/${category}/quiz?force=all`}>再过一遍(全部题)</Link>
          </Button>
        </div>
      ) : (
        <section>
          <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <div className={`font-display text-5xl font-semibold leading-none tabular-nums tracking-tight ${dueCount > 0 ? 'text-warning' : 'text-foreground/30'}`}>
                {dueCount}
              </div>
              <div className="text-xs text-muted-foreground">
                题待复习
                {dueCount > 0 && (
                  <Link to={`/${category}/browse?status=due`} className="ml-1 text-primary hover:underline">是哪些题</Link>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <div className={`font-display text-5xl font-semibold leading-none tabular-nums tracking-tight ${newCount > 0 ? 'text-primary' : 'text-foreground/30'}`}>
                {newCount}
              </div>
              <div className="text-xs text-muted-foreground">
                题待学习
                {newCount > 0 && (
                  <Link to={`/${category}/browse?status=unseen`} className="ml-1 text-primary hover:underline">是哪些题</Link>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            {dueCount > 0 && (
              <Button asChild className="h-11 flex-1">
                <Link to={`/${category}/quiz?focus=due`}>开始复习 {dueCount} 题</Link>
              </Button>
            )}
            {newCount > 0 && (
              <Button asChild variant={dueCount > 0 ? 'outline' : 'default'} className="h-11 flex-1">
                <Link to={`/${category}/quiz?focus=new`}>开始学习 {newCount} 题</Link>
              </Button>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            待复习 = 之前学过、今天到该再看一遍的题;每次学 {limit === 0 ? '全部' : limit} 题,可在设置中调整
          </p>
        </section>
      )}

      {/* 总进度:细线 + 小字 */}
      <div className="flex items-center gap-4">
        <div className="h-0.5 flex-1 bg-muted">
          <div className="h-0.5 bg-primary/70" style={{ width: `${learnPct}%` }} />
        </div>
        <span className="flex-none text-xs tabular-nums text-muted-foreground">
          已学 {stats.learned} / {stats.total} · {learnPct}%
        </span>
      </div>

      {/* 模块目录:细线行 */}
      <section>
        <div className="text-xs font-medium text-muted-foreground">模块浏览</div>
        <div className="mt-2 rounded-lg border border-border bg-card divide-y divide-border">
          {cat?.modules.map((mod) => (
            <Link
              key={mod.id}
              to={`/${category}/browse?m=${mod.id}`}
              className="group flex items-center gap-4 border-b border-border py-3.5 transition-colors last:border-b-0 hover:bg-accent/40"
            >
              <span className="w-8 flex-none font-mono text-xs tabular-nums text-muted-foreground">
                {String(mod.id).padStart(2, '0')}
              </span>
              <span className="flex-1 text-sm text-foreground">{mod.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{mod.count} 题</span>
              <ChevronRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-primary" aria-hidden />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
