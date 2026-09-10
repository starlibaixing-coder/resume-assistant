// 简历(M8):编辑器版式 —— 标题栏含字数/保存状态,⌘S 保存,dirty 走全局守卫。
// 支持 Markdown(渲染端一致);提供导入(.md/.txt)、导出(.md)、预览。
// 多份简历需后端新表(见 docs/product/desktop-backend-todo.md B6),当前单份。

import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon, EyeIcon, PencilLineIcon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownText } from '@/components/biz/markdown-text';
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
  const [preview, setPreview] = useState(false);
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
      toast.info('桌面端导出需要文件对话框支持', { description: '该能力待后端补充(dialog + fs 插件),见后端 TODO。' });
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-lg font-semibold">简历</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Markdown 格式;按 JD 生成题目时可勾选「结合简历出题」。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{charCount} 字</span>
          <span data-testid="resume-save-state">{dirty ? '未保存' : savedAt ? '已保存' : ''}</span>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cnSoft(preview)}
          onClick={() => setPreview((v) => !v)}
          data-testid="resume-preview-btn"
        >
          {preview ? <PencilLineIcon /> : <EyeIcon />} {preview ? '继续编辑' : '预览'}
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
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

      {preview ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card p-6 shadow-sm"
          data-testid="resume-preview"
        >
          {value.trim() ? (
            <MarkdownText text={value} className="[&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2 first:[&_h1]:mt-0" />
          ) : (
            <p className="text-sm text-muted-foreground">简历为空,切回编辑填写。</p>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}

function cnSoft(active: boolean): string {
  return active ? 'bg-accent text-foreground' : 'text-muted-foreground';
}
