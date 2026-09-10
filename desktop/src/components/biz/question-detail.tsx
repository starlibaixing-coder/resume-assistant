// 题目详情栏(题库双栏右列):完整题面 + 笔记 + 动作(编辑/练习/复制/删除)。
// 编辑一律就地(§7.3 禁 Drawer/弹窗);删除走 AlertDialog(不可逆)。

import { useState } from 'react';
import { ClipboardCopyIcon, PencilIcon, PlayIcon, Trash2Icon } from 'lucide-react';
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
import { AnswerBlock, FollowupList, MarkdownText } from './markdown-text';
import { DifficultyBadge, StatusBadge } from './status-badge';
import { NoteEditor } from './note-editor';
import { EditQuestionForm } from './edit-question-form';
import { deriveStatus, sourceLine } from '@/lib/bank';
import { copyOfficialToMy, deleteMyQuestion, getCard, getNote } from '@/lib/storage';
import type { Question } from '@/lib/types';

export function QuestionDetail({
  question,
  onSaved,
  onDeleted,
  onCopied,
  onPractice,
}: {
  question: Question;
  onSaved: (q: Question) => void;
  onDeleted: (id: string) => void;
  onCopied: (q: Question) => void;
  onPractice: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isMy = question.origin === 'my';
  const status = deriveStatus(question, getCard(question.id), Date.now());

  if (editing && isMy) {
    return (
      <div className="p-5">
        <h3 className="mb-4 font-display text-base font-semibold">编辑题目</h3>
        <EditQuestionForm
          question={question}
          onDone={(saved) => {
            setEditing(false);
            if (saved) {
              onSaved(saved);
              toast.success('已保存');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5" data-testid="question-detail">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        <DifficultyBadge difficulty={question.difficulty} />
        {question.isCode && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">代码题</span>}
        {question.tags.map((t) => (
          <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {t}
          </span>
        ))}
      </div>

      <h3 className="font-display text-xl leading-snug">{question.title}</h3>
      <p className="text-sm text-muted-foreground">
        考察方向:{question.focus || '—'}
      </p>

      <div className="space-y-3">
        <div className="text-xs font-medium tracking-wide text-muted-foreground">答案要点</div>
        <AnswerBlock points={question.answer} />
      </div>

      <FollowupList followups={question.followups} />

      {question.origin === 'my' && (
        <div className="text-xs text-muted-foreground">
          来源:{sourceLine(question)}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button size="sm" onClick={() => onPractice(question.id)}>
          <PlayIcon /> 练习这一题
        </Button>
        {isMy && (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon /> 编辑
            </Button>
            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon /> 删除
            </Button>
          </>
        )}
        {!isMy && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const copy = copyOfficialToMy(question.id);
              if (copy) {
                toast.success('已复制到我的题库', { description: `新 id:${copy.id}` });
                onCopied(copy);
              }
            }}
          >
            <ClipboardCopyIcon /> 复制到我的题库
          </Button>
        )}
      </div>

      {isMy && question.status === 'approved' && (
        <div className="border-t border-border/60 pt-4">
          <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">笔记</div>
          <NoteEditor qid={question.id} initial={getNote(question.id)} />
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这道题?</AlertDialogTitle>
            <AlertDialogDescription>
              将同时删除该题的复习进度、笔记与草稿,此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                deleteMyQuestion(question.id);
                setConfirmDelete(false);
                onDeleted(question.id);
                toast.success('已删除');
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { MarkdownText };
