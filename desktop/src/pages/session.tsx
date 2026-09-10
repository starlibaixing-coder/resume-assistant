// 学习队列(M3):会话全流程 —— 进度头 / 题卡(宋体题干)/ 揭示·隐藏 / 评分 / 结果条 1s 推进
// / 重练 / 消失题说明 / 小结 / 专注模式(F,隐壳+27px 题干,Tauri 联动系统全屏)。
// 草稿纸与笔记按题挂载;问 AI 走子 webview。

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router';
import { BookOpenIcon, EyeIcon, EyeOffIcon, GraduationCapIcon, LayersIcon, LightbulbIcon, MessageCircleIcon, NotebookPenIcon, RotateCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { AnswerBlock, FollowupList } from '@/components/biz/markdown-text';
import { DifficultyBadge } from '@/components/biz/status-badge';
import { CodeScratchpad } from '@/components/biz/code-scratchpad';
import { NoteEditor } from '@/components/biz/note-editor';
import { ProgressHeader, RatingBar, ResultFlash, SummaryPanel } from '@/components/biz/session-parts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/biz/states';
import { openAskAi } from '@/lib/ai-window';
import { isFocusMode, subscribeFocus, toggleFocusMode } from '@/lib/focus';
import { useMyQuestions, useOfficialQuestions, useSession } from '@/lib/hooks';
import { buildSummary, confirmAdvance, endSession, forceUnlock, hideAnswer, rateCurrent, reveal, skipMissing, startSession } from '@/lib/session';
import { getCodeDraft, getMeta, getNote, getQuestion, getReviewStates } from '@/lib/storage';
import type { BatchSize, Question, Rating } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPE_LABEL = { review: '复习', study: '学习', again: '总复习', single: '单题练习' } as const;

export function SessionPage() {
  const navigate = useNavigate();
  const snap = useSession();
  const official = useOfficialQuestions();
  const my = useMyQuestions();
  const focus = useSyncExternalStore(subscribeFocus, isFocusMode, () => false);

  const pool = useMemo(() => [...official, ...my.filter((q) => q.status === 'approved')], [official, my]);
  const batchMeta = getMeta('batch_size');
  const batch: BatchSize = batchMeta === '20' || batchMeta === '50' || batchMeta === 'all' ? batchMeta : '50';
  const studyN = batch === 'all' ? countsNew(pool) : Math.min(countsNew(pool), Number(batch));
  const dueN = useMemo(() => pool.filter((q) => (getReviewStates().get(q.id)?.dueAt ?? Infinity) <= Date.now()).length, [pool]);

  const start = useCallback(
    (type: 'review' | 'study' | 'again') => {
      startSession({ type, questions: pool, cards: getReviewStates(), batchSize: type === 'study' ? (batch === 'all' ? 'all' : Number(batch)) : 'all' });
    },
    [pool, batch],
  );

  useEffect(() => () => forceUnlock(), []);

  if (!snap || snap.items.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-8 py-14">
          <EmptyState
            className="py-0"
            icon={<GraduationCapIcon className="size-10" strokeWidth={1.5} />}
            title="学习队列"
            description="选择一种方式开始;进行中的会话在切换页面后保留。"
          />
          <div className="grid w-full gap-2.5" data-testid="session-entries">
            <SessionEntry
              icon={<RotateCwIcon />}
              title={dueN > 0 ? `开始复习 · 到期 ${dueN} 题` : '开始复习'}
              desc="复习今天到期的题目,按记忆间隔安排。"
              disabled={dueN === 0}
              onClick={() => start('review')}
            />
            <SessionEntry
              icon={<BookOpenIcon />}
              title={studyN > 0 ? `开始学习 · ${studyN} 题` : '开始学习'}
              desc="学习还没评过分的题目,按设置的数量分批。"
              disabled={countsNew(pool) === 0}
              onClick={() => start('study')}
            />
            <SessionEntry
              icon={<LayersIcon />}
              title={`总复习(全部 ${pool.length} 题)`}
              desc="覆盖全部已入库题目,不按进度筛选,用于阶段自查。"
              disabled={pool.length === 0}
              onClick={() => start('again')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (snap.finished) {
    const summary = buildSummary();
    return (
      <div className="h-full overflow-y-auto">
        <SummaryPanel
          total={summary.total}
          mastered={summary.mastered}
          weak={summary.weak}
          entries={summary.entries.map((e) => ({
            title: getQuestion(e.qid)?.title ?? '(题目已删除)',
            final: e.final,
            isRetry: e.isRetry,
          }))}
          onFinish={() => {
            endSession();
            navigate('/');
          }}
        />
      </div>
    );
  }

  return <SessionRun snap={snap} focus={focus} />;
}

function countsNew(pool: Question[]): number {
  return pool.filter((q) => !getReviewStates().has(q.id)).length;
}

function SessionEntry({
  icon,
  title,
  desc,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-3.5 rounded-xl bg-card px-5 py-4 text-left shadow-sm transition-shadow duration-200',
        disabled ? 'opacity-50' : 'hover:shadow-md',
      )}
    >
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function SessionRun({
  snap,
  focus,
}: {
  snap: NonNullable<ReturnType<typeof useSession>>;
  focus: boolean;
}) {
  const item = snap.items[snap.index];
  const question = getQuestion(item.qid);
  const exists = !!question;

  // 消失题:自动跳过(不计小结)
  useEffect(() => {
    if (!exists && !snap.finished) {
      const t = setTimeout(() => skipMissing(), 900);
      return () => clearTimeout(t);
    }
  }, [exists, snap.finished, snap.index]);

  if (!exists) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState title="该题已被删除" description="正在跳过,不计入本次小结。" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-6 px-8 py-8">
      <ProgressHeader
        type={TYPE_LABEL[snap.type]}
        index={snap.index}
        total={snap.items.length}
        focusMode={focus}
        onToggleFocus={() => {
          void toggleFocusMode(focus ? false : undefined);
        }}
        onEnd={() => {
          forceUnlock();
          endSession();
        }}
      />

      <div className={cn('flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto', focus && 'justify-center')}>
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{question.moduleName}</span>
            <DifficultyBadge difficulty={question.difficulty} />
            {question.isCode && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">代码题</span>}
            {item.isRetry && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">重练</span>}
          </div>
          <h2
            className={cn('font-display leading-snug', focus ? 'text-[27px]' : 'text-[22px]')}
            data-testid="question-title"
          >
            {question.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">考察方向:{question.focus}</p>
        </div>

        {!snap.revealed ? (
          <Button size="lg" className="mx-auto h-12 w-64" onClick={() => reveal()} data-testid="reveal-btn">
            <EyeIcon /> 揭示答案
          </Button>
        ) : (
          <RevealedArea question={question} />
        )}
      </div>

      <ToolsRow question={question} focus={focus} />
    </div>
  );
}

function RevealedArea({ question }: { question: Question }) {
  const [flash, setFlash] = useState<Rating | null>(null);

  const onRate = (r: Rating) => {
    rateCurrent(r);
    setFlash(r);
  };

  if (flash) {
    return <ResultFlash rating={flash} onDone={() => { setFlash(null); confirmAdvance(); }} />;
  }

  return (
    <div className="flex flex-col gap-5" data-testid="revealed-area">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">答案</span>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => hideAnswer()} data-testid="hide-answer-btn">
          <EyeOffIcon /> 隐藏答案
        </Button>
      </div>
      <AnswerBlock points={question.answer} />
      <FollowupList followups={question.followups} />
      <RatingBar onRate={onRate} />
    </div>
  );
}

function ToolsRow({ question, focus }: { question: Question; focus: boolean }) {
  const [showScratch, setShowScratch] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const scratch = getCodeDraft(question.id);
  const note = getNote(question.id);

  if (focus) return null;

  return (
    <div className="flex flex-col gap-3">
      {showScratch && <CodeScratchpad key={question.id} qid={question.id} initial={scratch} className="max-h-80" />}
      {showNote && (
        <div className="rounded-lg bg-card p-3 shadow-sm">
          <NoteEditor key={question.id} qid={question.id} initial={note} />
        </div>
      )}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className={cn('text-muted-foreground', showScratch && 'bg-accent text-foreground')} onClick={() => setShowScratch((v) => !v)}>
          <LightbulbIcon /> 草稿纸
        </Button>
        <Button variant="ghost" size="sm" className={cn('text-muted-foreground', showNote && 'bg-accent text-foreground')} onClick={() => setShowNote((v) => !v)}>
          <NotebookPenIcon /> 笔记{note.trim() ? ' · 有笔记' : ''}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={async () => {
            const how = await openAskAi(question);
            toast.success(how === 'window' ? '题目已复制,可在问 AI 窗口直接粘贴' : '题目已复制,已在新标签页打开问 AI');
          }}
        >
          <MessageCircleIcon /> 问 AI
        </Button>
      </div>
    </div>
  );
}
