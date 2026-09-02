import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { addManualQuestion, deleteQuestion, getMyCategory, updateQuestion, type DraftQuestion } from '@/lib/mylib';
import type { Difficulty, MyQuestion } from '@/types/question';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 编辑我的题 + 添加题目弹窗 + 删除确认。官方题不可原地改(ADR-3),先复制再改。
// 表单体抽成 QuestionFormFields 导出共用。
// 添加题目(2026-09-02 回归弹窗形态):人写即人审直接 approved(ADR-10 只约束 AI 产物),
// 来源标 'manual';打开时重算模块列表(上次创建的模块这次可选)。

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

// 模块归属:'new' = 新建模块,否则为模块号字符串
const NEW_MODULE = '__new__';

// 添加题目(手动):直接 approved(人写即人审,ADR-10 只约束 AI 产物),保存即进刷题/SM-2。
export function QuestionCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const [form, setForm] = useState<QuestionFormState>(EMPTY_FORM);
  const [modules, setModules] = useState<Array<{ id: number; name: string }>>([]);
  const [moduleTarget, setModuleTarget] = useState(NEW_MODULE);
  const [newModuleName, setNewModuleName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 打开时重算模块列表(上次创建的模块这次可选)
  useEffect(() => {
    if (open) {
      setModules(getMyCategory().modules.map((m) => ({ id: m.id, name: m.name })));
      setForm(EMPTY_FORM);
      setModuleTarget(NEW_MODULE);
      setNewModuleName('');
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const existing = modules.find((m) => String(m.id) === moduleTarget);
      const created = await addManualQuestion(formToDraft(form), existing
        ? { moduleId: existing.id, moduleName: existing.name }
        : { moduleName: newModuleName });
      onOpenChange(false);
      onCreated?.(created.id);
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
          <DialogTitle>添加题目</DialogTitle>
          <DialogDescription>手写的题不经待审核,保存后直接进我的题库与复习队列。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">归属模块</label>
            <div className="flex items-center gap-2">
              <Select value={moduleTarget} onValueChange={setModuleTarget}>
                <SelectTrigger aria-label="归属模块" className="h-9 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NEW_MODULE} className="text-xs">新建模块</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                      {String(m.id).padStart(2, '0')} · {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {moduleTarget === NEW_MODULE && (
                <Input
                  className="flex-1"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="模块名,如:面试手写"
                  aria-label="新模块名"
                />
              )}
            </div>
          </div>

          <QuestionFormFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          <FormError error={error} />
        </div>

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
