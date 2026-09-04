import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BookmarkPlus, LibraryBig, Pencil, Plus, Trash2 } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion, getMyQuestions, copyOfficial, getCopiedSourceIds } from '@/lib/mylib';
import type { Question, QuestionData, QuestionSource } from '@/types/question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

// 题目列表 v2「纸面编辑部」:筛选行 + 细线行目录,去卡片。
// 行 = 序号 + 模块小签 + 来源签 + 题干 + 难度 + 行尾 ghost icon 动作;
// 行内动作用 ghost icon 按钮 + tooltip。官方题「添加到我的题库」(ADR-3 复制后改)。
// 答题/评分/笔记在学习页。?m= / ?status= 深链定初始筛选。

type DiffFilter = 'all' | '初' | '中' | '高';
type StatusFilter = 'all' | 'unseen' | 'due' | 'mastered';

const DIFF_OPTIONS: Array<{ key: DiffFilter; label: string }> = [
  { key: 'all', label: '全部难度' },
  { key: '初', label: '初' },
  { key: '中', label: '中' },
  { key: '高', label: '高' },
];
const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全部状态' },
  { key: 'unseen', label: '待学习' },
  { key: 'due', label: '待复习' },
  { key: 'mastered', label: '已掌握' },
];

// 筛选下拉:shadcn Select(Radix 行为 + token 样式),不写原生 select
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ key: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key} className="text-xs">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function BrowsePage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  // 模块筛选:'all' 或模块号字符串;初始取 ?m= 深链;状态筛选取 ?status= 深链(分类页"是哪些题")
  const [searchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState<string>(() => searchParams.get('m') ?? 'all');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'due' || s === 'unseen' || s === 'mastered' ? s : 'all';
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const isMy = category === MY_CATEGORY_SLUG;

  // copiedSourceIds 随 data 重算(copyOfficial notify → useQuestions setData)
  const { cat, moduleStats, allQuestions, copiedSourceIds } = useMemo(() => {
    if (!data) return { cat: null, moduleStats: {}, allQuestions: [] as QuestionData['questions'], copiedSourceIds: new Set<string>() };
    const catObj = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    // 题号取 id 第三段(agent.12.10 → 10)。index 字段是"模块.题号"小数,不能拿它排序
    const qnum = (q: typeof catQuestions[number]) => parseInt(q.id.split('.')[2] ?? '0', 10);
    const all = [...catQuestions].sort((a, b) => a.module - b.module || qnum(a) - qnum(b));
    return { cat: catObj, moduleStats: getModuleStats(category, catQuestions), allQuestions: all, copiedSourceIds: getCopiedSourceIds() };
  }, [data, category]);

  // 切分类时重置
  useEffect(() => {
    setModuleFilter('all');
  }, [category]);

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="题目列表" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  // my 分类无 approved 题时聚合里没有它(避免卡"加载中"),给空态引导
  if (!cat) {
    return (
      <div className="space-y-8">
        <PageHeader title="我的题库 · 题目列表" />
        <EmptyState
          icon={LibraryBig}
          title="我的题库还没有题"
          description="手动写一道,或让 AI 生成(先进待审核,通过后出现在这里)。"
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

  const modules = cat.modules;
  const moduleOptions = [
    { key: 'all', label: '全部模块' },
    ...modules.map((m) => ({ key: String(m.id), label: `${String(m.id).padStart(2, '0')} · ${m.name}` })),
  ];
  const effectiveModule = moduleOptions.some((o) => o.key === moduleFilter) ? moduleFilter : 'all';
  const singleModule = effectiveModule !== 'all' ? modules.find((m) => String(m.id) === effectiveModule) : null;

  const listQuestions = allQuestions.filter((q) => {
    if (singleModule && q.module !== singleModule.id) return false;
    if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false;
    if (statusFilter !== 'all' && getQuestionStatus(category, q.id) !== statusFilter) return false;
    return true;
  });

  const singleStats = singleModule ? moduleStats[singleModule.id] : null;

  const handleReset = () => {
    setModuleFilter('all');
    setDiffFilter('all');
    setStatusFilter('all');
  };
  const hasFilter = effectiveModule !== 'all' || diffFilter !== 'all' || statusFilter !== 'all';

  // 我的题来源(聚合层剥掉了 source,这里从 mylib 缓存查)
  const sourceOf = (id: string): QuestionSource | null => getMyQuestions().find((q) => q.id === id)?.source ?? null;

  // 官方题 → 我的库副本(ADR-3)。成功 toast;行尾标识由 mylib notify 驱动自动出现。
  const handleAddToMy = async (q: Question) => {
    if (copyingId) return;
    setCopyingId(q.id);
    try {
      await copyOfficial(q);
      toast.success('已添加到我的题库');
    } catch (e) {
      toast.error('添加失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCopyingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${cat.name} · 题目列表`}
        description={
          <>
            管理与查阅:我的题可编辑删除;学习、评分、写笔记去
            <Link to={`/${category}/quiz`} className="mx-0.5 text-primary hover:underline">学习页</Link>。
          </>
        }
        actions={
          isMy ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/add">
                <Plus className="size-3.5" aria-hidden />
                添加题目
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* 筛选行:模块 / 难度 / 状态,可组合 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterSelect label="模块" value={effectiveModule} onChange={setModuleFilter} options={moduleOptions} />
        <FilterSelect label="难度" value={diffFilter} onChange={(v) => setDiffFilter(v as DiffFilter)} options={DIFF_OPTIONS} />
        <FilterSelect label="状态" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={STATUS_OPTIONS} />
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">共 {listQuestions.length} 题</span>
        {hasFilter && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleReset}>
            重置
          </Button>
        )}
      </div>

      {/* 单模块上下文:统计行 */}
      {singleModule && singleStats && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {String(singleModule.id).padStart(2, '0')} · {singleModule.name}
          </span>
          <div className="h-0.5 flex-1 bg-muted">
            <div
              className="h-0.5 bg-primary/70"
              style={{ width: `${singleStats.total ? Math.round((singleStats.learned / singleStats.total) * 100) : 0}%` }}
            />
          </div>
          <span className="flex gap-3 text-xs tabular-nums">
            <span className="text-muted-foreground">已学 {singleStats.learned}/{singleStats.total}</span>
            {singleStats.mastered > 0 && <span className="text-success">已掌握 {singleStats.mastered}</span>}
            {singleStats.dueToday > 0 && <span className="text-warning">待复习 {singleStats.dueToday}</span>}
          </span>
        </div>
      )}

      {/* 题目细线目录 */}
      <div data-browse-list className="border-t border-border">
        {listQuestions.length === 0 ? (
          <div className="flex items-center justify-center gap-3 border-b border-border py-8 text-sm text-muted-foreground">
            没有符合筛选的题
            {hasFilter && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReset}>
                清除筛选
              </Button>
            )}
          </div>
        ) : (
          listQuestions.map((q, i) => {
            const modName = modules.find((m) => m.id === q.module)?.name ?? String(q.module);
            const copied = !isMy && copiedSourceIds.has(q.id);
            const source = isMy ? sourceOf(q.id) : null;
            return (
              // content-visibility:屏外行跳过渲染(282 题全量 DOM 保留)
              <div key={q.id} className="border-b border-border px-1 py-3 [contain-intrinsic-size:auto_88px] [content-visibility:auto]">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="max-w-24 truncate shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {modName}
                  </span>
                  {source && (
                    <span
                      title={`来源:${SOURCE_LABELS[source]}`}
                      className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {SOURCE_LABELS[source]}
                    </span>
                  )}
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{q.title}</span>
                  <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                  {isMy ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label="编辑"
                            onClick={() => setEditingId(q.id)}
                          >
                            <Pencil />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>编辑</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="删除"
                            onClick={() => setDeletingId(q.id)}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* 禁用的 button 不派发指针事件,tooltip 挂外层 span 才 hover 得出来 */}
                        <span className="inline-flex shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label={copied ? '已在我的库' : '添加到我的题库'}
                            disabled={copied || copyingId === q.id}
                            onClick={() => void handleAddToMy(q)}
                          >
                            <BookmarkPlus />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{copied ? '已在我的库' : '添加到我的题库'}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="mt-1 pl-9 text-xs leading-relaxed text-muted-foreground">{q.focus}</div>
                {q.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-9">
                    {q.tags.map((t) => (
                      <span key={t} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
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

// 我的题来源标签(三类出题入口产物都进我的题库,来源可见)
const SOURCE_LABELS: Record<QuestionSource, string> = {
  manual: '手动',
  ai: 'AI 生成',
  jd: '按 JD',
  copy: '官方复制',
};
