import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BookmarkPlus, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getModuleStats, getQuestionStatus } from '@/lib/schedule';
import { MY_CATEGORY_SLUG, getMyQuestion, copyOfficial, getCopiedSourceIds } from '@/lib/mylib';
import type { Question, QuestionData } from '@/types/question';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/page-header';
import { QuestionEditDialog, DeleteQuestionDialog } from '@/components/question-edit-dialog';

// 题目浏览 = 题库后台:一个列表 + 一条筛选栏(三个维度可组合,下拉而非按钮平铺)。
// - 模块:默认全部;筛到单个模块时,列表上方显示该模块统计 + 进度条
// - 难度:全部/初/中/高;状态:全部/未学/待复习/已掌握
// 行 = 全局序号 + 模块名小标签 + 题干 + focus 平铺 + 题目标签 + 难度 + 行尾动作区;
// 行内动作用 ghost icon 按钮 + tooltip(不占行宽、不带文字噪音):
// 官方题「添加到我的题库」(ADR-3 复制后改;已添加 = 同一按钮禁用态,hover 提示);我的题 编辑/删除。
// 答题/评分/笔记在刷题页。?m= 深链定初始模块。

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
  { key: 'unseen', label: '未学' },
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
      <span className="text-xs text-muted-foreground font-mono">{label}</span>
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
  const { data, error } = useQuestions();
  // 模块筛选:'all' 或模块号字符串;初始取 ?m= 深链
  const [searchParams] = useSearchParams();
  const [moduleFilter, setModuleFilter] = useState<string>(() => searchParams.get('m') ?? 'all');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 编辑/删除/创建 dialog 目标;官方题添加中标记
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const isMy = category === MY_CATEGORY_SLUG;

  // copiedSourceIds 随 data 重算(copyOfficial notify → useQuestions setData)
  const { cat, moduleStats, allQuestions, copiedSourceIds } = useMemo(() => {
    if (!data) return { cat: null, moduleStats: {}, allQuestions: [] as QuestionData['questions'], copiedSourceIds: new Set<string>() };
    const catObj = data.categories.find((c) => c.slug === category);
    const catQuestions = data.questions.filter((q) => q.category === category);
    // 题号取 id 第三段(agent.12.10 → 10)。index 字段是"模块.题号"小数(12.10≡12.1 会撞值),不能拿它排序
    const qnum = (q: typeof catQuestions[number]) => parseInt(q.id.split('.')[2] ?? '0', 10);
    const all = [...catQuestions].sort((a, b) => a.module - b.module || qnum(a) - qnum(b));
    return { cat: catObj, moduleStats: getModuleStats(category, catQuestions), allQuestions: all, copiedSourceIds: getCopiedSourceIds() };
  }, [data, category]);

  // 切分类时重置
  useEffect(() => {
    setModuleFilter('all');
  }, [category]);

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;
  // my 分类无 approved 题时聚合里没有它(避免卡"加载中"),给空态引导
  if (!cat) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader title="我的题库 / 题目浏览" />
        <Card>
          <CardContent className="space-y-3 py-16 text-center">
            <div className="text-foreground">我的题库还没有题</div>
            <div className="text-sm text-muted-foreground">手动写一道,或让 AI 生题(先进草稿区,通过后出现在这里)。</div>
            <div className="flex justify-center gap-2 pt-1">
              <Button asChild size="sm">
                <Link to="/generate?mode=manual">
                  <Plus className="size-3.5" aria-hidden />
                  手动加题
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/generate">
                  <Sparkles className="size-3.5" aria-hidden />
                  去生题
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const modules = cat.modules;
  // 模块筛选项(题库 meta 顺序)
  const moduleOptions = [
    { key: 'all', label: '全部模块' },
    ...modules.map((m) => ({ key: String(m.id), label: `${String(m.id).padStart(2, '0')} · ${m.name}` })),
  ];
  // 筛选值可能因数据变化失效,回退 all
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PageHeader
          title={`${cat.name} / 题目浏览`}
          subtitle={
            <>
              管理与查阅:我的题可编辑删除;刷题、评分、写笔记去
              <Link to={`/${category}/quiz`} className="mx-0.5 text-primary hover:underline">刷题页</Link>。
            </>
          }
        />
        {isMy && (
          <div className="flex shrink-0 gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/generate?mode=manual">
                <Plus className="size-3.5" aria-hidden />
                手动加题
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/generate">
                <Sparkles className="size-3.5" aria-hidden />
                去生题
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* 筛选栏:模块 / 难度 / 状态,可组合 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterSelect label="模块" value={effectiveModule} onChange={setModuleFilter} options={moduleOptions} />
        <FilterSelect label="难度" value={diffFilter} onChange={(v) => setDiffFilter(v as DiffFilter)} options={DIFF_OPTIONS} />
        <FilterSelect label="状态" value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} options={STATUS_OPTIONS} />
        <span className="ml-auto font-mono text-xs text-muted-foreground">共 {listQuestions.length} 题</span>
        {hasFilter && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleReset}>
            重置
          </Button>
        )}
      </div>

      {/* 单模块上下文:统计 + 进度 */}
      {singleModule && singleStats && (
        <div className="space-y-2">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="font-mono text-sm text-muted-foreground">
              {String(singleModule.id).padStart(2, '0')} · {singleModule.name}
            </div>
            <div className="flex gap-3 text-xs">
              <span className="text-muted-foreground">已学 {singleStats.learned}/{singleStats.total}</span>
              {singleStats.mastered > 0 && <span className="text-success">掌握 {singleStats.mastered}</span>}
              {singleStats.dueToday > 0 && <span className="text-warning">待复习 {singleStats.dueToday}</span>}
            </div>
          </div>
          <Progress
            value={singleStats.total ? Math.round((singleStats.learned / singleStats.total) * 100) : 0}
            className="h-1.5"
          />
        </div>
      )}

      {/* 题目列表 */}
      <Card className="overflow-hidden">
        {listQuestions.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">无符合条件的题</div>
        ) : (
          listQuestions.map((q, i) => {
            const modName = modules.find((m) => m.id === q.module)?.name ?? String(q.module);
            const copied = !isMy && copiedSourceIds.has(q.id);
            return (
              <div key={q.id} className="border-b border-border last:border-b-0 p-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{i + 1}</span>
                  <span className="max-w-24 truncate shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {modName}
                  </span>
                  <span className="text-sm text-foreground flex-1">{q.title}</span>
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
                <div className="mt-1 pl-1 text-xs leading-relaxed text-muted-foreground">{q.focus}</div>
                {q.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {q.tags.map((t) => (
                      <span key={t} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

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
