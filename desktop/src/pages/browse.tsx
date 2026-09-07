import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BookmarkPlus, LibraryBig, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion, getMyQuestions, copyOfficial, getCopiedSourceIds, updateQuestion } from '@/lib/mylib';
import { loadNotes } from '@/lib/storage';
import { usePageKeys } from '@/lib/use-page-keys';
import type { Question, QuestionData, QuestionSource } from '@/types/question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { AnswerPanel } from '@/components/answer-panel';
import { TwoPane } from '@/components/two-pane';
import {
  DeleteQuestionDialog,
  QuestionFormFields,
  formStateFromQuestion,
  formToDraft,
  type QuestionFormState,
} from '@/components/question-edit-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 题目列表(v10 交互重做「三栏工作台」):选行 → 右侧详情就地操作。
//   一套语法:点击/↑↓ 选中行,详情栏看题面与答案;编辑=详情栏就地变表单;
//   删除=AlertDialog(不可逆统一防线);练习此题=带 ?qid= 深链进会话。
//   此前行内 ghost icon + 右键菜单 + 键盘字母三套动作并行,收敛为「选中 + 详情动作」一套。
// ?m= / ?status= / ?qid= 深链;官方题「添加到我的题库」= ADR-3 复制后改。

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

// 芯片筛选:可切换小圆片,一次点击直达、状态一目了然
function ChipGroup({
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
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={`cursor-pointer rounded-full px-2.5 py-1 text-xs transition-colors ${
              value === o.key
                ? 'bg-primary font-medium text-primary-foreground'
                : 'bg-secondary/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// 详情栏就地编辑(替代编辑弹窗):保存走共享校验,取消即回详情
function QuestionInlineEdit({ questionId, onSaved, onCancel }: {
  questionId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const question = getMyQuestion(questionId);
  const [form, setForm] = useState<QuestionFormState>(() =>
    question ? formStateFromQuestion(question) : { title: '', focus: '', difficulty: '中', tags: '', answer: '', followups: '' },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!question) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateQuestion(question.id, formToDraft(form));
      toast.success('修改已保存');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">编辑我的题</h2>
        <span className="font-mono text-[11px] text-muted-foreground">{question.id}</span>
      </div>
      <div className="mt-3">
        <QuestionFormFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>取消</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存修改'}</Button>
      </div>
    </div>
  );
}

export function BrowsePage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  const navigate = useNavigate();
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
  // <lg 详情覆盖层:行点击展开(桌面端常驻详情栏,不受影响)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
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
    setEditingId(null);
    setMobileDetailOpen(false);
  }, [category]);

  // 笔记资产化:整表读一次,行标 + 详情预览共用
  const notesMap = useMemo(() => (data ? loadNotes(category) : {}), [data, category]);
  const noteTextOf = (id: string): string => {
    const html = notesMap[id] ?? '';
    return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const hasNoteOf = (id: string): boolean => noteTextOf(id).length > 0;

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!cat) {
    return (
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

  const selectRow = (id: string) => {
    setSelectedId(id);
    setEditingId(null);
    setMobileDetailOpen(true);
  };

  // 键盘导航(v10 经 usePageKeys:守卫集中、监听稳定):↑↓ 选择,Enter 练习,
  // E 编辑 / D 删除(我的库)/ C 复制(官方题)
  const keyboardList = listQuestions;
  usePageKeys((e) => {
    if (keyboardList.length === 0) return;
    const idx = keyboardList.findIndex((x) => x.id === effectiveSelectedId);
    const move = (d: number) => {
      e.preventDefault();
      const next = keyboardList[Math.min(Math.max(idx + d, 0), keyboardList.length - 1)];
      setSelectedId(next.id);
    };
    if (e.key === 'ArrowDown') return move(1);
    if (e.key === 'ArrowUp') return move(-1);
    if (!effectiveSelectedId) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      navigate(`/session?category=${category}&qid=${encodeURIComponent(effectiveSelectedId)}`);
    } else if ((e.key === 'e' || e.key === 'E') && isMy) {
      e.preventDefault();
      setEditingId(effectiveSelectedId);
    } else if ((e.key === 'd' || e.key === 'D') && isMy) {
      e.preventDefault();
      setDeletingId(effectiveSelectedId);
    } else if ((e.key === 'c' || e.key === 'C') && !isMy) {
      const target = keyboardList.find((x) => x.id === effectiveSelectedId);
      if (target && !copiedSourceIds.has(target.id)) void handleAddToMy(target);
    }
  });

  // ⌘K 题目搜索深链:?qid= 直接选中该题
  const qidParam = searchParams.get('qid');
  useEffect(() => {
    if (qidParam) setSelectedId(qidParam);
  }, [qidParam]);

  const source = selected && isMy ? sourceOf(selected.id) : null;
  const selectedCopied = selected != null && !isMy && copiedSourceIds.has(selected.id);
  const isEditing = editingId != null;

  // 详情内容(桌面详情栏与 <lg 覆盖层共用)
  const detailContent = isEditing && editingId ? (
    <QuestionInlineEdit
      questionId={editingId}
      onSaved={() => setEditingId(null)}
      onCancel={() => setEditingId(null)}
    />
  ) : selected ? (
    <div className="rounded-md bg-card">
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{selected.id}</span>
            {source && (
              <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {SOURCE_LABELS[source]}
              </span>
            )}
            <Badge variant="secondary">{selected.difficulty}</Badge>
          </div>
          <h2 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{selected.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{selected.focus}</p>
        </div>
      </div>

      {/* 就地操作:详情栏即动作位(练习此题 = 深链单题会话) */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <Button
          size="sm"
          onClick={() => navigate(`/session?category=${category}&qid=${encodeURIComponent(selected.id)}`)}
        >
          练习此题
        </Button>
        {isMy ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditingId(selected.id)}>
              <Pencil className="size-3.5" aria-hidden />
              编辑
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeletingId(selected.id)}>
              <Trash2 className="size-3.5" aria-hidden />
              删除
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={selectedCopied || copyingId === selected.id}
            onClick={() => void handleAddToMy(selected)}
          >
            <BookmarkPlus className="size-3.5" aria-hidden />
            {selectedCopied ? '已在我的库' : '添加到我的题库'}
          </Button>
        )}
      </div>

      {hasNoteOf(selected.id) && (
        <div className="mt-3 bg-primary/5 px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <StickyNote className="size-3.5 text-primary/70" aria-hidden />
            我的笔记
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {noteTextOf(selected.id)}
          </p>
        </div>
      )}
      <div className="px-4 pb-4 pt-3">
        <AnswerPanel answer={selected.answer} followups={selected.followups} />
      </div>
    </div>
  ) : (
    <div className="rounded-md bg-secondary/60 px-4 py-10 text-center text-sm text-muted-foreground">
      选中左侧一行,在这里看题面与答案
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 筛选行:模块下拉 + 难度/状态/来源芯片 + 关键词 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterSelect label="模块" value={effectiveModule} onChange={setModuleFilter} options={moduleOptions} />
        <ChipGroup label="难度" value={diffFilter} onChange={(v) => setDiffFilter(v as DiffFilter)} options={DIFF_OPTIONS} />
        <ChipGroup label="状态" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={STATUS_OPTIONS} />
        {isMy && (
          <ChipGroup
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

      {/* 双栏工作台:左列表(单选)+ 右详情(就地操作) */}
      <TwoPane
        listTestId="browse-list"
        mobileOpen={mobileDetailOpen && !!selected}
        onCloseMobile={() => setMobileDetailOpen(false)}
        list={
          <div className="rounded-md bg-card">
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
                const rowSource = isMy ? sourceOf(q.id) : null;
                const isSelected = q.id === effectiveSelectedId;
                return (
                  <div
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => selectRow(q.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectRow(q.id);
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-2.5 border-b px-3 py-2 text-left transition-colors last:border-b-0 ${
                      isSelected ? 'bg-accent/70' : 'hover:bg-accent/60'
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
                    <Badge variant="secondary" className="shrink-0">{q.difficulty}</Badge>
                  </div>
                );
              })
            )}
          </div>
        }
        detail={detailContent}
      />

      {/* 删除确认:级联清该题进度/笔记/代码草稿;不可逆统一 AlertDialog */}
      <DeleteQuestionDialog
        question={deletingId ? getMyQuestion(deletingId) : null}
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
      />
    </div>
  );
}
