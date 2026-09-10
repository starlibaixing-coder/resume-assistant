// 题目表单字段(添加题目 / 题库编辑 / 审核编辑共用):
// 标签在字段上方、统一间距;答案要点与追问支持 Markdown(与渲染端一致),答案可预览。
// 校验:题干/focus 非空、答案合计 ≥50 字(与题库共享预检同口径)。

import { useCallback, useEffect, useState } from 'react';
import { EyeIcon, PencilLineIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AnswerBlock } from '@/components/biz/markdown-text';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { saveMyQuestion } from '@/lib/storage';
import type { Difficulty, Question } from '@/lib/types';

export interface QuestionDraft {
  moduleName: string;
  difficulty: Difficulty;
  title: string;
  focus: string;
  answerText: string; // 每行一个要点,支持 Markdown
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

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {required && <span className="text-destructive">*</span>} {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  );
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
  const [preview, setPreview] = useState(false);
  const answerLines = draft.answerText.split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="模块名">
          <Input id={`${idPrefix}-module`} value={draft.moduleName} onChange={(e) => set({ moduleName: e.target.value })} placeholder="如:JS 原理 / 自定义" />
        </Field>
        <Field label="难度">
          <RadioGroup value={draft.difficulty} onValueChange={(v) => set({ difficulty: v as Difficulty })} className="flex h-9 items-center gap-5">
            {([['初', '简单'], ['中', '中等'], ['高', '困难']] as const).map(([d, label]) => (
              <span key={d} className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value={d} id={`${idPrefix}-diff-${d}`} />
                <Label htmlFor={`${idPrefix}-diff-${d}`} className="font-normal">
                  {label}
                </Label>
              </span>
            ))}
          </RadioGroup>
        </Field>
      </div>

      <Field label="题干" required>
        <Textarea id={`${idPrefix}-title`} value={draft.title} onChange={(e) => set({ title: e.target.value })} className="min-h-16" placeholder="一道题只问一个概念" />
      </Field>

      <Field label="考察方向" required>
        <Input id={`${idPrefix}-focus`} value={draft.focus} onChange={(e) => set({ focus: e.target.value })} placeholder="这道题想验证什么能力" />
      </Field>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>
            <span className="text-destructive">*</span> 答案要点
            <span className="font-normal text-muted-foreground">(每行一个要点,支持 Markdown:**粗体**、`代码`)</span>
          </Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setPreview((v) => !v)}>
            {preview ? <PencilLineIcon /> : <EyeIcon />} {preview ? '继续编辑' : '预览'}
          </Button>
        </div>
        {preview ? (
          <div className="min-h-32 rounded-md bg-input/50 p-3">
            {answerLines.length > 0 ? <AnswerBlock points={answerLines} /> : <p className="text-sm text-muted-foreground">暂无内容</p>}
          </div>
        ) : (
          <Textarea
            id={`${idPrefix}-answer`}
            value={draft.answerText}
            onChange={(e) => set({ answerText: e.target.value })}
            className="min-h-36"
            placeholder={'主流架构:Decoder-only Transformer…\n核心:注意力机制(Self-Attention)…'}
          />
        )}
      </div>

      <Field label="追问" hint="(每行一条,不给主答案提示)">
        <Textarea
          id={`${idPrefix}-followups`}
          value={draft.followupsText}
          onChange={(e) => set({ followupsText: e.target.value })}
          className="min-h-16"
          placeholder="如:箭头函数能用 call 改变 this 吗?"
        />
      </Field>

      <Field label="标签" hint="(逗号分隔)">
        <Input id={`${idPrefix}-tags`} value={draft.tagsText} onChange={(e) => set({ tagsText: e.target.value })} placeholder="必问, 手写" />
      </Field>
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
