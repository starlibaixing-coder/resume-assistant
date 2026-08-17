import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, copyOfficial, getMyQuestion } from '@/lib/mylib';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

const NotePanel = lazy(() => import('./note-panel'));

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'unmastered', label: '未掌握' },
  { key: 'due', label: '待复习' },
  { key: 'high', label: '高难度' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

// 题目浏览(桌面,邮件客户端式三栏):模块列表 | 题目列表 | 详情面板。
// 三栏各自独立滚动(≥lg 满高布局);答案默认折叠,点「我想好了」才展示(对齐刷题的强制思考)。
// 点题目右栏立即看题干/考察点/笔记/管理操作,不打断列表。
// <lg:模块退化为横向条,题目列表与详情上下堆叠(页面整体滚动)。

export function ModuleNav({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [filter, setFilter] = useState<FilterKey>('all');
  // 改删/复制(功能⑥):my 分类可编辑删除;官方分类只能复制副本再改(ADR-3)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 答案展开:记"哪道题已展开",切题自动收回
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const isMy = category === MY_CATEGORY_SLUG;
  // 选中的模块:初始取 ?m= 深链,否则第一个
  const [pickedModule, setPickedModule] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const m = params.get('m');
    return m ? parseInt(m, 10) : null;
  });
  const [pickedId, setPickedId] = useState<string | null>(null);

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

  // 选中模块可能因数据变化消失(如删光),回退到第一个
  const modules = cat?.modules ?? [];
  const selectedModule =
    modules.some((m) => m.id === pickedModule) ? pickedModule : (modules[0]?.id ?? null);

  // 切分类时重置选中
  useEffect(() => {
    setPickedModule(null);
    setPickedId(null);
  }, [category]);

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;
  // my 分类无 approved 题时聚合里没有它(避免卡"加载中"),给空态引导
  if (!cat) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
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

  const selStats = selectedModule != null ? moduleStats[selectedModule] : null;
  const selModuleMeta = modules.find((m) => m.id === selectedModule);
  const listQuestions = selectedModule != null ? (byModule[selectedModule] || []).filter(filterQuestion) : [];
  // 详情选中:优先用户点选,模块/筛选变化后不在列表则回退到第一题
  const selected = listQuestions.find((q) => q.id === pickedId) ?? listQuestions[0] ?? null;

  const handleCopy = async (q: typeof data.questions[number]) => {
    await copyOfficial(q);
    setCopiedId(q.id);
  };

  const moduleButton = (mod: (typeof modules)[number]) => {
    const stats = moduleStats[mod.id];
    const pct = stats && stats.total ? Math.round((stats.learned / stats.total) * 100) : 0;
    const active = mod.id === selectedModule;
    return (
      <button
        key={mod.id}
        onClick={() => setPickedModule(mod.id)}
        title={mod.name}
        className={`w-full rounded-md px-3 py-2.5 text-left cursor-pointer transition-colors ${
          active ? 'bg-primary/10' : 'hover:bg-accent'
        }`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className={`font-mono text-[10px] ${active ? 'text-primary' : 'text-muted-foreground/60'}`}>
            {String(mod.id).padStart(2, '0')}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {stats ? `${stats.learned}/${stats.total}` : `${mod.count} 题`}
          </span>
        </div>
        <div className={`mt-0.5 truncate text-sm ${active ? 'font-medium text-primary' : 'text-foreground'}`}>
          {mod.name}
        </div>
        <Progress value={pct} className="mt-1.5 h-1" />
        {stats && stats.dueToday > 0 && (
          <div className="mt-1 text-[10px] text-warning">待复习 {stats.dueToday}</div>
        )}
      </button>
    );
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:h-full">
      <h1 className="shrink-0 text-2xl font-bold">
        <span className="text-primary">●</span> {cat.name} / 题目浏览
      </h1>

      <div className="flex min-h-0 flex-col gap-5 lg:flex-1 lg:flex-row">
        {/* 栏 1:模块列表,独立滚动(<lg 退化为横向条) */}
        <aside className="hidden w-44 shrink-0 flex-col gap-1 lg:flex lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-2">
          {modules.map(moduleButton)}
        </aside>
        <div className="flex flex-wrap gap-1.5 lg:hidden">
          {modules.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setPickedModule(mod.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                mod.id === selectedModule ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {String(mod.id).padStart(2, '0')} {mod.name}
            </button>
          ))}
        </div>

        {/* 栏 2:题目列表,独立滚动 */}
        <section className="w-full shrink-0 space-y-3 lg:min-h-0 lg:w-72 lg:overflow-y-auto lg:pr-1 lg:pb-2">
          <div>
            <div className="text-sm font-semibold">{selModuleMeta?.name ?? '—'}</div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">
              模块 {selectedModule != null ? String(selectedModule).padStart(2, '0') : '--'}
              {selStats && ` · 已学 ${selStats.learned}/${selStats.total}`}
              {selStats && selStats.dueToday > 0 && ` · 待复习 ${selStats.dueToday}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {listQuestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">本筛选下无题</div>
            ) : (
              listQuestions.map((q) => {
                const active = selected?.id === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => setPickedId(q.id)}
                    className={`flex w-full items-start gap-2.5 border-b border-border p-3 text-left last:border-b-0 cursor-pointer transition-colors ${
                      active ? 'bg-accent' : 'hover:bg-accent/60'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground/70">
                      Q{q.id.split('.').slice(1).join('.')}
                    </span>
                    <span className="flex-1 text-sm leading-snug text-foreground">{q.title}</span>
                    <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* 栏 3:详情面板,独立滚动;答案默认折叠(强制思考) */}
        <section className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:pb-2">
          {selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selected.difficulty}</Badge>
                {selected.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <div className="text-lg font-semibold leading-snug text-foreground">{selected.title}</div>
              <div className="text-sm text-muted-foreground">{selected.focus}</div>

              {/* 管理操作:不依赖答案,置顶 */}
              <div className="flex items-center gap-2">
                {isMy ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(selected.id)}>编辑</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingId(selected.id)}>
                      删除
                    </Button>
                    <span className="text-xs text-muted-foreground font-mono">我的库 · 可改可删</span>
                  </>
                ) : copiedId === selected.id ? (
                  <a href={`#/${MY_CATEGORY_SLUG}/browse`} className="text-sm text-primary hover:underline">
                    已复制 ✓ 到我的题库改 →
                  </a>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleCopy(selected)}>复制到我的库</Button>
                    <span className="text-xs text-muted-foreground font-mono">官方题只读,复制副本后可改</span>
                  </>
                )}
              </div>

              <Suspense fallback={<div className="text-sm text-muted-foreground">加载笔记…</div>}>
                <NotePanel category={category} questionId={selected.id} />
              </Suspense>

              {/* 答案:先想后看(与刷题一致的强制思考) */}
              {revealedId === selected.id ? (
                <>
                  <AnswerPanel answer={selected.answer} followups={selected.followups} />
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
                <div className="space-y-2 pt-1">
                  <Button onClick={() => setRevealedId(selected.id)} className="w-full">
                    我想好了,看答案
                  </Button>
                  <div className="text-xs text-muted-foreground text-center">先在脑中过一遍,再对答案</div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              左侧选择题目查看详情
            </div>
          )}
        </section>
      </div>

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
