import { useMemo, useState, useEffect, useRef } from 'react';
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
import { newCard, review, type CardState } from '@/lib/sm2';
import { saveCard, deleteCard, loadProgress } from '@/lib/storage';
import { loadLimit } from '@/lib/prefs';
import { isTauri } from '@/lib/secrets';
import { useImmersive } from '@/lib/immersive';
import { AI_CHAT_URL, openAiAssistant } from '@/lib/ai-assistant';
import type { Rating } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import NotePanel from '@/components/note-panel';
import CodeScratchpad from '@/components/code-scratchpad';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function QuizPage({ category }: { category: string }) {
  const { data, error, retry } = useQuestions();
  const { immersive } = useImmersive();
  const [searchParams] = useSearchParams();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false); // 本轮 N 题是否刷完
  const [round, setRound] = useState(0); // 轮次,变化时重算队列
  const [forceAll, setForceAll] = useState(false); // 提前复习:不看 due/unseen,全部题按序入队
  // 评分历史:撤销用。prev=null 表示评之前无卡,撤销要删行而非回写
  const [ratedHistory, setRatedHistory] = useState<Array<{ id: string; prev: CardState | null }>>([]);

  // 计算队列,round 变化时重算(续刷下一轮时)
  const { queue, catQuestions } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [] };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    // 每次题量:URL ?limit= 深链可覆盖,否则读全局设置(设置页「刷题」分区)
    const limitParam = searchParams.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : loadLimit();
    // 提前复习(forceAll):终态「再过一遍」发起,忽略调度全量入队
    const queue = forceAll
      ? (limit > 0 ? ids.slice(0, limit) : ids)
      : getReviewQueue(category, ids, limit).queue;
    return { queue, catQuestions };
  }, [data, category, round, searchParams, forceAll]);

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
      // 本轮刷完,显示完成态,不自动补位
      setRoundDone(true);
    }
  };

  const handleRate = (rating: Rating) => {
    if (!currentId) return;
    const existing = loadProgress(category)[currentId] ?? null;
    saveCard(category, currentId, review(existing || newCard(), rating));
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

  const handleNextRound = (force = false) => {
    setForceAll(force);
    setRound((r) => r + 1); // 触发队列重算
    setQueueIdx(0);
    setRoundDone(false);
    setRevealed(false);
    setRatedHistory([]);
  };

  // 键盘流:空格/回车翻答案,1/2/3 评分(审计 B2)。
  // 输入控件/编辑器聚焦时不抢键(与 immersive Esc 同思路);弹窗开着时不抢键。
  // revealed 经 latest-ref 读:effect 重订阅是 passive 的,可能滞后于紧邻的下一击键,
  // 闭包里的 revealed 还是旧值(空格翻开后立刻按 3 会丢)。
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
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="text-foreground">题库加载失败</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <Button size="sm" variant="outline" onClick={retry}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!data) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;
  if (!queue.length)
    return <DoneState category={category} total={catQuestions.length} onReviewAll={() => handleNextRound(true)} />;
  if (roundDone || !current)
    return (
      <RoundDoneState
        category={category}
        done={queue.length}
        canUndo={ratedHistory.length > 0}
        onUndo={handleUndo}
        onNextRound={() => handleNextRound(forceAll)}
      />
    );

  const widthClass = immersive ? 'max-w-4xl' : 'max-w-3xl';

  return (
    <div className={cn('mx-auto space-y-6', widthClass)}>
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span className="font-mono">
            {queueIdx + 1} / {queue.length}
          </span>
          <div className="flex items-center gap-1.5">
            <span>{current.moduleName}</span>
            <AskAiIconButton />
            <ImmersiveIconButton />
          </div>
        </div>
        <Progress
          value={roundDone ? 100 : queue.length ? (queueIdx / queue.length) * 100 : 0}
          className="h-1"
          aria-label="本轮进度"
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{current.difficulty}</Badge>
          {current.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>

        <div className="text-lg font-semibold text-foreground leading-snug">{current.title}</div>
        <div className="text-sm text-muted-foreground">{current.focus}</div>

        {/* 题级工具入口:笔记(右侧抽屉)/ 代码草稿纸(大弹窗),卡片上只留 ghost 图标 */}
        <div className="flex items-center gap-0.5">
          <NotePanel category={category} questionId={current.id} />
          <CodeScratchpad category={category} questionId={current.id} question={current} />
        </div>

        {!revealed ? (
          <div className="pt-2 space-y-2">
            <Button onClick={() => setRevealed(true)} className="w-full">
              我想好了，看答案<Kbd>空格</Kbd>
            </Button>
            <div className="text-xs text-muted-foreground text-center">先在脑中想清楚，再对答案</div>
          </div>
        ) : (
          <>
            <AnswerPanel answer={current.answer} followups={current.followups} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRevealed(false)}
              className="mx-auto block text-muted-foreground"
            >
              ↑ 收起答案
            </Button>
          </>
        )}
      </CardContent>
      </Card>

      {/* 操作条 sticky 吸底:长答案滚动时评分/跳过仍可达(审计 B3) */}
      <div className="sticky bottom-4 z-10 rounded-lg border border-border bg-card p-2.5 shadow-sm">
        {revealed ? (
          <div className="grid grid-cols-3 gap-2">
            <Button variant="destructive" onClick={() => handleRate('不会')}>
              不会<Kbd>1</Kbd>
            </Button>
            <Button variant="warning" onClick={() => handleRate('模糊')}>
              模糊<Kbd>2</Kbd>
            </Button>
            <Button variant="success" onClick={() => handleRate('掌握')}>
              掌握<Kbd>3</Kbd>
            </Button>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            翻答案后用 1 / 2 / 3 评分
          </div>
        )}
        <div className="mt-2 flex items-center justify-center gap-2 border-t border-border pt-2">
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

// 快捷键提示小标(空格 / 1 / 2 / 3)
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="pointer-events-none ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[10px] font-normal leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

// 问 AI:桌面壳内开 chat.qwen.ai 子 webview 窗口(已开则聚焦);
// 浏览器/web 层降级为新标签页(渲染成外链,便于与桌面行为区分)
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

// 沉浸式:隐藏侧栏/返回条(Tauri 壳内同时系统全屏),Esc 或本按钮退出;
// 该行是沉浸中唯一保留的 chrome,按钮常驻兼作退出入口
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

// 终态两态同构成:CheckCircle2 图标 + 主按钮 + 次链接(审计 B8)
function DoneState({ category, total, onReviewAll }: { category: string; total: number; onReviewAll: () => void }) {
  const { immersive } = useImmersive();
  return (
    <div className={cn('mx-auto space-y-6', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <div className="text-lg font-semibold text-foreground">今日队列已清空</div>
          <p className="text-sm text-muted-foreground">没有待复习和新题了。</p>
          <div className="mt-2 flex flex-col items-center gap-2.5">
            {total > 0 && <Button onClick={onReviewAll}>再过一遍(全部题)</Button>}
            <Link to={`/${category}/browse`} className="text-sm text-primary hover:underline">
              去浏览全部题目 →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoundDoneState({
  category,
  done,
  canUndo,
  onUndo,
  onNextRound,
}: {
  category: string;
  done: number;
  canUndo: boolean;
  onUndo: () => void;
  onNextRound: () => void;
}) {
  const { immersive } = useImmersive();
  return (
    <div className={cn('mx-auto space-y-6', immersive ? 'max-w-4xl' : 'max-w-3xl')}>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <div className="text-lg font-semibold text-foreground">本轮完成,刷了 {done} 题</div>
          <div className="mt-2 flex flex-col items-center gap-2.5">
            <Button onClick={onNextRound}>继续刷下一轮</Button>
            <div className="flex items-center gap-3 text-sm">
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
              <Link to={`/${category}/browse`} className="text-primary hover:underline">
                去浏览全部题目
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
