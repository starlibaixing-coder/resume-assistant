import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion } from '@/lib/mylib';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

// 题目浏览,两种模式:
// - 按模块:一次只展示一个模块(头:编号/名称/统计/进度条),底部「上一个/下一个模块」翻页;?m= 定初始模块
// - 全部题目:平铺列表,行 = 全局序号 + 模块名小标签 + 题干 + 题目标签 + 难度;
//   难度/状态两个维度筛选可组合(仅此模式显示)
// 行内:考察点(focus)平铺在题干下;官方题不可展开;我的题展开仅剩 编辑/删除。
// 定位 = 题库后台:扫读 + 管理我的题;答题/评分/写笔记在刷题页。

type ViewMode = 'module' | 'all';
type DiffFilter = 'all' | '初' | '中' | '高';
type StatusFilter = 'all' | 'unseen' | 'due' | 'mastered';

const DIFF_OPTIONS: Array<{ key: DiffFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: '初', label: '初' },
  { key: '中', label: '中' },
  { key: '高', label: '高' },
];
const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'unseen', label: '未学' },
  { key: 'due', label: '待复习' },
  { key: 'mastered', label: '已掌握' },
];

const pill = (active: boolean) =>
  `px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
    active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
  }`;

export function ModuleNav({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem('browse-view') === 'all' ? 'all' : 'module',
  );
  // 按模块模式:当前模块(初始取 ?m= 深链,否则第一个)
  const [pickedModule, setPickedModule] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const m = params.get('m');
    return m ? parseInt(m, 10) : null;
  });
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 我的题展开(编辑/删除)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isMy = category === MY_CATEGORY_SLUG;

  useEffect(() => {
    localStorage.setItem('browse-view', view);
  }, [view]);

  const { cat, byModule, moduleStats, allQuestions } = useMemo(() => {
    if (!data) return { cat: null, byModule: {} as Record<number, typeof data.questions>, moduleStats: {}, allQuestions: [] as typeof data.questions };
    const catObj = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    // 题号取 id 第三段(agent.12.10 → 10)。注意 index 字段是"模块.题号"小数
    // (agent.12.10 的 index=12.10≡12.1,与 12.1 撞),拿它排序 >9 题的模块会乱序
    const qnum = (q: typeof catQuestions[number]) => parseInt(q.id.split('.')[2] ?? '0', 10);
    const bm: Record<number, typeof catQuestions> = {};
    for (const q of catQuestions) {
      if (!bm[q.module]) bm[q.module] = [];
      bm[q.module].push(q);
    }
    for (const m of Object.keys(bm)) {
      bm[Number(m)].sort((a, b) => qnum(a) - qnum(b));
    }
    const all = [...catQuestions].sort((a, b) => a.module - b.module || qnum(a) - qnum(b));
    return { cat: catObj, byModule: bm, moduleStats: getModuleStats(category, catQuestions), allQuestions: all };
  }, [data, category]);

  const modules = cat?.modules ?? [];
  // 当前模块可能因数据变化消失(如删光),回退到第一个
  const selectedModule = modules.some((m) => m.id === pickedModule) ? pickedModule : (modules[0]?.id ?? null);
  const moduleIdx = modules.findIndex((m) => m.id === selectedModule);
  const prevModule = moduleIdx > 0 ? modules[moduleIdx - 1] : null;
  const nextModule = moduleIdx >= 0 && moduleIdx < modules.length - 1 ? modules[moduleIdx + 1] : null;

  // 切分类时重置
  useEffect(() => {
    setPickedModule(null);
    setExpandedId(null);
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

  // 全部题目模式:难度 + 状态两维度组合筛选
  const flatQuestions =
    view === 'all'
      ? allQuestions.filter((q) => {
          if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false;
          if (statusFilter !== 'all') {
            const status = getQuestionStatus(category, q.id);
            if (status !== statusFilter) return false;
          }
          return true;
        })
      : [];

  // 题目行:标记(模块模式=Q号 / 全部模式=全局序号+模块名标签)+ 题干 + focus 平铺 + 难度
  // 全部模式额外显示题目标签(tags);我的题整行可点展开 编辑/删除;官方题静态
  const renderRow = (q: typeof data.questions[number], marker: ReactNode, showTags = false) => {
    const isOpen = expandedId === q.id;
    return (
      <div key={q.id} className="border-b border-border last:border-b-0">
        <div
          className={`p-3 ${isMy ? 'cursor-pointer hover:bg-accent transition-colors' : ''}`}
          onClick={isMy ? () => setExpandedId(isOpen ? null : q.id) : undefined}
        >
          <div className="flex items-center gap-2.5">
            {marker}
            <span className="text-sm text-foreground flex-1">{q.title}</span>
            {isMy && <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">{isOpen ? '▼' : '▶'}</span>}
            <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
          </div>
          <div className="mt-1 pl-1 text-xs leading-relaxed text-muted-foreground">{q.focus}</div>
          {showTags && q.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {q.tags.map((t) => (
                <span key={t} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {isMy && isOpen && (
          <div className="flex items-center gap-2 px-3.5 pb-3">
            <Button size="sm" variant="outline" onClick={() => setEditingId(q.id)}>编辑</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeletingId(q.id)}>
              删除
            </Button>
            <span className="text-xs text-muted-foreground font-mono">我的库 · 可改可删</span>
          </div>
        )}
      </div>
    );
  };

  const selStats = selectedModule != null ? moduleStats[selectedModule] : null;
  const selModuleMeta = modules.find((m) => m.id === selectedModule);
  const selQuestions = selectedModule != null ? byModule[selectedModule] || [] : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">
          <span className="text-primary">●</span> {cat.name} / 题目浏览
        </h1>
        <p className="text-xs text-muted-foreground">
          管理与查阅:我的题可编辑删除;刷题、评分、写笔记去
          <a href={`#/${category}/quiz`} className="mx-0.5 text-primary hover:underline">刷题页</a>。
        </p>
      </div>

      {/* 模式切换 + 我的库生题入口 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button className={pill(view === 'module')} onClick={() => setView('module')}>按模块</button>
          <button className={pill(view === 'all')} onClick={() => setView('all')}>全部题目</button>
        </div>
        {isMy && (
          <Button asChild size="sm">
            <a href="#/generate">＋ AI 生题</a>
          </Button>
        )}
      </div>

      {view === 'module' ? (
        <div className="space-y-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="font-mono text-sm text-muted-foreground">
              {selectedModule != null ? String(selectedModule).padStart(2, '0') : '--'} · {selModuleMeta?.name ?? '—'}
            </div>
            {selStats && (
              <div className="flex gap-3 text-xs">
                <span className="text-muted-foreground">已学 {selStats.learned}/{selStats.total}</span>
                {selStats.mastered > 0 && <span className="text-success">掌握 {selStats.mastered}</span>}
                {selStats.dueToday > 0 && <span className="text-warning">待复习 {selStats.dueToday}</span>}
              </div>
            )}
          </div>
          {selStats && selStats.total > 0 && (
            <Progress
              value={selStats.total ? Math.round((selStats.learned / selStats.total) * 100) : 0}
              className="h-1.5"
            />
          )}

          <div className="overflow-hidden rounded-md border border-border bg-card">
            {selQuestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">本模块无题</div>
            ) : (
              selQuestions.map((q) =>
                renderRow(
                  q,
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    Q{q.id.split('.').slice(1).join('.')}
                  </span>,
                ),
              )
            )}
          </div>

          {/* 模块翻页:上一个 / 下一个 */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevModule}
              onClick={() => prevModule && setPickedModule(prevModule.id)}
            >
              <span className="max-w-40 truncate">← {prevModule ? `上一个 · ${prevModule.name}` : '已是第一个'}</span>
            </Button>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {moduleIdx >= 0 ? moduleIdx + 1 : '--'} / {modules.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextModule}
              onClick={() => nextModule && setPickedModule(nextModule.id)}
            >
              <span className="max-w-40 truncate">{nextModule ? `下一个 · ${nextModule.name} →` : '已是最后一个'}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 筛选:两个维度,可组合(仅全部题目模式) */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">难度</span>
              {DIFF_OPTIONS.map((o) => (
                <button key={o.key} className={pill(diffFilter === o.key)} onClick={() => setDiffFilter(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono">状态</span>
              {STATUS_OPTIONS.map((o) => (
                <button key={o.key} className={pill(statusFilter === o.key)} onClick={() => setStatusFilter(o.key)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-card">
            {flatQuestions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">无符合条件的题</div>
            ) : (
              flatQuestions.map((q, i) => {
                const modName = modules.find((m) => m.id === q.module)?.name ?? String(q.module);
                return renderRow(
                  q,
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <span className="max-w-24 truncate rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {modName}
                    </span>
                  </span>,
                  true,
                );
              })
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono text-right">共 {flatQuestions.length} 题</div>
        </div>
      )}

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
