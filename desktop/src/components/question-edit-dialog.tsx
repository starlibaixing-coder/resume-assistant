import { useEffect, useState } from 'react';
import { deleteQuestion, updateQuestion } from '@/lib/mylib';
import type { Difficulty, MyQuestion } from '@/types/question';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

// 编辑我的题(改后再过共享校验,不过不让存)。官方题不可原地改(ADR-3),先复制再改。
export function QuestionEditDialog({
  question,
  open,
  onOpenChange,
}: {
  question: MyQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('中');
  const [tags, setTags] = useState('');
  const [answer, setAnswer] = useState('');
  const [followups, setFollowups] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 打开时以题面填充表单
  useEffect(() => {
    if (open && question) {
      setTitle(question.title);
      setFocus(question.focus);
      setDifficulty(question.difficulty);
      setTags(question.tags.join(', '));
      setAnswer(question.answer.join('\n'));
      setFollowups(question.followups.join('\n'));
      setError(null);
    }
  }, [open, question]);

  if (!question) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateQuestion(question.id, {
        title: title.trim(),
        focus: focus.trim(),
        difficulty,
        tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        answer: answer.split('\n').map((s) => s.trim()).filter(Boolean),
        followups: followups.split('\n').map((s) => s.trim()).filter(Boolean),
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑我的题</DialogTitle>
          <DialogDescription className="font-mono text-xs">{question.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">题干</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">考察点(focus)</label>
            <input className={inputCls} value={focus} onChange={(e) => setFocus(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-mono">难度</label>
            {(['初', '中', '高'] as const).map((d) => (
              <Button key={d} size="sm" variant={difficulty === d ? 'default' : 'outline'} onClick={() => setDifficulty(d)}>
                {d}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">答案要点(一行一条,合计 ≥50 字)</label>
            <textarea className={`${inputCls} min-h-32 font-mono text-xs`} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">追问(一行一条,可空)</label>
            <textarea className={`${inputCls} min-h-16 font-mono text-xs`} value={followups} onChange={(e) => setFollowups(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">标签(逗号分隔)</label>
            <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, hooks" />
          </div>
          {error && (
            <div className="text-xs text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 删除确认(级联清该题进度/笔记)
export function DeleteQuestionDialog({
  question,
  open,
  onOpenChange,
}: {
  question: MyQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const handleDelete = async () => {
    if (question) await deleteQuestion(question.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除这道题?</DialogTitle>
          <DialogDescription>
            「{question?.title}」将从我的题库删除,该题的复习进度和笔记一并清除。此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
