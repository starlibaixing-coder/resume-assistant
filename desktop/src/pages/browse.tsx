import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BookmarkPlus, LibraryBig, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion, getMyQuestions, copyOfficial, getCopiedSourceIds } from '@/lib/mylib';
import { loadNotes } from '@/lib/storage';
import type { Question, QuestionData, QuestionSource } from '@/types/question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AnswerPanel } from '@/components/answer-panel';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

// 题目列表 v3「桌面工作台」:主从分栏——左侧细线行目录(单选),右侧详情面板
// (题面 + 答案要点 + 追问 + 操作),选中即看、少跳页。行内 ghost icon 动作与
// 右键菜单并存(桌面操作习惯)。官方题「添加到我的题库」= ADR-3 复制后改。
// ?m= / ?status= 深链定初始筛选;我的题库为空给引导空态。

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

const SOURCE_LABELS: Record<QuestionSource, string> = {
  manual: '手动',
  ai: 'AI 生成',
  jd: '按 JD',
  copy: '官方复制',
};

// 筛选下拉:shadcn Select(Radix 行为 + token 样式)
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
  const [searchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState<string>(() => searchParams.get('m') ?? 'all');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'due' || s === 'unseen' || s === 'mastered' ? s : 'all';
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  // v5 深化:关键词筛选(题干/考察点)+ 来源筛选(我的库)+ 笔记资产化(行标/详情预览)
  const [textFilter, setTextFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const isMy = category === MY_CATEGORY_SLUG;

  const { cat, moduleStats, allQuestions, copiedSourceIds } = useMemo(() => {
    if (!data) return { cat: null, moduleStats: {}, allQuestions: [] as QuestionData['questions'], copiedSourceIds: new Set<string>() };
    const catObj = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    // 题号取 id 第三段(agent.12.10 → 10);index 字段是小数不能拿来排序
    const qnum = (q: typeof catQuestions[number]) => parseInt(q.id.split('.')[2] ?? '0', 10);
    const all = [...catQuestions].sort((a, b) => a.module - b.module || qnum(a) - qnum(b));
    return { cat: catObj, moduleStats: getModuleStats(category, catQuestions), allQuestions: all, copiedSourceIds: getCopiedSourceIds() };
  }, [data, category]);

  // 切分类时重置
  useEffect(() => {
    setModuleFilter('all');
    setSelectedId(null);
    setTextFilter('');
    setSourceFilter('all');
  }, [category]);

  // 笔记资产化:整表读一次,行标 + 详情预览共用
  const notesMap = useMemo(() => (data ? loadNotes(category) : {}), [data, category]);
  const noteTextOf = (id: string): string => {
    const html = notesMap[id] ?? '';
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const hasNoteOf = (id: string): boolean => noteTextOf(id).length > 0;

  // ⌘K 题目搜索深链:?qid= 直接选中该题
  const qidParam = searchParams.get('qid');
  useEffect(() => {
    if (qidParam) setSelectedId(qidParam);
  }, [qidParam]);

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="题目列表" />
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!cat) {
    return (
      <div className="space-y-6">
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

  // 我的题来源(聚合层剥掉了 source,这里从 mylib 缓存查)
  const sourceOf = (id: string): QuestionSource | null => getMyQuestions().find((q) => q.id === id)?.source ?? null;

  const listQuestions = allQuestions.filter((q) => {
    if (singleModule && q.module !== singleModule.id) return false;
    if (diffFilter !== 'all' && q.difficulty !== diffFilter) return false;
    if (statusFilter !== 'all' && getQuestionStatus(category, q.id) !== statusFilter) return false;
    if (sourceFilter !== 'all' && sourceOf(q.id) !== sourceFilter) return false;
    if (textFilter.trim()) {
      const kw = textFilter.trim().toLowerCase();
      const hay = `${q.title} ${q.focus} ${q.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
  // 选中项跟随筛选结果(被筛掉则回落第一行)
  const effectiveSelectedId = listQuestions.some((q) => q.id === selectedId)
    ? selectedId
    : listQuestions[0]?.id ?? null;
  const selected = effectiveSelectedId
    ? allQuestions.find((q) => q.id === effectiveSelectedId) ?? null
    : null;

  const singleStats = singleModule ? moduleStats[singleModule.id] : null;

  const handleReset = () => {
    setModuleFilter('all');
    setDiffFilter('all');
    setStatusFilter('all');
    setTextFilter('');
    setSourceFilter('all');
  };
  const hasFilter =
    effectiveModule !== 'all' || diffFilter !== 'all' || statusFilter !== 'all' || sourceFilter !== 'all' || !!textFilter.trim();

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

  const source = selected && isMy ? sourceOf(selected.id) : null;
  const selectedCopied = selected != null && !isMy && copiedSourceIds.has(selected.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${cat.name} · 题目列表`}
        description={
          <>
            管理与查阅:选中行在右侧看题面与答案;学习、评分、写笔记去
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

      {/* 筛选行 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterSelect label="模块" value={effectiveModule} onChange={setModuleFilter} options={moduleOptions} />
        <FilterSelect label="难度" value={diffFilter} onChange={(v) => setDiffFilter(v as DiffFilter)} options={DIFF_OPTIONS} />
        <FilterSelect label="状态" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={STATUS_OPTIONS} />
        {isMy && (
          <FilterSelect
            label="来源"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { key: 'all', label: '全部来源' },
              { key: 'manual', label: '手动' },
              { key: 'ai', label: 'AI 生成' },
              { key: 'jd', label: '按 JD' },
              { key: 'copy', label: '官方复制' },
            ]}
          />
        )}
        <Input
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          placeholder="搜索题干 / 考察点…"
          aria-label="搜索题目"
          className="h-8 w-48 text-xs"
        />
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

      {/* 主从分栏:左列表(单选)+ 右详情 */}
      <div className="flex items-start gap-5">
        <div data-browse-list className="min-w-0 flex-1 rounded-md border border-border bg-card">
          {listQuestions.length === 0 ? (
            <div className="flex items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
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
              const rowSource = isMy ? sourceOf(q.id) : null;
              const isSelected = q.id === effectiveSelectedId;
              const row = (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(q.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(q.id);
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-left transition-colors last:border-b-0 ${
                    isSelected ? 'bg-accent/70' : 'hover:bg-accent/40'
                  }`}
                >
                  <span className="w-6 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="max-w-28 truncate shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {modName}
                  </span>
                  {rowSource && (
                    <span
                      title={`来源:${SOURCE_LABELS[rowSource]}`}
                      className="shrink-0 rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {SOURCE_LABELS[rowSource]}
                    </span>
                  )}
                  <span className="flex-1 truncate text-sm text-foreground">{q.title}</span>
                  {hasNoteOf(q.id) && (
                    <StickyNote className="size-3 shrink-0 text-primary/70" aria-label="有笔记" />
                  )}
                  <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                  {isMy ? (
                    <span className="flex shrink-0 items-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label="编辑"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(q.id);
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(q.id);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </span>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label={copied ? '已在我的库' : '添加到我的题库'}
                            disabled={copied || copyingId === q.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAddToMy(q);
                            }}
                          >
                            <BookmarkPlus />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{copied ? '已在我的库' : '添加到我的题库'}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              );
              return (
                // content-visibility:屏外行跳过渲染(282 题全量 DOM 保留)
                <ContextMenu key={q.id}>
                  <ContextMenuTrigger asChild>
                    <div className="[contain-intrinsic-size:auto_45px] [content-visibility:auto]">
                      {row}
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {isMy ? (
                      <>
                        <ContextMenuItem onSelect={() => setEditingId(q.id)}>编辑…</ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeletingId(q.id)}>
                          删除…
                        </ContextMenuItem>
                      </>
                    ) : (
                      <ContextMenuItem disabled={copied || copyingId === q.id} onSelect={() => void handleAddToMy(q)}>
                        {copied ? '已在我的库' : '添加到我的题库'}
                      </ContextMenuItem>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })
          )}
        </div>

        {/* 详情面板:选中行即看,少跳页 */}
        <div className="sticky top-0 hidden max-h-[calc(100vh-2rem)] w-[22rem] shrink-0 overflow-y-auto lg:block">
          {selected ? (
            <div className="rounded-md border border-border bg-card">
              <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground">{selected.id}</span>
                    {source && (
                      <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {SOURCE_LABELS[source]}
                      </span>
                    )}
                    <Badge variant="outline">{selected.difficulty}</Badge>
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{selected.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.focus}</p>
                </div>
                {isMy ? (
                  <span className="flex shrink-0 items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" aria-label="编辑" onClick={() => setEditingId(selected.id)}>
                          <Pencil />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>编辑</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label="删除" onClick={() => setDeletingId(selected.id)}>
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>删除</TooltipContent>
                    </Tooltip>
                  </span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          aria-label={selectedCopied ? '已在我的库' : '添加到我的题库'}
                          disabled={selectedCopied || copyingId === selected.id}
                          onClick={() => void handleAddToMy(selected)}
                        >
                          <BookmarkPlus />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{selectedCopied ? '已在我的库' : '添加到我的题库'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              {hasNoteOf(selected.id) && (
                <div className="border-b border-border bg-primary/5 px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <StickyNote className="size-3.5 text-primary/70" aria-hidden />
                    我的笔记
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {noteTextOf(selected.id)}
                  </p>
                </div>
              )}
              <div className="px-4 py-3">
                <AnswerPanel answer={selected.answer} followups={selected.followups} />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              选中左侧一行,在这里看题面与答案
            </div>
          )}
        </div>
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
