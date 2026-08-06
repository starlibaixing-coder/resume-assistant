import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { useQuestions } from '@/lib/questions';
import { getReviewQueue } from '@/lib/schedule';
import { newCard, review } from '@/lib/sm2';
import { saveCard, loadProgress } from '@/lib/storage';
import type { Rating } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Tiptap 体积大,懒加载拆为独立 chunk
const NotePanel = lazy(() => import('./note-panel'));

export function CardView({ category }: { category: string }) {
  const { data, error } = useQuestions();
  const [queueIdx, setQueueIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [roundDone, setRoundDone] = useState(false); // 本轮 N 题是否刷完
  const [round, setRound] = useState(0); // 轮次,变化时重算队列

  // 计算队列,round 变化时重算(续刷下一轮时)
  const { queue, catQuestions } = useMemo(() => {
    if (!data) return { queue: [], catQuestions: [] };
    const catQuestions = data.questions.filter((q) => q.category === category);
    const ids = catQuestions.map((q) => q.id);
    // 从 URL 读取每次题量,默认 50,0=全部
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const limitParam = params.get('limit');
    const limit = limitParam != null ? parseInt(limitParam, 10) || 0 : 50;
    return { queue: getReviewQueue(category, ids, limit).queue, catQuestions };
  }, [data, category, round]);

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
    <div className="space-y-4">
      <a href={`#/${category}`} className="text-sm text-muted-foreground hover:text-primary font-mono">
        ← 返回
      </a>

      <div className="flex justify-between items-center text-sm text-muted-foreground font-mono">
        <span>
          {queueIdx + 1} / {queue.length}
        </span>
        <span>{current.moduleName}</span>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
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

        <Suspense fallback={<div className="text-sm text-muted-foreground">加载笔记…</div>}>
          <NotePanel category={category} questionId={current.id} />
        </Suspense>

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
      </div>

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

function DoneState({ category }: { category: string }) {
  return (
    <div className="space-y-4">
      <a href={`#/${category}`} className="text-sm text-muted-foreground hover:text-primary font-mono">
        ← 返回
      </a>
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl text-success">✓</div>
        <div className="text-foreground">今日队列已清空</div>
        <a href={`#/${category}/browse`} className="inline-block text-primary hover:underline">
          去浏览全部题目 →
        </a>
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
    <div className="space-y-4">
      <a href={`#/${category}`} className="text-sm text-muted-foreground hover:text-primary font-mono">
        ← 返回
      </a>
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl text-success">✓</div>
        <div className="text-foreground">本轮完成,刷了 {done} 题</div>
        <div className="flex flex-col gap-2 items-center">
          <Button onClick={onNextRound}>继续刷下一轮</Button>
          <a href={`#/${category}/browse`} className="text-primary hover:underline text-sm">
            去浏览全部题目
          </a>
        </div>
      </div>
    </div>
  );
}
