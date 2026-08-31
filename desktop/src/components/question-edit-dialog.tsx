import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { deleteQuestion, updateQuestion, type DraftQuestion } from '@/lib/mylib';
import type { Difficulty, MyQuestion } from '@/types/question';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// 编辑我的题 + 删除确认。官方题不可原地改(ADR-3),先复制再改。
// 表单体抽成 QuestionFormFields 导出,创建(手动加题)已迁去生题页页面级表单
// (2026-08-28 审计 A4:AI/手动同页顶层切换,不再塞 max-w-lg 弹窗)。

// 表单态:文本域形态(tags/answer/followups 是原始多行文本,提交时再拆)
export interface QuestionFormState {
  title: string;
  focus: string;
  difficulty: Difficulty;
  tags: string;
  answer: string;
  followups: string;
}

export function formStateFromQuestion(q: MyQuestion): QuestionFormState {
  return {
    title: q.title,
    focus: q.focus,
    difficulty: q.difficulty,
    tags: q.tags.join(', '),
    answer: q.answer.join('\n'),
    followups: q.followups.join('\n'),
  };
}

export function formToDraft(form: QuestionFormState): DraftQuestion {
  return {
    title: form.title.trim(),
    focus: form.focus.trim(),
    difficulty: form.difficulty,
    tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    answer: form.answer.split('\n').map((s) => s.trim()).filter(Boolean),
    followups: form.followups.split('\n').map((s) => s.trim()).filter(Boolean),
  };
}

const EMPTY_FORM: QuestionFormState = {
  title: '',
  focus: '',
  difficulty: '中',
  tags: '',
  answer: '',
  followups: '',
};

export { EMPTY_FORM };

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="text-xs text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-2">
      {error}
    </div>
  );
}

// 共享表单字段(编辑弹窗/生题页手动表单同一套);label 经 htmlFor/id 关联输入(a11y + 测试钩子)
export function QuestionFormFields({
  value,
  onChange,
}: {
  value: QuestionFormState;
  onChange: (patch: Partial<QuestionFormState>) => void;
}) {
  const uid = useId();
  const id = (name: string) => `qf-${uid}-${name}`;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={id('title')} className="text-xs text-muted-foreground">题干</label>
        <Input id={id('title')} value={value.title} onChange={(e) => onChange({ title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('focus')} className="text-xs text-muted-foreground">考察点(focus)</label>
        <Input id={id('focus')} value={value.focus} onChange={(e) => onChange({ focus: e.target.value })} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">难度</span>
        {(['初', '中', '高'] as const).map((d) => (
          <Button key={d} size="sm" variant={value.difficulty === d ? 'default' : 'outline'} onClick={() => onChange({ difficulty: d })}>
            {d}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('answer')} className="text-xs text-muted-foreground">答案要点(一行一条,合计 ≥50 字)</label>
        <Textarea id={id('answer')} className="min-h-32 font-mono text-xs" value={value.answer} onChange={(e) => onChange({ answer: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('followups')} className="text-xs text-muted-foreground">追问(一行一条,可空)</label>
        <Textarea id={id('followups')} className="min-h-16 font-mono text-xs" value={value.followups} onChange={(e) => onChange({ followups: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={id('tags')} className="text-xs text-muted-foreground">标签(逗号分隔)</label>
        <Input id={id('tags')} value={value.tags} onChange={(e) => onChange({ tags: e.target.value })} placeholder="react, hooks" />
      </div>
    </div>
  );
}

// 编辑我的题(改后再过共享校验,不过不让存)
export function QuestionEditDialog({
  question,
  open,
  onOpenChange,
}: {
  question: MyQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<QuestionFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 打开时以题面填充表单
  useEffect(() => {
    if (open && question) {
      setForm(formStateFromQuestion(question));
      setError(null);
    }
  }, [open, question]);

  if (!question) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateQuestion(question.id, formToDraft(form));
      toast.success('已保存');
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

        <QuestionFormFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        <FormError error={error} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 删除确认(级联清该题进度/笔记/代码草稿)
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
    if (!question) return;
    try {
      await deleteQuestion(question.id);
      toast.success('已删除');
    } catch (e) {
      toast.error('删除失败', { description: e instanceof Error ? e.message : String(e) });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除这道题?</DialogTitle>
          <DialogDescription>
            「{question?.title}」将从我的题库删除,该题的复习进度、笔记和代码草稿一并清除。此操作不可恢复。
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
