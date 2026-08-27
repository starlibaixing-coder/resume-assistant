import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Maximize2, MessageCircleQuestion, Minimize2 } from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue } from '@/lib/schedule';
import { newCard, review } from '@/lib/sm2';
import { saveCard, loadProgress } from '@/lib/storage';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function QuizPage({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [searchParams] = useSearchParams();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false); // 本轮 N 题是否刷完
  const [round, setRound] = useState(0); // 轮次,变化时重算队列

  // 计算队列,round 变化时重算(续刷下一轮时)
  const { queue, catQuestions } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [] };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    // 每次题量:URL ?limit= 深链可覆盖,否则读全局设置(设置页「刷题」分区)
    const limitParam = searchParams.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : loadLimit();
    return { queue: getReviewQueue(category, ids, limit).queue, catQuestions };
  }, [data, category, round, searchParams]);

  const currentId = queue[queueIdx];
  const current = catQuestions.find((q) => q.id === currentId);

  // 切题时重置展开状态
  useEffect(() => {
    setRevealed(false);
  }, [queueIdx, currentId]);

  const handleRate = (rating: Rating) => {
    if (!currentId) return;
    const existing = loadProgress(category)[currentId];
    const base = existing || newCard();
    const updated = review(base, rating);
    saveCard(category, currentId, updated);

    if (queueIdx < queue.length - 1) {
      setQueueIdx(queueIdx + 1);
    } else {
      // 本轮刷完,显示完成态,不自动补位
      setRoundDone(true);
    }
  };

  const handleNextRound = () => {
    setRound((r) => r + 1); // 触发队列重算
    setQueueIdx(0);
    setRoundDone(false);
    setRevealed(false);
  };

  if (error) return <div className="text-muted-foreground p-8 text-center">加载失败: {error}</div>;
  if (!data) return <div className="text-muted-foreground p-8 text-center">加载中…</div>;
  if (!queue.length) return <DoneState category={category} />;
  if (roundDone || !current)
    return <RoundDoneState category={category} done={queue.length} onNextRound={handleNextRound} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex justify-between items-center text-sm text-muted-foreground font-mono">
        <span>
          {queueIdx + 1} / {queue.length}
        </span>
        <div className="flex items-center gap-1.5">
          <span>{current.moduleName}</span>
          <AskAiIconButton />
          <ImmersiveIconButton />
        </div>
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

        <NotePanel category={category} questionId={current.id} />
        <CodeScratchpad category={category} questionId={current.id} />

        {!revealed ? (
          <div className="pt-2 space-y-2">
            <Button onClick={() => setRevealed(true)} className="w-full">
              我想好了，看答案
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

      {revealed && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="destructive" onClick={() => handleRate('不会')}>
            不会
          </Button>
          <Button variant="warning" onClick={() => handleRate('模糊')}>
            模糊
          </Button>
          <Button variant="success" onClick={() => handleRate('掌握')}>
            掌握
          </Button>
        </div>
      )}
    </div>
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

function DoneState({ category }: { category: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl text-success">✓</div>
        <div className="text-foreground">今日队列已清空</div>
        <Link to={`/${category}/browse`} className="inline-block text-primary hover:underline">
          去浏览全部题目 →
        </Link>
      </div>
    </div>
  );
}

function RoundDoneState({
  category,
  done,
  onNextRound,
}: {
  category: string;
  done: number;
  onNextRound: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl text-success">✓</div>
        <div className="text-foreground">本轮完成,刷了 {done} 题</div>
        <div className="flex flex-col gap-2 items-center">
          <Button onClick={onNextRound}>继续刷下一轮</Button>
          <Link to={`/${category}/browse`} className="text-primary hover:underline text-sm">
            去浏览全部题目
          </Link>
        </div>
      </div>
    </div>
  );
}
