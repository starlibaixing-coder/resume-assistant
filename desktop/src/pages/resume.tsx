// 简历(M8):编辑器版式 —— 标题栏含字数/保存状态,⌘S 保存,dirty 走全局守卫。
// 简历内容用于「按 JD 生成 · 结合简历」。

import { useCallback, useEffect, useState } from 'react';
import { SaveIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { registerSaveHook } from '@/lib/page-hooks';
import { useProfile } from '@/lib/hooks';
import { saveProfile } from '@/lib/storage';

export function ResumePage() {
  const profile = useProfile();
  const [value, setValue] = useState(profile.resume);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const charCount = value.replace(/\s/g, '').length;

  const save = useCallback(() => {
    saveProfile({ ...profile, resume: value });
    setDirty(false);
    setSavedAt(Date.now());
    toast.success('简历已保存', { description: `共 ${charCount} 字` });
  }, [profile, value, charCount]);

  const isDirty = useCallback(() => dirty, [dirty]);

  useEffect(() => {
    registerDirtyGuard({ id: 'resume', isDirty });
    return () => clearDirtyGuard('resume');
  }, [isDirty]);

  useEffect(() => {
    registerSaveHook(save);
    return () => registerSaveHook(null);
  }, [save]);

  // 只在首次拿到持久化内容时同步一次(本地编辑不被覆盖)
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!hydrated && profile.resume) {
      setValue(profile.resume);
      setHydrated(true);
    }
  }, [profile.resume, hydrated]);

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold">简历</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Markdown 纯文本即可;出题勾选「结合简历」时会把全文交给模型。
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{charCount} 字</span>
          <span data-testid="resume-save-state">{dirty ? '未保存' : savedAt ? '已保存' : ''}</span>
          <Button size="sm" onClick={save} disabled={!dirty} data-testid="resume-save-btn">
            <SaveIcon /> 保存 <kbd className="ml-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1 text-[10px]">⌘S</kbd>
          </Button>
        </div>
      </div>

      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder={'# 你的名字\n\n## 经历\n- …\n\n## 技能\n- …'}
        className="min-h-0 flex-1 resize-none rounded-xl bg-card p-6 text-sm leading-relaxed shadow-sm"
        data-testid="resume-editor"
      />
    </div>
  );
}
