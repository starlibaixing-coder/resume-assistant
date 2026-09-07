import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Inbox, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { getProfile, saveProfile, type JobProfile } from '@/lib/profile';
import {
  addJd,
  deleteJd,
  getJds,
  updateJd,
  subscribeJds,
  type Jd,
} from '@/lib/jd';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

// 求职中枢(v7 重设计):
//   JD 管理 = 双列卡片栅格,每张卡即一个目标岗位——题干信息一眼可读,
//   「按 JD 生成题目」是卡片主按钮,编辑/删除收进图标位与右键菜单。
//   简历管理 = 编辑器版式:标题栏(字数/保存)+ 大输入区 + 用途提示。
// 简历 dirty 时拦截站内离开(tab 切换/侧栏导航),确认后放行;beforeunload 兜底。
// 「按 JD 生成题目」深链 /add?jd=<id>,添加题目页自动定位到该模式。

const charCount = (s: string) => (s ? `${s.length} 字` : '未填');

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = searchParams.get('tab') === 'resume' ? 'resume' : 'jds';
  // 简历 dirty 由 ResumeCard 上报;dirty 时拦截一切站内离开(tab 切换/侧栏/页内链接)
  const [resumeDirty, setResumeDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  useEffect(() => {
    if (!resumeDirty) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') ?? '';
      if (!href.startsWith('#/') && !href.startsWith('/')) return;
      const target = href.replace(/^#/, '');
      if (target === location.pathname + location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(target);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [resumeDirty, location]);

  const confirmLeave = () => {
    const target = leaveTo;
    setLeaveTo(null);
    setResumeDirty(false); // 放行后即放弃,别让守卫拦住接下来的跳转
    if (target != null) navigate(target);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === 'resume' ? '简历管理' : 'JD 管理'}
        description={
          tab === 'resume'
            ? '维护简历全文与默认公司,按 JD 生成时可结合简历出深挖题。'
            : '维护目标岗位的职位描述,可从任意 JD 直接生成定向题。'
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v === 'resume' ? '/profile?tab=resume' : '/profile';
          if (resumeDirty && next !== location.pathname + location.search) {
            setLeaveTo(next);
            return;
          }
          setSearchParams(v === 'resume' ? { tab: 'resume' } : {}, { replace: true });
        }}
      >
        <TabsList>
          <TabsTrigger value="jds">JD 管理</TabsTrigger>
          <TabsTrigger value="resume">简历管理</TabsTrigger>
        </TabsList>

        <TabsContent value="jds" className="mt-5">
          <JdManager />
        </TabsContent>

        <TabsContent value="resume" className="mt-5">
          <ResumeCard onDirtyChange={setResumeDirty} />
        </TabsContent>
      </Tabs>

      {/* 未保存离开确认:取消=留在本页(Radix 默认焦点在取消,安全),确认=放弃修改并离开 */}
      <AlertDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>有未保存的修改</AlertDialogTitle>
            <AlertDialogDescription>离开后这些修改不会保存。要先保存再离开吗?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留在本页</AlertDialogCancel>
            <Button variant="secondary" onClick={confirmLeave}>
              不保存,离开
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── JD 管理:双列卡片栅格(每卡 = 一个目标岗位)+ 新增/编辑弹窗 ──

function JdManager() {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  useEffect(() => subscribeJds(() => bump((v) => v + 1)), []);
  const jds = getJds();

  const [editing, setEditing] = useState<Jd | null>(null); // null = 关闭;有值为编辑
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Jd | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  // 内联创建(v9 交互重做):新 JD 直接在列表顶部一张卡里写,不再弹窗
  const saved = getProfile();
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineCompany, setInlineCompany] = useState('');
  const [inlineContent, setInlineContent] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineSaving, setInlineSaving] = useState(false);

  const openCreate = () => {
    setInlineTitle('');
    setInlineCompany(saved?.company ?? '');
    setInlineContent('');
    setInlineError(null);
    setCreating(true);
  };

  const saveInline = async () => {
    if (!inlineContent.trim()) {
      setInlineError('JD 内容不能为空——贴上职位描述全文');
      return;
    }
    setInlineSaving(true);
    setInlineError(null);
    try {
      await addJd({ title: inlineTitle, company: inlineCompany, content: inlineContent });
      toast.success('JD 已添加');
      setCreating(false);
      setInlineTitle('');
      setInlineCompany('');
      setInlineContent('');
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : String(e));
    } finally {
      setInlineSaving(false);
    }
  };

  return (
    <>
      {jds.length > 0 && !creating && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">{jds.length} 个 JD,最近使用的在前</div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-3.5" aria-hidden />
            新增 JD
          </Button>
        </div>
      )}

      {/* 内联创建:表单直接出现在列表顶部(v9 交互重做,替代弹窗) */}
      {creating && (
        <Card className="page-enter mb-4 flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">新 JD</div>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jd-inline-title">标题(可空)</Label>
              <Input id="jd-inline-title" value={inlineTitle} onChange={(e) => setInlineTitle(e.target.value)} placeholder="如:AI 应用工程师" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jd-inline-company">公司</Label>
              <Input id="jd-inline-company" value={inlineCompany} onChange={(e) => setInlineCompany(e.target.value)} placeholder={saved?.company || '如:示例公司'} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="jd-inline-content">
                职位描述(JD) <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{charCount(inlineContent)}</span>
            </div>
            <Textarea
              id="jd-inline-content"
              value={inlineContent}
              onChange={(e) => setInlineContent(e.target.value)}
              placeholder="粘贴目标岗位的 JD 全文"
              rows={8}
            />
          </div>
          {inlineError && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap">{inlineError}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={saveInline} disabled={inlineSaving}>
              {inlineSaving ? '保存中…' : '添加 JD'}
            </Button>
          </div>
        </Card>
      )}

      {jds.length === 0 && !creating ? (
        <EmptyState
          icon={Inbox}
          title="还没有 JD"
          description="粘贴目标岗位的职位描述,从这条 JD 直接生成定向题。"
          action={
            <Button size="sm" variant="secondary" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              新增 JD
            </Button>
          }
        />
      ) : (
        <div className="grid content-start gap-4 sm:grid-cols-2">
          {jds.map((j) => (
            <ContextMenu key={j.id}>
              <ContextMenuTrigger asChild>
                <Card className="flex h-full flex-col gap-3 p-4 transition-colors hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{j.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {j.company || '未填公司'} · {charCount(j.content)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground"
                            aria-label={`编辑 JD:${j.title}`}
                            onClick={() => setEditing(j)}
                          >
                            <Pencil aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>编辑</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label={`删除 JD:${j.title}`}
                            onClick={() => setDeleting(j)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>删除</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <p className="line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
                    {j.content}
                  </p>

                  <div className="mt-auto flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      className="h-8 flex-1 justify-start gap-1.5"
                      onClick={() => navigate(`/add?jd=${j.id}`)}
                    >
                      <Sparkles className="size-3.5" aria-hidden />
                      按 JD 生成题目
                    </Button>
                  </div>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => navigate(`/add?jd=${j.id}`)}>按 JD 生成题目…</ContextMenuItem>
                <ContextMenuItem onSelect={() => setEditing(j)}>编辑…</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(j)}>
                  删除…
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      {/* 创建已改为内联卡;此弹窗仅承担编辑 */}
      <JdEditDialog
        open={editing != null}
        jd={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      {/* 删除 JD:已生成题不受影响,但 JD 本身不可恢复 → AlertDialog */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这份 JD?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleting?.title}」将被删除。已用它生成的题不受影响(题目在待审核/我的题库,与 JD 不再关联)。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingBusy}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting) return;
                setDeletingBusy(true);
                try {
                  await deleteJd(deleting.id);
                  toast.success('JD 已删除');
                  setDeleting(null);
                } catch (err) {
                  toast.error('删除失败', { description: err instanceof Error ? err.message : String(err) });
                } finally {
                  setDeletingBusy(false);
                }
              }}
            >
              {deletingBusy ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 新增/编辑共用:标题可留空(回退公司名 → JD 前 12 字),JD 内容必填
function JdEditDialog({ open, jd, onClose }: { open: boolean; jd: Jd | null; onClose: () => void }) {
  const saved = getProfile();
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(jd?.title ?? '');
      // 新增时用档案里的默认公司预填,少打一次
      setCompany(jd?.company ?? saved?.company ?? '');
      setContent(jd?.content ?? '');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jd]);

  const handleSave = async () => {
    if (!content.trim()) {
      setError('JD 内容不能为空——贴上职位描述全文');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (jd) {
        await updateJd(jd.id, { title, company, content });
        toast.success('JD 已更新');
      } else {
        await addJd({ title, company, content });
        toast.success('JD 已添加');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{jd ? '编辑 JD' : '新增 JD'}</DialogTitle>
          <DialogDescription>标题可留空,默认取公司名;生成时按 JD 全文的技术要求出题。</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jd-title" className="text-xs text-muted-foreground">标题(可空)</Label>
              <Input id="jd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:AI 应用工程师" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jd-company" className="text-xs text-muted-foreground">公司</Label>
              <Input id="jd-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="如:示例公司" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="jd-content" className="text-xs text-muted-foreground">
                职位描述(JD) <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{charCount(content)}</span>
            </div>
            <Textarea
              id="jd-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="粘贴目标岗位的 JD 全文"
              rows={12}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">取消</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : jd ? '保存修改' : '添加 JD'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 简历与公司:编辑器版式(单份简历 + 默认公司,多版本留二期)──

function ResumeCard({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const saved = getProfile();
  const [company, setCompany] = useState(saved?.company ?? '');
  const [resume, setResume] = useState(saved?.resume ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = !!saved
    ? saved.company !== company || saved.resume !== resume
    : !!(company || resume);

  // dirty 上报给页面层做站内离开拦截;卸载(切 tab/离页)复位
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  // 浏览器级兜底:刷新/关窗弹原生确认
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ company: company.trim(), resume: resume.trim() });
      toast.success('简历已保存');
    } catch (e) {
      toast.error('保存失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5">
        {/* 编辑器标题栏:标识 + 字数 + 保存 */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="text-sm font-semibold text-foreground">我的简历</div>
            <div className="mt-0.5 text-xs text-muted-foreground">支持全文粘贴(Markdown),只存本机</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">{charCount(resume)}</span>
            {dirty && <span className="text-xs text-warning">未保存</span>}
            <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
              {saving ? '保存中…' : '保存简历'}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resume-company" className="text-xs text-muted-foreground">默认公司 / 岗位</Label>
          <Input
            id="resume-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="如:示例公司 · AI 应用工程师(新增 JD 时预填)"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resume-content" className="text-xs text-muted-foreground">简历全文(Markdown)</Label>
          <Textarea
            id="resume-content"
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="粘贴简历全文(markdown)…"
            className="min-h-72 text-[13px] leading-relaxed"
          />
        </div>

        {dirty && (
          <div className="flex items-center justify-end border-t border-border pt-3">
            <span className="text-xs text-warning">有未保存的修改</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export type { JobProfile };
