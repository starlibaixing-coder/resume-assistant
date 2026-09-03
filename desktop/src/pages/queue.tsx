import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, Plus } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { MY_CATEGORY_SLUG } from '@/lib/mylib';
import { loadLimit } from '@/lib/prefs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { AddQuestionDialog } from '@/components/add-question-dialog';

// 题库分类页:标题就是分类名(2026-09-02 IA 重构,不再加"· 刷题队列"后缀)。
// 两种刷法分开选,不替用户做主:「开始复习」= 待复习(SM-2 到期题),
// 「开始学习」= 待学习的题;各自的"是哪些题"深链到浏览页状态筛选。
// 出题是页面按钮不是菜单(添加题目 / AI 生成题目,均进我的题库并标来源)。

export function QueuePage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  const limit = loadLimit();
  const [addOpen, setAddOpen] = useState(false);

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
  if (!data || !stats || !review) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;

  const cat = data.categories.find((c) => c.slug === category);
  const isMy = category === MY_CATEGORY_SLUG;
  // 我的库无 approved 题时聚合里没有该分类,给引导空态(而非误导的"已清空")
  if (!cat) {
    if (isMy) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <PageHeader title="我的题库" />
          <Card>
            <CardContent className="space-y-3 py-16 text-center">
              <div className="text-foreground">我的题库还没有题</div>
              <div className="text-sm text-muted-foreground">手动写一道,或让 AI 生成(先进待审核,通过后出现在这里)。</div>
              <div className="flex justify-center pt-1">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  添加题目
                </Button>
              </div>
            </CardContent>
          </Card>
          <AddQuestionDialog open={addOpen} onOpenChange={setAddOpen} />
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
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={cat?.name || category} />
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant={isMy ? 'outline' : 'outline'} onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" aria-hidden />
            添加题目
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
        {cleared ? (
          <>
            <div className="space-y-1 text-center">
              <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
              <div className="text-sm text-muted-foreground">全部学过,今日没有到期的</div>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link to={`/${category}/quiz?force=all`}>再过一遍(全部题)</Link>
            </Button>
          </>
        ) : (
          <>
            {/* 两种学法并列,用户自己选:先复习到期题 or 学待学习的题 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 rounded-lg border border-border p-3 text-center">
                <div className={`text-2xl font-bold ${dueCount > 0 ? 'text-warning' : 'text-muted-foreground/60'}`}>{dueCount}</div>
                <div className="text-xs text-muted-foreground">
                  题待复习
                  {dueCount > 0 && (
                    <Link to={`/${category}/browse?status=due`} className="ml-1 text-primary hover:underline">是哪些题</Link>
                  )}
                </div>
              </div>
              <div className="space-y-1 rounded-lg border border-border p-3 text-center">
                <div className={`text-2xl font-bold ${newCount > 0 ? 'text-primary' : 'text-muted-foreground/60'}`}>{newCount}</div>
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
              待复习 = 之前学过、按记忆曲线(SM-2)今天该再看一遍的题;每次学 {limit === 0 ? '全部' : limit} 题(可在设置中调整)
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Progress value={learnPct} className="h-1.5 ring-1 ring-border" />
          <div className="text-xs text-muted-foreground font-mono text-center">
            已学 {stats.learned} / {stats.total} · {learnPct}%
          </div>
        </div>
        </CardContent>
      </Card>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-3">模块浏览</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cat?.modules.map((mod) => (
            <Link
              key={mod.id}
              to={`/${category}/browse?m=${mod.id}`}
              className="flex justify-between items-center p-3 bg-card border border-border rounded-md hover:border-primary transition-colors cursor-pointer"
            >
              <div>
                <div className="text-sm text-foreground">{mod.name}</div>
                <div className="text-xs text-muted-foreground">模块 {String(mod.id).padStart(2, '0')}</div>
              </div>
              <div className="text-xs text-muted-foreground">{mod.count} 题</div>
            </Link>
          ))}
        </div>
      </div>

      <AddQuestionDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
