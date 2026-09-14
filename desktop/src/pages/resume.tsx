// 简历(M8/B6 多份):所见即所得 Markdown 编辑,多份切换(Select)+ 新建/重命名/删除。
// ⌘S 保存当前份,dirty 走全局守卫;切换/新建/删除前若 dirty 先经确认。存量单份由启动迁移搬入。

import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadIcon, FolderPlusIcon, PencilLineIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/biz/states';
import { MarkdownEditor } from '@/components/biz/markdown-editor';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { registerSaveHook } from '@/lib/page-hooks';
import { downloadTextFile } from '@/lib/backup';
import { useMeta, useResumes } from '@/lib/hooks';
import { addResume, deleteResume, saveResume, setMeta } from '@/lib/storage';

export function ResumePage() {
  const resumes = useResumes();
  const activeIdMeta = useMeta('resume_active_id');
  const activeId = Number(activeIdMeta);
  const active = resumes.find((r) => r.id === activeId) ?? resumes[0] ?? null;

  const [value, setValue] = useState(active?.content ?? '');
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingSwitch = useRef<(() => void) | null>(null);
  const [switchConfirmOpen, setSwitchConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const charCount = value.replace(/\s/g, '').length;

  // 切换当前份:内容跟随份变化,dirty 一并清除(切换前的确认见 guardSwitch)
  useEffect(() => {
    setValue(active?.content ?? '');
    setDirty(false);
  }, [active?.id, active?.content]);

  const save = useCallback(() => {
    if (!active) return;
    saveResume(active.id, { content: value });
    setDirty(false);
    setSavedAt(Date.now());
    toast.success('简历已保存', { description: `${active.name} · 共 ${charCount} 字` });
  }, [active, value, charCount]);

  const isDirty = useCallback(() => dirty, [dirty]);

  useEffect(() => {
    registerDirtyGuard({ id: 'resume', isDirty });
    return () => clearDirtyGuard('resume');
  }, [isDirty]);

  useEffect(() => {
    registerSaveHook(save);
    return () => registerSaveHook(null);
  }, [save]);

  /** dirty 时先确认再执行切换类动作;干净则直接执行 */
  const guardSwitch = (action: () => void) => {
    if (dirty) {
      pendingSwitch.current = action;
      setSwitchConfirmOpen(true);
      return;
    }
    action();
  };

  const discardAndRun = () => {
    setSwitchConfirmOpen(false);
    setDirty(false);
    pendingSwitch.current?.();
    pendingSwitch.current = null;
  };

  const switchTo = (id: number) => guardSwitch(() => setMeta('resume_active_id', String(id)));

  const createResume = (name?: string, content = '') =>
    guardSwitch(() => {
      const r = addResume(name ?? '未命名简历', content);
      setMeta('resume_active_id', String(r.id));
      return r;
    });

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const name = file.name.replace(/\.(md|markdown|txt)$/i, '');
      if (!active) {
        const r = addResume(name || '我的简历', text);
        setMeta('resume_active_id', String(r.id));
        setSavedAt(null);
      } else {
        setValue(text);
        setDirty(true);
      }
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

  const removeActive = () => {
    if (!active) return;
    const name = active.name;
    deleteResume(active.id);
    setConfirmDelete(false);
    setDirty(false);
    setSavedAt(null);
    toast.success('简历已删除', { description: name });
  };

  if (resumes.length === 0) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-8 py-6">
        <div>
          <h1 className="font-display text-lg font-semibold">简历</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">用 Markdown 书写;按 JD 生成题目时,可勾选「结合简历出题」。</p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            title="还没有简历"
            description="从空白开始写,或导入一份已有的 Markdown 简历。"
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <UploadIcon /> 导入 .md
                </Button>
                <Button onClick={() => createResume('我的简历')} data-testid="resume-create-btn">
                  新建简历
                </Button>
              </div>
            }
          />
        </div>
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
      </div>
    );
  }

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
        <Select value={String(active?.id ?? '')} onValueChange={(v) => switchTo(Number(v))}>
          <SelectTrigger aria-label="选择简历" data-testid="resume-select" className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {resumes.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon-sm"
          title="新建简历"
          aria-label="新建简历"
          onClick={() => createResume()}
          data-testid="resume-new-btn"
        >
          <FolderPlusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="重命名"
          aria-label="重命名简历"
          disabled={!active}
          onClick={() => {
            setRenameText(active?.name ?? '');
            setRenaming(true);
          }}
        >
          <PencilLineIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="删除"
          aria-label="删除简历"
          disabled={!active}
          onClick={() => setConfirmDelete(true)}
          data-testid="resume-delete-btn"
        >
          <Trash2Icon />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> 导入 .md
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={exportMd}>
          <DownloadIcon /> 导出 .md
        </Button>
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

      {/* 重命名 */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名简历</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="resume-rename">名称</Label>
            <Input
              id="resume-rename"
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && renameText.trim()) {
                  saveResume(active!.id, { name: renameText });
                  setRenaming(false);
                }
              }}
              placeholder="如:字节前端 / 通用版"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              取消
            </Button>
            <Button
              disabled={!renameText.trim() || renameText.trim() === active?.name}
              onClick={() => {
                saveResume(active!.id, { name: renameText });
                setRenaming(false);
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认:Esc=取消,初始焦点在取消钮 */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{active?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>这份简历会永久删除,此操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={removeActive}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* dirty 时切换/新建/删除的确认 */}
      <AlertDialog open={switchConfirmOpen} onOpenChange={setSwitchConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>有未保存的更改</AlertDialogTitle>
            <AlertDialogDescription>当前简历还未保存,放弃后将回到已保存的内容。确定要放弃吗?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={discardAndRun}>
              放弃更改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
