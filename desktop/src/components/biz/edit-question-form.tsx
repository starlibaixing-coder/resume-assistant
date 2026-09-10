// 题目编辑表单(M4 就地编辑 / M6 审核编辑后通过共用):dirty 走全局守卫。
// 校验:题干/focus 非空、答案合计 ≥50 字(与题库共享预检同口径)。

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { saveMyQuestion } from '@/lib/storage';
import type { Difficulty, Question } from '@/lib/types';

export interface QuestionDraft {
  moduleName: string;
  difficulty: Difficulty;
  title: string;
  focus: string;
  answerText: string; // 每行一个要点
  followupsText: string; // 每行一条
  tagsText: string; // 逗号分隔
}

export function draftOf(q: Question): QuestionDraft {
  return {
    moduleName: q.moduleName,
    difficulty: q.difficulty,
    title: q.title,
    focus: q.focus,
    answerText: q.answer.join('\n'),
    followupsText: q.followups.join('\n'),
    tagsText: q.tags.join(', '),
  };
}

export function validateDraft(d: QuestionDraft): string[] {
  const errors: string[] = [];
  if (!d.title.trim()) errors.push('题干不能为空');
  if (!d.focus.trim()) errors.push('考察方向不能为空');
  const len = d.answerText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('').length;
  if (len < 50) errors.push(`答案合计过短(${len} 字,至少 50 字)`);
  if (!d.moduleName.trim()) errors.push('模块名不能为空');
  return errors;
}

export function applyDraft(q: Question, d: QuestionDraft): Question {
  return {
    ...q,
    moduleName: d.moduleName.trim(),
    difficulty: d.difficulty,
    title: d.title.trim(),
    focus: d.focus.trim(),
    answer: d.answerText.split('\n').map((s) => s.trim()).filter(Boolean),
    followups: d.followupsText.split('\n').map((s) => s.trim()).filter(Boolean),
    tags: d.tagsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    updatedAt: Date.now(),
  };
}

export function QuestionFormFields({
  draft,
  onChange,
  idPrefix,
}: {
  draft: QuestionDraft;
  onChange: (d: QuestionDraft) => void;
  idPrefix: string;
}) {
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-2">
        <Label htmlFor={`${idPrefix}-module`}>模块名</Label>
        <Input id={`${idPrefix}-module`} value={draft.moduleName} onChange={(e) => set({ moduleName: e.target.value })} />
        <Label>难度</Label>
        <RadioGroup
          value={draft.difficulty}
          onValueChange={(v) => set({ difficulty: v as Difficulty })}
          className="flex gap-5"
        >
          {(['初', '中', '高'] as const).map((d) => (
            <span key={d} className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value={d} id={`${idPrefix}-diff-${d}`} />
              <Label htmlFor={`${idPrefix}-diff-${d}`} className="font-normal">
                {d}
              </Label>
            </span>
          ))}
        </RadioGroup>
        <Label htmlFor={`${idPrefix}-title`} className="self-start pt-1.5">
          <span className="text-destructive">*</span> 题干
        </Label>
        <Textarea id={`${idPrefix}-title`} value={draft.title} onChange={(e) => set({ title: e.target.value })} className="min-h-16" />
        <Label htmlFor={`${idPrefix}-focus`} className="self-start pt-1.5">
          <span className="text-destructive">*</span> 考察方向
        </Label>
        <Input id={`${idPrefix}-focus`} value={draft.focus} onChange={(e) => set({ focus: e.target.value })} />
        <Label htmlFor={`${idPrefix}-answer`} className="self-start pt-1.5">
          <span className="text-destructive">*</span> 答案要点
        </Label>
        <Textarea
          id={`${idPrefix}-answer`}
          value={draft.answerText}
          onChange={(e) => set({ answerText: e.target.value })}
          className="min-h-32"
          placeholder="每行一个要点"
        />
        <Label htmlFor={`${idPrefix}-followups`} className="self-start pt-1.5">
          追问
        </Label>
        <Textarea
          id={`${idPrefix}-followups`}
          value={draft.followupsText}
          onChange={(e) => set({ followupsText: e.target.value })}
          className="min-h-16"
          placeholder="每行一条,不给主答案提示"
        />
        <Label htmlFor={`${idPrefix}-tags`}>标签</Label>
        <Input id={`${idPrefix}-tags`} value={draft.tagsText} onChange={(e) => set({ tagsText: e.target.value })} placeholder="逗号分隔,如:必问, 手写" />
      </div>
    </div>
  );
}

/** 就地编辑态:挂在题库/审核详情栏;dirty 注册全局守卫 */
export function EditQuestionForm({
  question,
  onDone,
}: {
  question: Question;
  onDone: (saved: Question | null) => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(() => draftOf(question));
  const [errors, setErrors] = useState<string[]>([]);

  const isDirty = useCallback(() => draftOf(question).title !== draft.title
      || draftOf(question).focus !== draft.focus
      || draftOf(question).answerText !== draft.answerText
      || draftOf(question).followupsText !== draft.followupsText
      || draftOf(question).tagsText !== draft.tagsText
      || draftOf(question).moduleName !== draft.moduleName
      || draftOf(question).difficulty !== draft.difficulty,
    [draft, question]);

  useEffect(() => {
    registerDirtyGuard({ id: `edit-${question.id}`, isDirty });
    return () => clearDirtyGuard(`edit-${question.id}`);
  }, [isDirty, question.id]);

  const save = () => {
    const errs = validateDraft(draft);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    const next = applyDraft(question, draft);
    saveMyQuestion(next);
    clearDirtyGuard(`edit-${question.id}`);
    onDone(next);
  };

  return (
    <div className="space-y-4" data-testid="edit-question-form">
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <QuestionFormFields draft={draft} onChange={setDraft} idPrefix={`edit-${question.id}`} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { clearDirtyGuard(`edit-${question.id}`); onDone(null); }}>
          取消
        </Button>
        <Button onClick={save}>保存</Button>
      </div>
    </div>
  );
}
