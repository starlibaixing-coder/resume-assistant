import { useMemo, useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  CheckCircle2,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  Undo2,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue } from '@/lib/schedule';
import { isMastered, newCard, review, type CardState } from '@/lib/sm2';
import { saveCard, deleteCard, loadProgress } from '@/lib/storage';
import { loadLimit } from '@/lib/prefs';
import { isTauri } from '@/lib/secrets';
import { useImmersive } from '@/lib/immersive';
import { AI_CHAT_URL, openAiAssistant } from '@/lib/ai-assistant';
import type { Rating, Question } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import NotePanel from '@/components/note-panel';
import CodeScratchpad from '@/components/code-scratchpad';
import { ErrorState } from '@/components/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// 练习会话 v5(引擎深化):
//   1. 「不会」即时重排——评不会的题追加到会话尾部再练一遍(每题至多一份重练副本,
//      重复评不会则移到队尾),直到评模糊/掌握才真正放行;撤销会连带撤销重排。
//   2. 评分反馈带具体日期——"下次复习 9 月 7 日",不只是"N 天后"。
//   3. 会话小结逐题可溯——每道题的评分与下次复习日期在完成态列出来,错题一目了然。
//   /session 跨全库混排;?category= 限定;?focus=due|new|all;?limit= 题量。
// 键盘流、笔记/代码草稿((分类,题id) 落库)、吸底操作条、渐隐上缘保留。

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

const stickyBarStyle: CSSProperties = {
  bottom: 'calc(-1 * var(--page-pad-y, 1.5rem))',
  paddingBottom: 'var(--page-pad-y, 1.5rem)',
  marginBottom: 'calc(-1 * var(--page-pad-y, 1.5rem))',
};

interface QueueEntry {
  category: string;
  id: string;
}

interface RatedItem {
  entry: QueueEntry;
  prev: CardState | null;
  rating: Rating;
  next: CardState;
  requeued: boolean; // 这次评分是否触发了「不会」重排
}

const RATING_COLOR: Record<Rating, string> = {
  不会: 'text-destructive',
  模糊: 'text-warning',
  掌握: 'text-success',
};

function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function QuizPage({ category }: { category?: string }) {
  const { data, error, retry } = useQuestions();
  const { immersive } = useImmersive();
  const [searchParams] = useSearchParams();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  // 「不会」重排副本(每题至多一份;重复评不会移到队尾)
  const [requeue, setRequeue] = useState<QueueEntry[]>([]);
  const [ratedHistory, setRatedHistory] = useState<RatedItem[]>([]);

  const { queue, byCat, scopeName } = useMemo(() => {
    if (!data) return { queue: [] as QueueEntry[], byCat: new Map<string, Question[]>(), scopeName: category ?? '全部题库' };
    const scopeCats = category ? [category] : data.categories.map((c) => c.slug);
    const limitParam = searchParams.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : loadLimit();
    const byCat = new Map<string, Question[]>();
    const due: QueueEntry[] = [];
    const unseen: QueueEntry[] = [];
    for (const c of scopeCats) {
      const qs = data.questions.filter((q) => q.category === c);
      if (qs.length === 0) continue;
      byCat.set(c, qs);
      const r = getReviewQueue(c, qs.map((q) => q.id), 0);
      due.push(...r.dueIds.map((id) => ({ category: c, id })));
      unseen.push(...r.unseen.map((id) => ({ category: c, id })));
    }
    const focus = searchParams.get('focus');
    const force = searchParams.get('force');
    let queue: QueueEntry[];
    if (force === 'all') {
      queue = scopeCats.flatMap((c) => (byCat.get(c) ?? []).map((q) => ({ category: c, id: q.id })));
    } else if (focus === 'due') {
      queue = due;
    } else if (focus === 'new') {
      queue = unseen;
    } else {
      queue = [...due, ...unseen];
    }
    if (limit > 0) queue = queue.slice(0, limit);
    return { queue, byCat, scopeName: category ?? '全部题库' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, category, round, searchParams]);

  const total = queue.length + requeue.length;
  const entryAt = (i: number): QueueEntry | undefined =>
    i < queue.length ? queue[i] : requeue[i - queue.length];
  const entry = entryAt(queueIdx);
  const current: Question | undefined = entry
    ? byCat.get(entry.category)?.find((q) => q.id === entry.id)
    : undefined;

  useEffect(() => {
    setRevealed(false);
  }, [queueIdx, entry?.id]);

  const advance = () => {
    if (queueIdx < total - 1) setQueueIdx(queueIdx + 1);
    else setRoundDone(true);
  };

  const handleRate = (rating: Rating) => {
    if (!entry) return;
    const { category: cat, id } = entry;
    const existing = loadProgress(cat)[id] ?? null;
    const next = review(existing || newCard(), rating);
    saveCard(cat, id, next);
    const dueTs = Date.now() + next.interval * 86_400_000;
    setLastFeedback(
      rating === '掌握' && isMastered(next)
        ? `已掌握 · ${shortDate(dueTs)} 再见`
        : `下次复习 ${shortDate(dueTs)}`,
    );
    // 「不会」即时重排:首犯追加副本;重练副本再犯移到队尾并停留在原位重练
    const inRequeueIdx = requeue.findIndex((e) => e.category === entry.category && e.id === entry.id);
    const willAdd = rating === '不会' && inRequeueIdx === -1;
    const repeatFailAtEnd = rating === '不会' && inRequeueIdx !== -1 && queueIdx === total - 1;
    const newTotal = total + (willAdd ? 1 : 0);
    if (rating === '不会') {
      setRequeue((r) => {
        const without = r.filter((e) => !(e.category === entry.category && e.id === entry.id));
        return [...without, entry];
      });
    }
    setRatedHistory((h) => [...h, { entry, prev: existing, rating, next, requeued: rating === '不会' }]);
    if (repeatFailAtEnd) {
      // 仍留在本题:清空揭示,让用户再练一遍
      setRevealed(false);
      return;
    }
    if (queueIdx < newTotal - 1) setQueueIdx(queueIdx + 1);
    else setRoundDone(true);
  };

  const handleSkip = () => advance();

  const handleUndo = () => {
    const last = ratedHistory[ratedHistory.length - 1];
    if (!last) return;
    if (last.prev) {
      saveCard(last.entry.category, last.entry.id, last.prev);
    } else {
      deleteCard(last.entry.category, last.entry.id);
    }
    // 连带撤销重排副本(移除最后一份匹配)
    let removedRequeue = false;
    if (last.requeued) {
      setRequeue((r) => {
        let i = -1;
        for (let j = r.length - 1; j >= 0; j--) {
          if (r[j].category === last.entry.category && r[j].id === last.entry.id) {
            i = j;
            break;
          }
        }
        if (i === -1) return r;
        removedRequeue = true;
        return [...r.slice(0, i), ...r.slice(i + 1)];
      });
    }
    setRatedHistory((h) => h.slice(0, -1));
    setRevealed(false);
    // 回到被撤销的那道题:基础队列里的原位;若是重排副本则退一位
    const baseIdx = queue.findIndex((e) => e.category === last.entry.category && e.id === last.entry.id);
    const target = baseIdx !== -1 && !removedRequeue ? baseIdx : Math.max(0, Math.min(queueIdx - 1, total - 1));
    if (roundDone) setRoundDone(false);
    setQueueIdx(target);
  };

  const handleNextRound = () => {
    setRound((r) => r + 1);
    setQueueIdx(0);
    setRoundDone(false);
    setRevealed(false);
    setRequeue([]);
    setRatedHistory([]);
  };

  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  useEffect(() => {
    if (roundDone || total === 0 || !entry) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, .ProseMirror')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      if (!revealedRef.current && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealedRef.current && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const ratings: Rating[] = ['不会', '模糊', '掌握'];
        handleRate(ratings[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (total === 0)
    return (
      <SessionDoneState
        scopeName={scopeName}
        total={data.questions.filter((q) => !category || q.category === category).length}
        onReviewAll={handleNextRound}
      />
    );
  if (roundDone || !current)
    return (
      <RoundDoneState
        items={ratedHistory.map((h) => {
          const q = byCat.get(h.entry.category)?.find((x) => x.id === h.entry.id);
          return {
            title: q?.title ?? h.entry.id,
            categoryName: h.entry.category,
            rating: h.rating,
            due: h.next.due,
          };
        })}
        canUndo={ratedHistory.length > 0}
        onUndo={handleUndo}
        onNextRound={handleNextRound}
      />
    );

  const widthClass = immersive ? 'max-w-4xl' : 'max-w-3xl';
  const catNameOf = (slug: string) =>
    slug === 'my' ? '我的题库' : data.categories.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className={cn('mx-auto flex w-full flex-1 flex-col gap-5', widthClass)}>
      {/* 会话进度行 */}
      <div className="border-b border-border pb-3">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span className="font-display text-lg tabular-nums text-foreground">
            {queueIdx + 1}
            <span className="text-muted-foreground"> / {total}</span>
            {requeue.length > 0 && (
              <span className="ml-1.5 text-[11px] text-warning">(含 {requeue.length} 题重练)</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span>
              {scopeName === '全部题库' ? `${catNameOf(current.category)} · ` : ''}
              {current.moduleName}
            </span>
            <span className="flex items-center gap-1">
              <AskAiIconButton />
              <ImmersiveIconButton />
            </span>
          </div>
        </div>
        <Progress
          value={roundDone ? 100 : total ? (queueIdx / total) * 100 : 0}
          className="mt-3 h-0.5 bg-muted ring-0"
          aria-label="本轮进度"
        />
      </div>

      {/* 题面 */}
      <div key={current.id} className="page-enter flex flex-1 flex-col justify-center py-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{current.difficulty}</Badge>
          {current.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="font-display mt-4 text-2xl font-semibold leading-relaxed tracking-tight text-foreground">
          {current.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{current.focus}</p>

        <div className="mt-3 flex items-center gap-0.5">
          <NotePanel category={current.category} questionId={current.id} />
          <CodeScratchpad category={current.category} questionId={current.id} question={current} />
        </div>

        {revealed && (
          <div className="mt-6">
            <AnswerPanel answer={current.answer} followups={current.followups} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevealed(false)}
              className="mx-auto mt-2 block text-muted-foreground"
            >
              ↑ 收起答案
            </Button>
          </div>
        )}
      </div>

      {/* 操作条:真吸底 + 顶缘渐隐 */}
      <div
        className="sticky z-10 mt-auto -mx-6 border-t border-border bg-background px-6 pt-2.5"
        style={stickyBarStyle}
      >
        <div
          className="pointer-events-none absolute -top-8 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent"
          aria-hidden
        />
        {revealed ? (
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
            <Button
              variant="outline"
              title="快捷键 1"
              className="h-12 justify-between rounded-lg border-destructive/40 px-4 text-base font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleRate('不会')}
            >
              不会
              <Kbd>1</Kbd>
            </Button>
            <Button
              variant="outline"
              title="快捷键 2"
              className="h-12 justify-between rounded-lg border-warning/40 px-4 text-base font-semibold text-warning hover:bg-warning/10 hover:text-warning"
              onClick={() => handleRate('模糊')}
            >
              模糊
              <Kbd>2</Kbd>
            </Button>
            <Button
              variant="outline"
              title="快捷键 3"
              className="h-12 justify-between rounded-lg border-success/40 px-4 text-base font-semibold text-success hover:bg-success/10 hover:text-success"
              onClick={() => handleRate('掌握')}
            >
              掌握
              <Kbd>3</Kbd>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5">
            <Button onClick={() => setRevealed(true)} className="h-12 w-full justify-between rounded-lg px-4 text-base font-semibold shadow-lg shadow-primary/20">
              我想好了,看答案
              <Kbd>空格</Kbd>
            </Button>
            <div className={`text-center text-[11px] ${lastFeedback ? 'text-success' : 'text-muted-foreground'}`}>
              {lastFeedback ?? '先在脑中想清楚,再对答案'}
            </div>
          </div>
        )}
        <div className="mx-auto mt-1.5 flex max-w-3xl items-center justify-center gap-2">
          {ratedHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={handleUndo}
            >
              <Undo2 className="size-3.5" aria-hidden />
              撤销上一题
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={handleSkip}
          >
            跳过本题
          </Button>
        </div>
      </div>
    </div>
  );
}

// 问 AI:桌面壳内开子 webview;浏览器降级新标签页
function AskAiIconButton() {
  if (!isTauri()) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={AI_CHAT_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="问 AI(浏览器打开)"
            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <MessageCircleQuestion aria-hidden />
          </a>
        </TooltipTrigger>
        <TooltipContent>问 AI(浏览器打开)</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label="问 AI"
          onClick={() => void openAiAssistant()}
        >
          <MessageCircleQuestion aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>问 AI</TooltipContent>
    </Tooltip>
  );
}

function ImmersiveIconButton() {
  const { immersive, toggle } = useImmersive();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground"
          aria-label={immersive ? '退出沉浸模式' : '沉浸模式'}
          onClick={toggle}
        >
          {immersive ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{immersive ? '退出沉浸模式(Esc)' : '沉浸模式'}</TooltipContent>
    </Tooltip>
  );
}

// 会话空态
function SessionDoneState({ scopeName, total, onReviewAll }: {
  scopeName: string;
  total: number;
  onReviewAll: () => void;
}) {
  const { immersive } = useImmersive();
  return (
    <div className={cn('mx-auto w-full', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <div className="flex flex-col items-center gap-3 border-y border-border py-24 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div className="text-2xl font-bold tracking-tight">今日练习已完成</div>
        <p className="text-sm text-muted-foreground">{scopeName}没有待复习和待学习的题了。</p>
        <div className="mt-3 flex flex-col items-center gap-3">
          {total > 0 && <Button onClick={onReviewAll}>再过一遍(全部题)</Button>}
          <div className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-primary hover:underline">回到今日</Link>
            <Link to="/library" className="text-primary hover:underline">去题库</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// 会话小结:逐题可溯——每题的评分与下次复习日期;错题一目了然
function RoundDoneState({
  items,
  canUndo,
  onUndo,
  onNextRound,
}: {
  items: Array<{ title: string; categoryName: string; rating: Rating; due: number }>;
  canUndo: boolean;
  onUndo: () => void;
  onNextRound: () => void;
}) {
  const { immersive } = useImmersive();
  const mastered = items.filter((i) => i.rating === '掌握').length;
  const failed = items.filter((i) => i.rating === '不会').length;
  const catNameOf = (slug: string) => (slug === 'my' ? '我的题库' : slug);
  return (
    <div className={cn('mx-auto w-full', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <div className="border-y border-border py-12 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <div className="mt-3 text-2xl font-bold tracking-tight">
          本轮完成,学了 {items.length} 道题{mastered > 0 ? `,掌握 ${mastered} 道` : ''}
          {failed > 0 ? `,${failed} 道待重练` : ''}
        </div>
        <div className="mt-3 flex flex-col items-center gap-3">
          <Button onClick={onNextRound}>继续学下一轮</Button>
          <div className="flex items-center gap-4 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <Undo2 className="size-3.5" aria-hidden />
              撤销最后一题
            </Button>
            <Link to="/" className="text-primary hover:underline">回到今日</Link>
            <Link to="/library" className="text-primary hover:underline">去题库</Link>
          </div>
        </div>
      </div>

      {/* 逐题小结:评分色点 + 题干 + 下次复习日期 */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">逐题回顾</h2>
        <div className="mt-2 max-h-[28rem] overflow-y-auto border-t border-border">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
              <span className={`w-12 shrink-0 text-xs font-medium ${RATING_COLOR[item.rating]}`}>{item.rating}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{item.title}</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{catNameOf(item.categoryName)}</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{shortDate(item.due)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
