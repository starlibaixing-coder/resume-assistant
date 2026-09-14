// 简历(M8):编辑器版式 —— 标题栏含字数/保存状态,⌘S 保存,dirty 走全局守卫。
// 所见即所得 Markdown(Tiptap):「## 」即打即变标题;内容仍按 Markdown 存储与导入导出。
// 多份简历需后端新表(见 docs/product/desktop-backend-todo.md B6),当前单份。

import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { MarkdownEditor } from '@/components/biz/markdown-editor';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { registerSaveHook } from '@/lib/page-hooks';
import { downloadTextFile } from '@/lib/backup';
import { useProfile } from '@/lib/hooks';
import { saveProfile } from '@/lib/storage';

export function ResumePage() {
  const profile = useProfile();
  const [value, setValue] = useState(profile.resume);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      setValue(text);
      setDirty(true);
      toast.success('已导入', { description: `${file.name} · 请检查后保存` });
    } catch (e) {
      toast.error('导入失败', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const exportMd = () => {
    if (!value.trim()) {
      toast.info('简历为空,无可导出内容');
      return;
    }
    const name = `resume-${new Date().toISOString().slice(0, 10)}.md`;
    if (!downloadTextFile(name, value, 'text/markdown')) {
      toast.info('当前版本暂不支持在桌面端导出文件', { description: '文件导出能力将在后续版本提供。' });
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold">简历</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">用 Markdown 书写;按 JD 生成题目时,可勾选「结合简历出题」。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{charCount} 字</span>
          <span data-testid="resume-save-state">{dirty ? '未保存' : savedAt ? '已保存' : ''}</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> 导入 .md
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={exportMd}>
          <DownloadIcon /> 导出 .md
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = '';
          }}
        />
        <span className="flex-1" />
        <Button size="sm" onClick={save} disabled={!dirty} data-testid="resume-save-btn">
          保存 <span className="ml-0.5 text-[10px] opacity-70">⌘S</span>
        </Button>
      </div>

      <MarkdownEditor
        value={value}
        onChange={(v) => {
          setValue(v);
          setDirty(true);
        }}
        placeholder={'# 你的名字\n\n## 经历\n- …\n\n## 技能\n- …'}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card p-6 shadow-sm [&_.tiptap]:min-h-[60vh] [&_.tiptap]:bg-transparent [&_.tiptap]:p-0"
        editorClassName="text-sm leading-relaxed [&_h1]:mt-4 [&_h2]:mt-4 [&_h3]:mt-3 [&_li]:ml-5 [&_p]:my-2"
        testId="resume-editor"
      />
    </div>
  );
}
