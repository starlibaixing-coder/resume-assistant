import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
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
import { usePageKeys } from '@/lib/use-page-keys';
import { AI_CHAT_URL, openAiAssistant } from '@/lib/ai-assistant';
import type { Rating, Question } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import NotePanel from '@/components/note-panel';
import CodeScratchpad from '@/components/code-scratchpad';
import { ErrorState } from '@/components/error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// 练习会话(v5 引擎 + v10 反馈闪现 + v11 全窗卡片式):
//   /session = 全窗接管:壳不渲染,本页自绘最小 chrome(进度条 + 图标位,挂 data-app-nav)。
//   中央舞台:题干升为 font-display 3xl 大字、垂直居中;底部巨型操作区(揭示/三档评分);
//   评分反馈就地语义色闪现 ~900ms 自动推进(反馈归属当前题,勿跨题残留)。
//   「不会」即时重排、撤销连带撤销重排、会话小结逐题可溯、?qid= 单题直练保留。
//   ?category= 限定;?focus=due|new|all;?limit= 题量。

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm bg-black/10 px-1.5 py-0.5 font-mono text-[11px] font-normal leading-none opacity-80">
      {children}
    </kbd>
  );
}

interface QueueEntry {
  category: string;
  id: string;
}

interface RatedItem {
  entry: QueueEntry;
  prev: CardState | null;
  rating: Rating;
  next: CardState;
  requeued: boolean;
}

const RATING_TONE: Record<Rating, { cls: string; bg: string }> = {
  不会: { cls: 'text-destructive', bg: 'bg-destructive/10' },
  模糊: { cls: 'text-warning', bg: 'bg-warning/10' },
  掌握: { cls: 'text-success', bg: 'bg-success/10' },
};

function shortDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// 会话最小 chrome(挂 data-app-nav:沉浸断言与全局锚点);沉浸时隐藏(退出按钮浮层接管)
function SessionStrip({ progress, actions }: { progress?: ReactNode; actions?: ReactNode }) {
  const { immersive } = useImmersive();
  if (immersive) return null;
  return (
    <div data-app-nav className="flex h-11 shrink-0 items-center gap-4 px-5">
      <div className="min-w-0 flex-1">{progress}</div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}

export function QuizPage({ category }: { category?: string }) {
  const { data, error, retry } = useQuestions();
  const { immersive } = useImmersive();
  const [searchParams] = useSearchParams();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false);
  // 评分反馈:归属当前题(entryKey),推进即清——不再残留到下一题
  const [lastFeedback, setLastFeedback] = useState<{ text: string; entryKey: string } | null>(null);
  // 评分后反馈闪现阶段:本题位置语义色底展示复习日期,~900ms 后自动推进
  const [flash, setFlash] = useState<{ text: string; cls: string; bg: string } | null>(null);
  const flashTimerRef = useRef<number | null>(null);
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
    // ?qid= 单题直练(题库详情「练习此题」):只保留命中的那道,limit 不适用
    const qid = searchParams.get('qid');
    if (qid) queue = queue.filter((e) => e.id === qid);
    else if (limit > 0) queue = queue.slice(0, limit);
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

  // 卸载时清掉反馈推进计时器
  useEffect(() => () => {
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
  }, []);

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
    const text = rating === '掌握' && isMastered(next)
      ? `已掌握 · ${shortDate(dueTs)} 再见`
      : `下次复习 ${shortDate(dueTs)}`;
    setLastFeedback({ text, entryKey: `${cat}:${id}` });
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
      // 仍留在本题:清空揭示,让用户再练一遍;反馈属于本题,未揭示态可见
      setRevealed(false);
      return;
    }
    // 反馈在本题位置闪现后自动推进(评分结果有了去处,也不再跨题残留)
    setFlash({ text, ...RATING_TONE[rating] });
    if (flashTimerRef.current != null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      flashTimerRef.current = null;
      setFlash(null);
      if (queueIdx < newTotal - 1) setQueueIdx(queueIdx + 1);
      else setRoundDone(true);
    }, 900);
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
    setLastFeedback(null);
    setFlash(null);
  };

  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const keyboardEnabled = !roundDone && total > 0 && !!entry && !flash;
  usePageKeys((e) => {
    const cur = entryRef.current;
    if (!cur) return;
    if (!revealedRef.current && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setRevealed(true);
    } else if (revealedRef.current && (e.key === '1' || e.key === '2' || e.key === '3')) {
      e.preventDefault();
      const ratings: Rating[] = ['不会', '模糊', '掌握'];
      handleRate(ratings[Number(e.key) - 1]);
    }
  }, keyboardEnabled);

  const catNameOf = (slug: string) =>
    slug === 'my' ? '我的题库' : data?.categories.find((c) => c.slug === slug)?.name ?? slug;

  const immersiveButton = <ImmersiveIconButton />;
  const askAiButton = <AskAiIconButton />;

  // ── 状态分支 ──
  let body: ReactNode;
  if (error) {
    body = (
      <SessionFrame actions={askAiButton}>
        <ErrorState message={error} onRetry={retry} />
      </SessionFrame>
    );
  } else if (!data) {
    body = (
      <SessionFrame>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </SessionFrame>
    );
  } else if (total === 0) {
    body = (
      <SessionFrame actions={askAiButton}>
        <SessionDoneState
          scopeName={scopeName}
          total={data.questions.filter((q) => !category || q.category === category).length}
          onReviewAll={handleNextRound}
        />
      </SessionFrame>
    );
  } else if (roundDone || !current) {
    body = (
      <SessionFrame actions={askAiButton}>
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
      </SessionFrame>
    );
  } else {
    // ── 答题主舞台 ──
    body = (
      <div className="flex h-full flex-col">
        <SessionStrip
          progress={
            <>
              <span className="font-display text-lg tabular-nums text-foreground">
                {queueIdx + 1}
                <span className="text-muted-foreground"> / {total}</span>
                {requeue.length > 0 && (
                  <span className="ml-1.5 text-[11px] text-warning">(含 {requeue.length} 题重练)</span>
                )}
              </span>
              <span className="ml-3 hidden text-xs text-muted-foreground sm:inline">
                {scopeName === '全部题库' ? `${catNameOf(current.category)} · ` : ''}
                {current.moduleName}
              </span>
            </>
          }
          actions={
            <>
              {askAiButton}
              {immersiveButton}
            </>
          }
        />
        {/* 顶部细进度线 */}
        <div
          className="h-0.5 shrink-0 bg-muted"
          role="progressbar"
          aria-label="本轮进度"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={queueIdx}
        >
          <div className="h-0.5 bg-primary/80 transition-[width] duration-300" style={{ width: `${total ? (queueIdx / total) * 100 : 0}%` }} />
        </div>

        {/* 中央舞台 */}
        <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-8">
          <div key={current.id} className="page-enter flex w-full max-w-3xl flex-col justify-center py-8">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{current.difficulty}</Badge>
              {current.tags.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
            <h1 className="font-display mt-5 text-3xl font-semibold leading-relaxed tracking-tight text-foreground">
              {current.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">{current.focus}</p>

            <div className="mt-4 flex items-center gap-0.5">
              <NotePanel category={current.category} questionId={current.id} />
              <CodeScratchpad category={current.category} questionId={current.id} question={current} />
            </div>

            {revealed && (
              <div className="mt-8">
                <AnswerPanel answer={current.answer} followups={current.followups} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevealed(false)}
                  className="mx-auto mt-3 block text-muted-foreground"
                >
                  ↑ 收起答案
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 底部巨型操作区 */}
        <div className="shrink-0 px-8 pb-9 pt-3">
          <div className="mx-auto max-w-3xl">
            {flash ? (
              <div className={cn('flex h-14 items-center justify-center rounded-xl text-lg font-semibold', flash.bg, flash.cls)}>
                {flash.text}
              </div>
            ) : revealed ? (
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="secondary"
                  title="快捷键 1"
                  className="h-14 justify-between rounded-xl px-5 text-lg font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRate('不会')}
                >
                  不会
                  <Kbd>1</Kbd>
                </Button>
                <Button
                  variant="secondary"
                  title="快捷键 2"
                  className="h-14 justify-between rounded-xl px-5 text-lg font-semibold text-warning hover:bg-warning/10 hover:text-warning"
                  onClick={() => handleRate('模糊')}
                >
                  模糊
                  <Kbd>2</Kbd>
                </Button>
                <Button
                  variant="secondary"
                  title="快捷键 3"
                  className="h-14 justify-between rounded-xl px-5 text-lg font-semibold text-success hover:bg-success/10 hover:text-success"
                  onClick={() => handleRate('掌握')}
                >
                  掌握
                  <Kbd>3</Kbd>
                </Button>
              </div>
            ) : (
              <>
                <Button
                  onClick={() => setRevealed(true)}
                  className="h-14 w-full justify-between rounded-xl px-6 text-lg font-semibold shadow-lg shadow-primary/25"
                >
                  我想好了,看答案
                  <Kbd>空格</Kbd>
                </Button>
                <div className={`mt-2 text-center text-xs ${lastFeedback?.entryKey === `${current.category}:${current.id}` ? 'text-success' : 'text-muted-foreground'}`}>
                  {lastFeedback?.entryKey === `${current.category}:${current.id}` ? lastFeedback.text : '先在脑中想清楚,再对答案'}
                </div>
              </>
            )}
            {!flash && (
              <div className="mt-2 flex items-center justify-center gap-2">
                {ratedHistory.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={handleUndo}>
                    <Undo2 className="size-3.5" aria-hidden />
                    撤销上一题
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={handleSkip}>
                  跳过本题
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative h-full', immersive && 'bg-background')}>
      {/* 沉浸模式:chrome 全隐,浮出退出按钮(Esc 之外的出口) */}
      {immersive && (
        <div className="absolute right-4 top-3 z-20">
          <ImmersiveIconButton />
        </div>
      )}
      {body}
    </div>
  );
}

// 会话通用框架:最小 chrome + 居中舞台(空态/小结/错误共用)
function SessionFrame({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <SessionStrip actions={actions} />
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-8 pb-10 pt-4">
        {children}
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
  return (
    <div className="flex w-full max-w-3xl flex-col items-center justify-center gap-3 py-24 text-center">
      <CheckCircle2 className="size-10 text-success" aria-hidden />
      <div className="font-display text-3xl font-bold tracking-tight">今日练习已完成</div>
      <p className="text-sm text-muted-foreground">{scopeName}没有待复习和待学习的题了。</p>
      <div className="mt-3 flex flex-col items-center gap-3">
        {total > 0 && <Button onClick={onReviewAll}>再过一遍(全部题)</Button>}
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-primary hover:opacity-80">回到今日</Link>
          <Link to="/library" className="text-primary hover:opacity-80">去题库</Link>
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
  const mastered = items.filter((i) => i.rating === '掌握').length;
  const failed = items.filter((i) => i.rating === '不会').length;
  const catNameOf = (slug: string) => (slug === 'my' ? '我的题库' : slug);
  return (
    <div className="w-full max-w-3xl">
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div className="font-display text-3xl font-bold tracking-tight">
          本轮完成,学了 {items.length} 道题{mastered > 0 ? `,掌握 ${mastered} 道` : ''}
          {failed > 0 ? `,${failed} 道待重练` : ''}
        </div>
        <div className="mt-2 flex flex-col items-center gap-3">
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
            <Link to="/" className="text-primary hover:opacity-80">回到今日</Link>
            <Link to="/library" className="text-primary hover:opacity-80">去题库</Link>
          </div>
        </div>
      </div>

      {/* 逐题小结:评分色点 + 题干 + 下次复习日期 */}
      <section className="mt-4 rounded-xl bg-card p-5">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">逐题回顾</h2>
        <div className="mt-2 max-h-[26rem] overflow-y-auto">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className={`w-12 shrink-0 text-xs font-medium ${RATING_TONE[item.rating].cls}`}>{item.rating}</span>
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
