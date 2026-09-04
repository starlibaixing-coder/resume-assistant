import { useMemo } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, LibraryBig, Plus } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { MY_CATEGORY_SLUG } from '@/lib/mylib';
import { loadLimit } from '@/lib/prefs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';

// 题库分类页:标题就是分类名(2026-09-02 IA)。
// 2026-09-04 UI 重构:计数块与按钮合并为一张行动卡(诊断:去掉两层边框),
// 加载态统一 Skeleton,空态/错误态走共享组件。
// 两种学法分开选,不替用户做主:「开始复习」= 待复习(SM-2 到期题),
// 「开始学习」= 待学习的题;各自的"是哪些题"深链到题目列表状态筛选。
// 出题入口 = 「添加题目」页(/add)。

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
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="题库" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }
  if (!data || !stats || !review) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  const cat = data.categories.find((c) => c.slug === category);
  const isMy = category === MY_CATEGORY_SLUG;
  // 我的库无 approved 题时聚合里没有该分类,给引导空态(而非误导的"已清空")
  if (!cat) {
    if (isMy) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
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
    return <div className="text-muted-foreground p-8 text-center">分类不存在: {category}</div>;
  }

  const dueCount = review.dueIds.length;
  const newCount = review.unseen.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
  const cleared = dueCount === 0 && newCount === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
        {cleared ? (
          <>
            <div className="space-y-1 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
              <div className="text-sm text-muted-foreground">今天的都学完了,没有待复习的题</div>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link to={`/${category}/quiz?force=all`}>再过一遍(全部题)</Link>
            </Button>
          </>
        ) : (
          <>
            {/* 行动卡:两种学法并列,用户自己选;计数即深链入口 */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <div className="space-y-0.5 bg-card p-3 text-center">
                <div className={`text-2xl font-bold tabular-nums ${dueCount > 0 ? 'text-warning' : 'text-muted-foreground/60'}`}>{dueCount}</div>
                <div className="text-xs text-muted-foreground">
                  题待复习
                  {dueCount > 0 && (
                    <Link to={`/${category}/browse?status=due`} className="ml-1 text-primary hover:underline">是哪些题</Link>
                  )}
                </div>
              </div>
              <div className="space-y-0.5 bg-card p-3 text-center">
                <div className={`text-2xl font-bold tabular-nums ${newCount > 0 ? 'text-primary' : 'text-muted-foreground/60'}`}>{newCount}</div>
                <div className="text-xs text-muted-foreground">
                  题待学习
                  {newCount > 0 && (
                    <Link to={`/${category}/browse?status=unseen`} className="ml-1 text-primary hover:underline">是哪些题</Link>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {dueCount > 0 && (
                <Button asChild className="flex-1">
                  <Link to={`/${category}/quiz?focus=due`}>开始复习 {dueCount} 题</Link>
                </Button>
              )}
              {newCount > 0 && (
                <Button asChild variant={dueCount > 0 ? 'outline' : 'default'} className="flex-1">
                  <Link to={`/${category}/quiz?focus=new`}>开始学习 {newCount} 题</Link>
                </Button>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground">
              待复习 = 之前学过、今天到该再看一遍的题;每次学 {limit === 0 ? '全部' : limit} 题,可在设置中调整
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Progress value={learnPct} className="h-1.5 ring-1 ring-border" />
          <div className="text-center text-xs tabular-nums text-muted-foreground">
            已学 {stats.learned} / {stats.total} · {learnPct}%
          </div>
        </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 text-xs font-medium text-muted-foreground">模块浏览</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {cat?.modules.map((mod) => (
            <Link
              key={mod.id}
              to={`/${category}/browse?m=${mod.id}`}
              className="flex items-center justify-between rounded-md border border-border bg-card p-3 transition-colors hover:border-primary cursor-pointer"
            >
              <div>
                <div className="text-sm text-foreground">{mod.name}</div>
                <div className="text-xs text-muted-foreground">模块 {String(mod.id).padStart(2, '0')}</div>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">{mod.count} 题</div>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
