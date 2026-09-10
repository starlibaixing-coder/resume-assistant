// 题库(M4):双栏工作台 —— 左:分类页签 + 筛选按钮组(状态五档/难度/来源)+ 模块下拉 + 题目表(>200 虚拟滚动);
// 右:选中题详情(编辑就地)。深链 ?cat= ?qid= ?status=;↑/↓ 移动选中;分类记忆 meta.last_bank_cat。

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SearchIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/biz/states';
import { DifficultyBadge, StatusBadge } from '@/components/biz/status-badge';
import { QuestionDetail } from '@/components/biz/question-detail';
import { deriveStatus, filterQuestions, modulesOf, type DifficultyFilter, type SourceFilter, type StatusFilter } from '@/lib/bank';
import type { DerivedStatus } from '@/lib/types';
import { registerListNav } from '@/lib/page-hooks';
import { useMyQuestions, useOfficialQuestions } from '@/lib/hooks';
import { getCategories, getCard, getMeta, getReviewStates, setMeta } from '@/lib/storage';
import { startSession } from '@/lib/session';
import { STATUS_LABEL } from '@/lib/types';
import type { Question } from '@/lib/types';
import { cn } from '@/lib/utils';

type CatKey = 'fe' | 'agent' | 'my';

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const official = useOfficialQuestions();
  const my = useMyQuestions();
  const categories = getCategories();

  const lastCat = (getMeta('last_bank_cat') as CatKey) || 'fe';
  const catParam = (params.get('cat') as CatKey | null) ?? null;
  const cat: CatKey = catParam === 'fe' || catParam === 'agent' || catParam === 'my' ? catParam : categories.some((c) => c.slug === lastCat) ? lastCat : categories[0]?.slug as CatKey ?? 'fe';

  const [status, setStatus] = useState<StatusFilter>((params.get('status') as StatusFilter | null) ?? 'all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [module, setModule] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');

  const qid = params.get('qid') ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(qid);

  const pool = useMemo(() => {
    if (cat === 'my') return my;
    return official.filter((q) => q.category === cat);
  }, [cat, official, my]);

  const filtered = useMemo(
    () => filterQuestions(pool, getCardMap(), { status, difficulty, source, module, search }, Date.now()),
    [pool, status, difficulty, source, module, search],
  );

  useEffect(() => {
    if (catParam && catParam !== getMeta('last_bank_cat')) setMeta('last_bank_cat', catParam);
  }, [catParam]);

  useEffect(() => {
    if (qid) setSelectedId(qid);
  }, [qid]);

  // 选中题滚动进可视区
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest' });
  }, [selectedId, filtered.length]);

  // ↑/↓ 移动选中(全局热键转发)
  useEffect(() => {
    registerListNav((dir) => {
      setSelectedId((cur) => {
        const ids = filtered.map((q) => q.id);
        if (ids.length === 0) return cur;
        const i = ids.indexOf(cur ?? '');
        const next = Math.min(ids.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir));
        return ids[next];
      });
    });
    return () => registerListNav(null);
  }, [filtered]);

  const updateParam = (key: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v == null || v === '') next.delete(key);
    else next.set(key, v);
    setParams(next, { replace: true });
  };

  const selected = filtered.find((q) => q.id === selectedId) ?? filtered[0] ?? null;

  const practiceSingle = (id: string) => {
    startSession({ type: 'single', questions: pool, cards: getCardMap(), batchSize: 'all', singleQid: id });
    navigate('/session');
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 左栏:列表 */}
      <section className="flex min-h-0 w-[54%] min-w-0 flex-col gap-3 px-6 py-5">
        <div className="flex items-center gap-1">
          <CategoryTab
            active={cat === 'fe'}
            label={categories.find((c) => c.slug === 'fe')?.name ?? '前端'}
            onClick={() => updateParam('cat', 'fe')}
          />
          <CategoryTab
            active={cat === 'agent'}
            label={categories.find((c) => c.slug === 'agent')?.name ?? 'Agent'}
            onClick={() => updateParam('cat', 'agent')}
          />
          <CategoryTab active={cat === 'my'} label="我的题库" onClick={() => updateParam('cat', 'my')} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterGroup label="状态">
            <ChipRow
              options={[{ v: 'all', label: '全部' }, ...(Object.keys(STATUS_LABEL) as DerivedStatus[]).map((s) => ({ v: s, label: STATUS_LABEL[s] }))]}
              value={status}
              onChange={(v) => { setStatus(v as StatusFilter); updateParam('status', v === 'all' ? null : v); }}
            />
          </FilterGroup>
          <FilterGroup label="难度">
            <ChipRow
              options={[{ v: 'all', label: '全部' }, { v: '初', label: '简单' }, { v: '中', label: '中等' }, { v: '高', label: '困难' }]}
              value={difficulty}
              onChange={(v) => setDifficulty(v as DifficultyFilter)}
            />
          </FilterGroup>
          {cat === 'my' && (
            <FilterGroup label="来源">
              <ChipRow
                options={[
                  { v: 'all', label: '全部' },
                  { v: 'manual', label: '手动' }, { v: 'ai', label: 'AI' }, { v: 'jd', label: 'JD' }, { v: 'copy', label: '复制' },
                ]}
                value={source}
                onChange={(v) => setSource(v as SourceFilter)}
              />
            </FilterGroup>
          )}
          {modulesOf(pool).length > 1 && (
            <FilterGroup label="模块">
              <ModuleSelect modules={modulesOf(pool)} value={module} onChange={setModule} />
            </FilterGroup>
          )}
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索题干 / 标签" className="h-8 w-44 bg-input pl-8 text-xs" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card shadow-sm" data-testid="question-table">
          {filtered.length === 0 ? (
            <EmptyState title="没有符合筛选的题目" description="调整筛选条件,或到「添加题目」补充。" />
          ) : filtered.length > 200 ? (
            <VirtualTable questions={filtered} selectedId={selected?.id ?? null} onSelect={setSelectedId} rowRefs={rowRefs} />
          ) : (
            <div className="divide-y divide-border/60">
              {filtered.map((q) => (
                <QuestionRow key={q.id} q={q} active={q.id === selected?.id} onSelect={setSelectedId} rowRefs={rowRefs} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 右栏:详情 */}
      <section className="min-h-0 flex-1 border-l border-border/60 bg-card/40">
        {selected ? (
          <QuestionDetail
            key={selected.id}
            question={selected}
            onSaved={() => undefined}
            onDeleted={() => setSelectedId(null)}
            onCopied={(q) => {
              updateParam('cat', 'my');
              setSelectedId(q.id);
            }}
            onPractice={practiceSingle}
          />
        ) : (
          <EmptyState title="选择一道题" description="在左侧选中题目,即可查看详情与笔记。" />
        )}
      </section>
    </div>
  );
}

// getReviewStates 是活 Map,筛选与状态展示共用同一口径
function getCardMap() {
  return getReviewStates();
}

function CategoryTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-150',
        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground/80">{label}</span>
      {children}
    </div>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'cursor-pointer rounded-full px-2.5 py-1 text-xs transition-colors duration-150',
            value === o.v
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/70 text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ModuleSelect({
  modules,
  value,
  onChange,
}: {
  modules: { module: number; name: string; count: number }[];
  value: number | 'all';
  onChange: (v: number | 'all') => void;
}) {
  if (modules.length <= 1) return null;
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(v === 'all' ? 'all' : Number(v))}>
      <SelectTrigger className="h-8 w-44 text-xs" aria-label="模块筛选">
        <SelectValue placeholder="全部模块" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">全部模块</SelectItem>
        {modules.map((m) => (
          <SelectItem key={m.module} value={String(m.module)}>
            {m.name}({m.count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function QuestionRow({
  q,
  active,
  onSelect,
  rowRefs,
}: {
  q: Question;
  active: boolean;
  onSelect: (id: string) => void;
  rowRefs?: RefObject<Map<string, HTMLButtonElement>>;
}) {
  const status = deriveStatus(q, getCard(q.id), Date.now());
  return (
    <button
      type="button"
      ref={(el) => {
        if (el && rowRefs) rowRefs.current.set(q.id, el);
      }}
      onClick={() => onSelect(q.id)}
      data-testid="question-row"
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-muted/50',
        active && 'bg-accent',
      )}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />}
      <StatusBadge status={status} className="w-16 shrink-0 justify-center" />
      <span className="min-w-0 flex-1 truncate text-sm">{q.title}</span>
      <span className="hidden shrink-0 text-xs text-muted-foreground xl:block">{q.moduleName}</span>
      <DifficultyBadge difficulty={q.difficulty} />
    </button>
  );
}

/** >200 行窗口化渲染(固定行高 41px;§8.4 性能预算) */
function VirtualTable({
  questions,
  selectedId,
  onSelect,
  rowRefs,
}: {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  rowRefs: RefObject<Map<string, HTMLButtonElement>>;
}) {
  const ROW_H = 41;
  const OVERSCAN = 8;
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 40 });

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN);
    const count = Math.ceil(el.clientHeight / ROW_H) + OVERSCAN * 2;
    setRange({ start, end: Math.min(questions.length, start + count) });
  }, [questions.length]);

  return (
    <div ref={containerRef} onScroll={onScroll} className="h-full overflow-y-auto">
      <div style={{ height: questions.length * ROW_H, position: 'relative' }}>
        {questions.slice(range.start, range.end).map((q, i) => (
          <div key={q.id} style={{ position: 'absolute', top: (range.start + i) * ROW_H, left: 0, right: 0 }}>
            <QuestionRow q={q} active={q.id === selectedId} onSelect={onSelect} rowRefs={rowRefs} />
          </div>
        ))}
      </div>
    </div>
  );
}
