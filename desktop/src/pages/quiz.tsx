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
import { getCard, saveCard, deleteCard, loadProgress } from '@/lib/storage';
import { loadLimit } from '@/lib/prefs';
import { isTauri } from '@/lib/secrets';
import { useImmersive } from '@/lib/immersive';
import { AI_CHAT_URL, openAiAssistant } from '@/lib/ai-assistant';
import type { Rating } from '@/types/question';
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

// 学习页 v2「纸面编辑部」(2026-09-04):题目即版面主角——去卡片,题干大字排印,
// 细线分区;交互逻辑(键盘流/撤销/跳过/吸底操作条)不变。
// 吸底操作条:壳层内容区有 py-(--page-pad-y) 内边距,sticky 约束在 content-box,
// bottom-0 会悬空露出底下滚动内容(v1 目检实锤)——用负 bottom + 自身 paddingBottom
// 盖住内边距区,-mx-6 横向铺满,负 marginBottom 抵消布局高度。
// 评分/看答案按钮内置可见 kbd 提示;终态补「回到{分类}」出口。

// kbd 视觉:快捷键可见提示,样式全部走 token
function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

// 与壳层内容区内边距对齐的吸底样式(变量由 app-shell 的页容器定义)
const stickyBarStyle: CSSProperties = {
  bottom: 'calc(-1 * var(--page-pad-y, 2.5rem))',
  paddingBottom: 'var(--page-pad-y, 2.5rem)',
  marginBottom: 'calc(-1 * var(--page-pad-y, 2.5rem))',
};

export function QuizPage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  const { immersive } = useImmersive();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false); // 本轮 N 题是否学完
  const [lastFeedback, setLastFeedback] = useState<string | null>(null); // 上一次评分的调度反馈
  const [round, setRound] = useState(0); // 轮次,变化时重算队列
  // 评分历史:撤销用。prev=null 表示评之前无卡,撤销要删行而非回写
  const [ratedHistory, setRatedHistory] = useState<Array<{ id: string; prev: CardState | null }>>([]);

  // 计算队列,round 变化时重算(续学下一轮时)
  const { queue, catQuestions, catName } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [], catName: category };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    // 每次题量:URL ?limit= 深链可覆盖,否则读全局设置(设置页「学习」分区)
    const limitParam = searchParams.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : loadLimit();
    const cap = (list: string[]) => (limit > 0 ? list.slice(0, limit) : list);
    // 三种入队模式(2026-09-02:分类页「开始复习 / 开始学习 / 再过一遍」对应):
    //   focus=due 只出待复习;focus=new 只出待学习;force=all 全量(提前复习)。
    //   默认(无参数)= 到期优先、新题补位。选中的集合为空时回落默认,避免空会话。
    const r = getReviewQueue(category, ids, limit);
    let queue = r.queue;
    const focus = searchParams.get('focus');
    const force = searchParams.get('force');
    if (force === 'all') queue = cap(ids);
    else if (focus === 'due' && r.dueIds.length > 0) queue = cap(r.dueIds);
    else if (focus === 'new' && r.unseen.length > 0) queue = cap(r.unseen);
    return {
      queue,
      catQuestions,
      catName: data.categories.find((c) => c.slug === category)?.name ?? category,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, category, round, searchParams]);

  const currentId = queue[queueIdx];
  const current = catQuestions.find((q) => q.id === currentId);

  // 切题时重置展开状态
  useEffect(() => {
    setRevealed(false);
  }, [queueIdx, currentId]);

  const advance = () => {
    if (queueIdx < queue.length - 1) {
      setQueueIdx(queueIdx + 1);
    } else {
      // 本轮学完,显示完成态,不自动补位
      setRoundDone(true);
    }
  };

  const handleRate = (rating: Rating) => {
    if (!currentId) return;
    const existing = loadProgress(category)[currentId] ?? null;
    const next = review(existing || newCard(), rating);
    saveCard(category, currentId, next);
    // 闭环间隔重复的核心反馈:告诉用户这次评分让题目什么时候回来
    setLastFeedback(rating === '不会' ? '记住了,这道题明天再来' : next.interval <= 1 ? '明天再来' : next.interval === 2 ? '后天再来' : `${next.interval} 天后再见`);
    setRatedHistory((h) => [...h, { id: currentId, prev: existing }]);
    advance();
  };

  // 跳过:不动 SM-2,只前进(跳过的题本轮不再出现,下一轮调度重新算)
  const handleSkip = () => advance();

  // 撤销上一题评分:回写旧卡;首评(无旧卡)则删行
  const handleUndo = () => {
    const last = ratedHistory[ratedHistory.length - 1];
    if (!last) return;
    if (last.prev) {
      saveCard(category, last.id, last.prev);
    } else {
      deleteCard(category, last.id);
    }
    setRatedHistory((h) => h.slice(0, -1));
    setRevealed(false);
    if (roundDone) {
      // 完成态撤销:queueIdx 停在末题,直接回到那题重评
      setRoundDone(false);
    } else {
      setQueueIdx((i) => Math.max(0, i - 1));
    }
  };

  // 下一轮:mode='all' 时以全量模式重新入队(再过一遍);否则沿用 URL 里现有的 focus/force
  const handleNextRound = (mode?: 'all') => {
    if (mode === 'all') {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('force', 'all');
          return next;
        },
        { replace: true },
      );
    }
    setRound((r) => r + 1); // 触发队列重算
    setQueueIdx(0);
    setRoundDone(false);
    setRevealed(false);
    setRatedHistory([]);
  };

  // 键盘流:空格/回车翻答案,1/2/3 评分。
  // 输入控件/编辑器聚焦时不抢键;弹窗开着时不抢键。
  // revealed 经 latest-ref 读:effect 重订阅是 passive 的,可能滞后于紧邻的下一击键。
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  useEffect(() => {
    if (roundDone || !queue.length || !currentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, .ProseMirror')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      if (!revealedRef.current && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); // 空格防页面滚动
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
  if (!queue.length)
    return (
      <DoneState
        category={category}
        catName={catName}
        total={catQuestions.length}
        onReviewAll={() => handleNextRound('all')}
      />
    );
  if (roundDone || !current)
    return (
      <RoundDoneState
        category={category}
        catName={catName}
        done={queue.length}
        canUndo={ratedHistory.length > 0}
        mastered={ratedHistory.filter((h) => {
          const c = getCard(category, h.id);
          return c && isMastered(c);
        }).length}
        onUndo={handleUndo}
        onNextRound={() => handleNextRound()}
      />
    );

  const widthClass = immersive ? 'max-w-4xl' : 'max-w-3xl';

  return (
    <div className={cn('mx-auto flex min-h-full w-full flex-col gap-6', widthClass)}>
      {/* 进度行:页眉细线 */}
      <div className="border-b border-border pb-3">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">
            {queueIdx + 1} / {queue.length}
          </span>
          <div className="flex items-center gap-3">
            <span>{current.moduleName}</span>
            <span className="flex items-center gap-1">
              <AskAiIconButton />
              <ImmersiveIconButton />
            </span>
          </div>
        </div>
        <Progress
          value={roundDone ? 100 : queue.length ? (queueIdx / queue.length) * 100 : 0}
          className="mt-3 h-0.5 bg-muted ring-0"
          aria-label="本轮进度"
        />
      </div>

      {/* 题面:大字排印,版面主角 */}
      <div className="flex flex-1 flex-col justify-center py-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{current.difficulty}</Badge>
          {current.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>
        <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-foreground">
          {current.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{current.focus}</p>

        {/* 题级工具入口:笔记(右侧抽屉)/ 代码草稿纸(大弹窗),只留 ghost 图标 */}
        <div className="mt-3 flex items-center gap-0.5">
          <NotePanel category={category} questionId={current.id} />
          <CodeScratchpad category={category} questionId={current.id} question={current} />
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

      {/* 操作条:真吸底(见文件头说明),快捷键以 kbd 徽标内置在按钮里 */}
      <div
        className="sticky z-10 mt-auto -mx-6 border-t border-border bg-background/95 px-6 pt-2.5 backdrop-blur"
        style={stickyBarStyle}
      >
        {revealed ? (
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
            <Button
              variant="outline"
              title="快捷键 1"
              className="h-11 justify-between border-destructive/40 px-4 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleRate('不会')}
            >
              不会
              <Kbd>1</Kbd>
            </Button>
            <Button
              variant="outline"
              title="快捷键 2"
              className="h-11 justify-between border-warning/40 px-4 font-medium text-warning hover:bg-warning/10 hover:text-warning"
              onClick={() => handleRate('模糊')}
            >
              模糊
              <Kbd>2</Kbd>
            </Button>
            <Button
              variant="outline"
              title="快捷键 3"
              className="h-11 justify-between border-success/40 px-4 font-medium text-success hover:bg-success/10 hover:text-success"
              onClick={() => handleRate('掌握')}
            >
              掌握
              <Kbd>3</Kbd>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1.5">
            <Button onClick={() => setRevealed(true)} className="h-11 w-full justify-between px-4 font-medium">
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

// 问 AI:桌面壳内开 chat.qwen.ai 子 webview 窗口(已开则聚焦);
// 浏览器/web 层降级为新标签页
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

// 沉浸式:隐藏导航条/返回条(Tauri 壳内同时系统全屏),Esc 或本按钮退出
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

// 终态:居中刊尾式,细线上下;主按钮 + 次操作行
function DoneState({ category, catName, total, onReviewAll }: {
  category: string;
  catName: string;
  total: number;
  onReviewAll: () => void;
}) {
  const { immersive } = useImmersive();
  return (
    <div className={cn('mx-auto w-full', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <div className="flex flex-col items-center gap-3 border-y border-border py-24 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div className="text-2xl font-bold tracking-tight">今日队列已清空</div>
        <p className="text-sm text-muted-foreground">没有待复习和待学习了。</p>
        <div className="mt-3 flex flex-col items-center gap-3">
          {total > 0 && <Button onClick={onReviewAll}>再过一遍(全部题)</Button>}
          <div className="flex items-center gap-4 text-sm">
            <Link to={`/${category}`} className="text-primary hover:underline">
              回到{catName}
            </Link>
            <Link to={`/${category}/browse`} className="text-primary hover:underline">
              浏览全部题目
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundDoneState({
  category,
  catName,
  done,
  mastered,
  canUndo,
  onUndo,
  onNextRound,
}: {
  category: string;
  catName: string;
  done: number;
  mastered: number;
  canUndo: boolean;
  onUndo: () => void;
  onNextRound: () => void;
}) {
  const { immersive } = useImmersive();
  return (
    <div className={cn('mx-auto w-full', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <div className="flex flex-col items-center gap-3 border-y border-border py-24 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <div className="text-2xl font-bold tracking-tight">
          本轮完成,学了 {done} 道题{mastered > 0 ? `,掌握 ${mastered} 道` : ''}
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
            <Link to={`/${category}`} className="text-primary hover:underline">
              回到{catName}
            </Link>
            <Link to={`/${category}/browse`} className="text-primary hover:underline">
              浏览全部题目
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
