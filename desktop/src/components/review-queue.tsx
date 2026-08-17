import { useMemo, useState } from 'react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue, getStats } from '@/lib/schedule';
import { clearProgress, clearNotes } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';

const LIMIT_OPTIONS = [20, 50, 100, 0] as const;

export function ReviewQueue({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [limit, setLimit] = useState<number>(50);
  // 用于清除后强制刷新统计
  const [refreshKey, setRefreshKey] = useState(0);

  const { ids, stats, queue } = useMemo(() => {
    if (!data) return { ids: [] as string[], stats: null, queue: null };
    const ids = data.questions.filter((q) => q.category === category).map((q) => q.id);
    return {
      ids,
      stats: getStats(category, ids),
      queue: getReviewQueue(category, ids, limit),
    };
    // refreshKey in deps so clearing progress re-reads stats
  }, [data, category, limit, refreshKey]);

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data || !stats || !queue) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;

  const cat = data.categories.find((c) => c.slug === category);
  const dueCount = queue.dueIds.length;
  const learnPct = stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
  const handleCleared = () => setRefreshKey((k) => k + 1);

  return (
    <div className="space-y-6">
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

      {/* 清除进度区(新功能) */}
      <div className="flex gap-2 pt-4 border-t border-border justify-center">
        <ClearButton
          label="清空复习进度"
          title="清空复习进度?"
          description={`将删除「${cat?.name || category}」分类的全部刷题进度(SM-2 记录)。笔记会保留。此操作不可恢复。`}
          confirmLabel="确认清空"
          onConfirm={() => { clearProgress(category); handleCleared(); }}
        />
        <ClearButton
          label="清空笔记"
          title="清空笔记?"
          description={`将删除「${cat?.name || category}」分类的全部笔记。复习进度会保留。此操作不可恢复。`}
          confirmLabel="确认清空"
          onConfirm={() => { clearNotes(category); handleCleared(); }}
        />
      </div>
    </div>
  );
}

function ClearButton({
  label, title, description, confirmLabel, onConfirm,
}: {
  label: string; title: string; description: string; confirmLabel: string; onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onConfirm}>{confirmLabel}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
