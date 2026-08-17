import { useMemo, useState, useEffect } from 'react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, copyOfficial, getMyQuestion } from '@/lib/mylib';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unmastered', label: '未掌握' },
  { key: 'due', label: '待复习' },
  { key: 'high', label: '高难度' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

// 题目浏览(手风琴式):模块纵向堆叠(编号/名称/统计/进度条),题目行内展开。
// 定位 = 题库后台:找题/看题/管题(官方题复制副本、我的题编辑删除);
// 答案普通折叠,答题/评分/写笔记都在刷题页。?m= 深链聚焦单模块(其余收起)。

export function ModuleNav({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 答案展开:记"哪道题已展开",切题自动收回
  const [revealedId, setRevealedId] = useState<string | null>(null);
  // 改删/复制(功能⑥):my 分类可编辑删除;官方分类只能复制副本再改(ADR-3)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isMy = category === MY_CATEGORY_SLUG;

  const { cat, byModule, moduleStats } = useMemo(() => {
    if (!data) return { cat: null, byModule: {} as Record<number, typeof data.questions>, moduleStats: {} };
    const catObj = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    const bm: Record<number, typeof catQuestions> = {};
    for (const q of catQuestions) {
      if (!bm[q.module]) bm[q.module] = [];
      bm[q.module].push(q);
    }
    for (const m of Object.keys(bm)) {
      bm[Number(m)].sort((a, b) => a.index - b.index);
    }
    return { cat: catObj, byModule: bm, moduleStats: getModuleStats(category, catQuestions) };
  }, [data, category]);

  // 切分类时重置展开状态
  useEffect(() => {
    setExpandedId(null);
    setRevealedId(null);
  }, [category]);

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;
  // my 分类无 approved 题时聚合里没有它(避免卡"加载中"),给空态引导
  if (!cat) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="text-center py-16 space-y-3">
          <div className="text-foreground">我的题库还没有题</div>
          <div className="text-sm text-muted-foreground">AI 生题进草稿区,通过后就会出现在这里。</div>
          <a href="#/generate" className="inline-block text-primary hover:underline text-sm">去生题 →</a>
        </div>
      </div>
    );
  }

  const filterQuestion = (q: typeof data.questions[number]) => {
    if (filter === 'all') return true;
    const status = getQuestionStatus(category, q.id);
    if (filter === 'unmastered') return status !== 'mastered';
    if (filter === 'due') return status === 'due' || status === 'unseen';
    if (filter === 'high') return q.difficulty === '高';
    return true;
  };

  const handleCopy = async (q: typeof data.questions[number]) => {
    await copyOfficial(q);
    setCopiedId(q.id);
  };

  // ?m= 深链聚焦单模块(从队列页模块卡进来),其余模块隐藏
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const focusMod = params.get('m');

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          <span className="text-primary">●</span> {cat.name} / 题目浏览
        </h1>
        <p className="text-xs text-muted-foreground">
          管理与查阅:官方题可复制副本,我的题可编辑删除;刷题、评分、写笔记去
          <a href={`#/${category}/quiz`} className="mx-0.5 text-primary hover:underline">刷题页</a>。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {cat.modules.map((mod) => {
        const qs = (byModule[mod.id] || []).filter(filterQuestion);
        const collapsed = focusMod && focusMod !== String(mod.id);
        if (collapsed) return null;
        const stats = moduleStats[mod.id];
        const learnedPct = stats && stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;

        return (
          <div key={mod.id} className="space-y-2">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="font-mono text-sm text-muted-foreground">
                {String(mod.id).padStart(2, '0')} · {mod.name}({qs.length}/{stats?.total || 0})
              </div>
              {stats && (
                <div className="flex gap-3 text-xs">
                  <span className="text-muted-foreground">已学 {stats.learned}/{stats.total}</span>
                  {stats.mastered > 0 && (
                    <span className="text-success">掌握 {stats.mastered}</span>
                  )}
                  {stats.dueToday > 0 && (
                    <span className="text-warning">待复习 {stats.dueToday}</span>
                  )}
                </div>
              )}
            </div>
            {stats && stats.total > 0 && <Progress value={learnedPct} className="h-1.5" />}

            <div className="bg-card border border-border rounded-md overflow-hidden">
              {qs.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">本筛选下无题</div>
              ) : (
                qs.map((q) => {
                  const isOpen = expandedId === q.id;
                  const answerOpen = revealedId === q.id;
                  return (
                    <div key={q.id} className="border-b border-border last:border-b-0">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => setExpandedId(isOpen ? null : q.id)}
                      >
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {isOpen ? '▼' : '▶'} Q{q.id.split('.').slice(1).join('.')}
                        </span>
                        <span className="text-sm text-foreground flex-1">{q.title}</span>
                        <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                      </div>
                      {isOpen && (
                        <div className="space-y-2.5 px-3.5 pb-4">
                          <div className="text-sm text-muted-foreground">{q.focus}</div>

                          {/* 管理操作 */}
                          <div className="flex flex-wrap items-center gap-2">
                            {isMy ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setEditingId(q.id)}>编辑</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingId(q.id)}>
                                  删除
                                </Button>
                                <span className="text-xs text-muted-foreground font-mono">我的库 · 可改可删</span>
                              </>
                            ) : copiedId === q.id ? (
                              <a href={`#/${MY_CATEGORY_SLUG}/browse`} className="text-sm text-primary hover:underline">
                                已复制 ✓ 到我的题库改 →
                              </a>
                            ) : (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleCopy(q)}>复制到我的库</Button>
                                <span className="text-xs text-muted-foreground font-mono">官方题只读,复制副本后可改</span>
                              </>
                            )}
                          </div>

                          {/* 答案:普通折叠,一点即开(管理视图,无强制思考仪式) */}
                          {answerOpen ? (
                            <>
                              <AnswerPanel answer={q.answer} followups={q.followups} />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRevealedId(null)}
                                className="text-muted-foreground"
                              >
                                ↑ 收起答案
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setRevealedId(q.id)}>
                              展开答案 ▾
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      <QuestionEditDialog
        question={editingId ? getMyQuestion(editingId) : null}
        open={!!editingId}
        onOpenChange={(o) => !o && setEditingId(null)}
      />
      <DeleteQuestionDialog
        question={deletingId ? getMyQuestion(deletingId) : null}
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      />
    </div>
  );
}
