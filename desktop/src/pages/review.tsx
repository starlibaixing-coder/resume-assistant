// 审核(M6):双栏工作台 —— 左:待审核列表(created_at DESC,来源行取 source_ref 口径);
// 右:详情(可就地编辑后通过 D8)。⌘↩ 通过 / ⌫ 打开拒绝确认,焦点位于详情栏内时生效。
// 通过 = 生成正式 my.* id 转 approved;拒绝(不可逆)走 AlertDialog。

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CheckIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AnswerBlock, FollowupList } from '@/components/biz/markdown-text';
import { DifficultyBadge } from '@/components/biz/status-badge';
import { EditQuestionForm } from '@/components/biz/edit-question-form';
import { EmptyState } from '@/components/biz/states';
import { sourceLine } from '@/lib/bank';
import { registerListNav } from '@/lib/page-hooks';
import { useMyQuestions } from '@/lib/hooks';
import { approvePending, deleteMyQuestion } from '@/lib/storage';
import type { Question } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export function ReviewPage() {
  const allMy = useMyQuestions();
  const list = useMemo(
    () => allMy.filter((q) => q.status === 'pending').sort((a, b) => b.createdAt - a.createdAt),
    [allMy],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Question | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedId && !list.some((q) => q.id === selectedId)) setSelectedId(null);
  }, [list, selectedId]);

  const selected = list.find((q) => q.id === selectedId) ?? list[0] ?? null;

  useEffect(() => {
    registerListNav((dir) => {
      setSelectedId((cur) => {
        if (list.length === 0) return cur;
        const i = list.findIndex((q) => q.id === (cur ?? list[0]?.id));
        return list[Math.min(list.length - 1, Math.max(0, i + dir))]?.id ?? cur;
      });
    });
    return () => registerListNav(null);
  }, [list]);

  const approve = (q: Question) => {
    const newId = approvePending(q.id);
    if (newId) {
      toast.success('已通过,题目入库', { description: `新 id:${newId}` });
      setSelectedId(null);
    }
  };

  const reject = (q: Question) => {
    deleteMyQuestion(q.id);
    setRejecting(null);
    toast.success('已拒绝并删除');
  };

  // 详情栏聚焦时 ⌘↩ 通过 / ⌫ 拒绝(§6.4 规则 6;全局热键在可编辑焦点处让路)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const detail = detailRef.current;
      if (!detail || !selected) return;
      if (!detail.contains(document.activeElement)) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        approve(selected);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setRejecting(selected);
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 w-[46%] flex-col gap-3 px-6 py-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold">审核</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">AI 生成的题目需人工审核,通过后进入我的题库与学习队列。</p>
          </div>
          <span className="rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">待审核 {list.length}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card shadow-sm" data-testid="audit-list">
          {list.length === 0 ? (
            <EmptyState title="没有待审核的题目" description="在「添加题目」用 AI 或按 JD 生成后,会先到这里等待审核。" />
          ) : (
            <div className="divide-y divide-border/60">
              {list.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSelectedId(q.id)}
                  className={cn(
                    'relative flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50',
                    q.id === selected?.id && 'bg-accent',
                  )}
                >
                  {q.id === selected?.id && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />}
                  <span className="truncate text-sm">{q.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {sourceLine(q)} · {formatDateTime(q.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 border-l border-border/60 bg-card/40">
        {selected ? (
          <AuditDetail
            key={selected.id}
            question={selected}
            detailRef={detailRef}
            onApprove={() => approve(selected)}
            onReject={() => setRejecting(selected)}
          />
        ) : (
          <EmptyState title="选择一道待审核的题" description="左侧选中后可预览、编辑或做出裁定。" />
        )}
      </section>

      <AlertDialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>拒绝并删除这道题?</AlertDialogTitle>
            <AlertDialogDescription>拒绝后题目不会进入题库,此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => rejecting && reject(rejecting)}>
              拒绝
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AuditDetail({
  question,
  detailRef,
  onApprove,
  onReject,
}: {
  question: Question;
  detailRef: RefObject<HTMLDivElement | null>;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div ref={detailRef} tabIndex={-1} className="flex h-full flex-col gap-5 overflow-y-auto p-5 outline-none" data-testid="audit-detail">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">待审核</span>
        <DifficultyBadge difficulty={question.difficulty} />
        <span className="text-xs text-muted-foreground">{sourceLine(question)}</span>
      </div>

      {editing ? (
        <EditQuestionForm
          question={question}
          onDone={(saved) => {
            setEditing(false);
            if (saved) onApprove(); // D8:编辑后直接通过
          }}
        />
      ) : (
        <>
          <h3 className="font-display text-xl leading-snug">{question.title}</h3>
          <p className="text-sm text-muted-foreground">考察方向:{question.focus}</p>
          <AnswerBlock points={question.answer} />
          <FollowupList followups={question.followups} />
          <div className="flex gap-2 border-t border-border/60 pt-4">
            <Button onClick={onApprove} data-testid="approve-btn">
              <CheckIcon /> 通过
              <kbd className="ml-1 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 text-[10px]">⌘↩</kbd>
            </Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onReject} data-testid="reject-btn">
              <Trash2Icon /> 拒绝
              <kbd className="ml-1 rounded border border-border/70 bg-muted px-1 text-[10px]">⌫</kbd>
            </Button>
            <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setEditing(true)}>
              <PencilIcon /> 编辑后通过
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
