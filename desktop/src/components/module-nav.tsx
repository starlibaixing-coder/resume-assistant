import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion } from '@/lib/mylib';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

// 题目浏览,两种模式:
// - 按模块:手风琴(模块纵向堆叠带统计/进度条),顶部模块快切条,点选只看该模块
// - 全部题目:平铺列表(模块只是行上的小标签),难度/状态两个维度筛选可组合
// 行内简化:考察点(focus)平铺在题干下;官方题不可展开;我的题展开仅剩 编辑/删除。
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
  // 按模块模式的快切(null = 全部);初始取 ?m= 深链
  const [moduleFilter, setModuleFilter] = useState<number | null>(() => {
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
    const bm: Record<number, typeof catQuestions> = {};
    for (const q of catQuestions) {
      if (!bm[q.module]) bm[q.module] = [];
      bm[q.module].push(q);
    }
    for (const m of Object.keys(bm)) {
      bm[Number(m)].sort((a, b) => a.index - b.index);
    }
    const all = [...catQuestions].sort((a, b) => a.module - b.module || a.index - b.index);
    return { cat: catObj, byModule: bm, moduleStats: getModuleStats(category, catQuestions), allQuestions: all };
  }, [data, category]);

  // 切分类时重置
  useEffect(() => {
    setModuleFilter(null);
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

  // 题目行:标记(模块模式=Q号 / 全部模式=模块标签)+ 题干 + focus 平铺 + 难度
  // 我的题整行可点,展开出 编辑/删除;官方题静态
  const renderRow = (q: typeof data.questions[number], marker: ReactNode) => {
    const isOpen = expandedId === q.id;
    return (
      <div key={q.id} className="border-b border-border last:border-b-0">
        <div
          className={`p-3 ${isMy ? 'cursor-pointer hover:bg-accent transition-colors' : ''}`}
          onClick={isMy ? () => setExpandedId(isOpen ? null : q.id) : undefined}
        >
          <div className="flex items-center gap-3">
            {marker}
            <span className="text-sm text-foreground flex-1">{q.title}</span>
            {isMy && <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">{isOpen ? '▼' : '▶'}</span>}
            <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
          </div>
          <div className="mt-1 pl-1 text-xs leading-relaxed text-muted-foreground">{q.focus}</div>
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
        <div className="space-y-5">
          {/* 模块快切条:全部 + 各模块;点选只看该模块 */}
          <div className="flex flex-wrap gap-1.5">
            <button
              className={moduleFilter === null ? 'bg-primary/10 text-primary font-medium rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors' : 'bg-secondary text-secondary-foreground hover:bg-accent rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors'}
              onClick={() => setModuleFilter(null)}
            >
              全部
            </button>
            {cat.modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setModuleFilter(moduleFilter === mod.id ? null : mod.id)}
                title={mod.name}
                className={`rounded-md px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                  moduleFilter === mod.id ? 'bg-primary/10 text-primary font-medium' : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {String(mod.id).padStart(2, '0')} {mod.name}
              </button>
            ))}
          </div>

          {cat.modules
            .filter((mod) => moduleFilter == null || mod.id === moduleFilter)
            .map((mod) => {
              const qs = byModule[mod.id] || [];
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
                        {stats.mastered > 0 && <span className="text-success">掌握 {stats.mastered}</span>}
                        {stats.dueToday > 0 && <span className="text-warning">待复习 {stats.dueToday}</span>}
                      </div>
                    )}
                  </div>
                  {stats && stats.total > 0 && <Progress value={learnedPct} className="h-1.5" />}

                  <div className="overflow-hidden rounded-md border border-border bg-card">
                    {qs.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">本模块无题</div>
                    ) : (
                      qs.map((q) =>
                        renderRow(
                          q,
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            Q{q.id.split('.').slice(1).join('.')}
                          </span>,
                        ),
                      )
                    )}
                  </div>
                </div>
              );
            })}
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
              flatQuestions.map((q) =>
                renderRow(
                  q,
                  <span className="shrink-0 rounded bg-secondary px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {String(q.module).padStart(2, '0')}
                  </span>,
                ),
              )
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
