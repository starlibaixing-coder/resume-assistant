import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
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
import { addNavBlocker } from '@/lib/nav-guard';
import { usePageKeys } from '@/lib/use-page-keys';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/empty-state';
import { TwoPane } from '@/components/two-pane';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// 求职中枢(v10 交互重做):
//   JD 管理 = 「选行 → 详情就地操作」工作台(与题库/审核同一套语法):
//     左列 JD 行目录,右侧详情看全文;编辑 = 详情就地变表单(不再弹窗);
//     「按 JD 生成题目」是详情主按钮(深链 /add?jd=);删除 AlertDialog。
//     新增 JD 仍是列表顶部内联创建卡(v9);修 bug:关闭编辑弹层不再连带清空内联创建卡。
//   简历管理 = 编辑器版式不变;dirty 上报全局导航守卫(⌘K / Cmd+数字 / 历史键也会拦截,
//     此前只拦 <a> 点击,键盘路径静默丢改动)。
const charCount = (s: string) => (s ? `${s.length} 字` : '未填');

export function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'resume' ? 'resume' : 'jds';
  // 简历 dirty 由 ResumeCard 上报;同时注册全局导航守卫拦键盘路径
  const [resumeDirty, setResumeDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = resumeDirty;

  useEffect(() => {
    if (tab !== 'resume') return;
    return addNavBlocker({
      isDirty: () => dirtyRef.current,
      release: () => setResumeDirty(false),
    });
  }, [tab]);

  return (
    <div className="flex h-full flex-col">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (resumeDirty) {
            setLeaveTo(v);
            return;
          }
          setSearchParams(v === 'resume' ? { tab: 'resume' } : {}, { replace: true });
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* 标题工具条 */}
        <div className="flex h-12 shrink-0 items-center gap-3 px-5">
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
            {tab === 'resume' ? '简历管理' : 'JD 管理'}
          </h1>
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {tab === 'resume'
              ? '维护简历全文与默认公司,按 JD 生成时可结合简历出深挖题。'
              : '选中左侧 JD 在右侧看全文、生成定向题。'}
          </p>
          <TabsList className="ml-auto shrink-0">
            <TabsTrigger value="jds">JD 管理</TabsTrigger>
            <TabsTrigger value="resume">简历管理</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="jds" className="mt-0 flex min-h-0 flex-1 flex-col">
          <JdManager />
        </TabsContent>

        <TabsContent value="resume" className="mt-0 flex min-h-0 flex-1 flex-col px-5 pb-5">
          <ResumeCard onDirtyChange={setResumeDirty} />
        </TabsContent>
      </Tabs>

      {/* 未保存离开确认(页内切 tab):取消=留在本页,确认=放弃修改并切换 */}
      <AlertDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>有未保存的修改</AlertDialogTitle>
            <AlertDialogDescription>离开后这些修改不会保存。要先保存再离开吗?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>留在本页</AlertDialogCancel>
            <Button variant="secondary" onClick={() => {
              setResumeDirty(false);
              const target = leaveTo;
              setLeaveTo(null);
              if (target === 'resume') setSearchParams({}, { replace: true });
              else setSearchParams({ tab: 'resume' }, { replace: true });
            }}>
              不保存,切换
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── JD 管理:选行 → 详情就地操作工作台 ──

function JdManager() {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  useEffect(() => subscribeJds(() => bump((v) => v + 1)), []);
  const jds = getJds();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Jd | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  // 内联创建(v9):新 JD 直接在列表顶部一张卡里写;编辑不再连带清空它(v10 修复)
  const saved = getProfile();
  const [creating, setCreating] = useState(false);
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

  // 选中项跟随列表(删除/新增后自动回落)
  const effectiveSelectedId = jds.some((j) => j.id === selectedId)
    ? selectedId
    : jds[0]?.id ?? null;
  const selected = jds.find((j) => j.id === effectiveSelectedId) ?? null;

  // 键盘:↑↓ 选择行(动作在详情栏,避免误触发生成)
  usePageKeys((e) => {
    if (jds.length === 0) return;
    const idx = jds.findIndex((j) => j.id === effectiveSelectedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedId(jds[Math.min(idx + 1, jds.length - 1)].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedId(jds[Math.max(idx - 1, 0)].id);
    }
  });

  const detailContent = editingId != null ? (
    <JdInlineEdit jd={jds.find((j) => j.id === editingId) ?? null} onDone={() => setEditingId(null)} />
  ) : selected ? (
    <div className="rounded-md bg-card">
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {selected.company.trim() || '未填公司'}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{charCount(selected.content)}</span>
        </div>
        <h2 className="mt-1.5 font-display text-lg font-semibold leading-snug text-foreground">
          {selected.title.trim() || '(未填标题)'}
        </h2>
      </div>

      {/* 就地操作:生成定向题是详情主按钮;编辑就地变表单;删除 AlertDialog */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <Button size="sm" onClick={() => navigate(`/add?jd=${selected.id}`)}>
          <Sparkles className="size-3.5" aria-hidden />
          按 JD 生成题目
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEditingId(selected.id)}>
          <Pencil className="size-3.5" aria-hidden />
          编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleting(selected)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          删除
        </Button>
      </div>

      <p className="whitespace-pre-wrap px-4 pb-5 pt-3 text-[13px] leading-relaxed text-foreground">
        {selected.content}
      </p>
    </div>
  ) : (
    <div className="rounded-md bg-secondary/60 px-4 py-10 text-center text-sm text-muted-foreground">
      选中左侧一份 JD,在这里看全文与操作
    </div>
  );

  if (jds.length === 0 && !creating) {
    return (
      <div className="px-5 py-6">
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
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-5 pb-5 pt-1">
      {/* 内联创建卡(列表顶部) */}
      {creating && (
        <div className="mb-3 shrink-0 rounded-xl bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">新 JD</div>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="jd-inline-title">标题(可空)</Label>
              <Input id="jd-inline-title" value={inlineTitle} onChange={(e) => setInlineTitle(e.target.value)} placeholder="如:AI 应用工程师" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jd-inline-company">公司</Label>
              <Input id="jd-inline-company" value={inlineCompany} onChange={(e) => setInlineCompany(e.target.value)} placeholder={saved?.company || '如:示例公司'} />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
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
            <Alert variant="destructive" className="mt-3">
              <AlertDescription className="whitespace-pre-wrap">{inlineError}</AlertDescription>
            </Alert>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={saveInline} disabled={inlineSaving}>
              {inlineSaving ? '保存中…' : '添加 JD'}
            </Button>
          </div>
        </div>
      )}

      {jds.length > 0 && (
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">{jds.length} 个 JD,最近使用的在前</div>
          {!creating && (
            <Button size="sm" variant="secondary" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              新增 JD
            </Button>
          )}
        </div>
      )}

      <TwoPane
        mobileOpen={mobileDetailOpen && !!selected}
        onCloseMobile={() => setMobileDetailOpen(false)}
        list={
          <div className="rounded-md bg-card divide-y divide-border">
            {jds.map((j) => {
              const isSelected = j.id === effectiveSelectedId;
              return (
                <div
                  key={j.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedId(j.id);
                    setEditingId(null);
                    setMobileDetailOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(j.id);
                      setMobileDetailOpen(true);
                    }
                  }}
                  className={`cursor-pointer px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-accent/70' : 'hover:bg-accent/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {j.title.trim() || '(未填标题)'}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{charCount(j.content)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">{j.company.trim() || '未填公司'}</span>
                    <span className="min-w-0 truncate text-xs text-muted-foreground/80">{j.content}</span>
                  </div>
                </div>
              );
            })}
          </div>
        }
        detail={detailContent}
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
    </div>
  );
}

// JD 就地编辑(详情栏内,替代弹窗)。关闭只退出编辑,不碰内联创建卡(v10 修复:
// 此前 onClose 同时 setCreating(false),内联写一半的内容会被静默丢弃)
function JdInlineEdit({ jd, onDone }: { jd: Jd | null; onDone: () => void }) {
  const [title, setTitle] = useState(jd?.title ?? '');
  const [company, setCompany] = useState(jd?.company ?? '');
  const [content, setContent] = useState(jd?.content ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!jd) return null;

  const handleSave = async () => {
    if (!content.trim()) {
      setError('JD 内容不能为空——贴上职位描述全文');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateJd(jd.id, { title, company, content });
      toast.success('JD 已更新');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">编辑 JD</h2>
        <span className="text-[10px] tabular-nums text-muted-foreground">{charCount(content)}</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="jd-edit-title" className="text-xs text-muted-foreground">标题(可空)</Label>
          <Input id="jd-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:AI 应用工程师" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jd-edit-company" className="text-xs text-muted-foreground">公司</Label>
          <Input id="jd-edit-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="如:示例公司" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="jd-edit-content" className="text-xs text-muted-foreground">
          职位描述(JD) <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Textarea
          id="jd-edit-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="粘贴目标岗位的 JD 全文"
          rows={12}
        />
      </div>
      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="whitespace-pre-wrap">{error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>取消</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存修改'}</Button>
      </div>
    </div>
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

  // dirty 上报页面层(全局导航守卫消费);卸载(切 tab/离页)复位
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
    <div className="flex h-full min-h-0 flex-col">
      {/* 编辑器标题栏:标识 + 字数 + 保存 */}
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-foreground">我的简历</span>
          <span className="text-xs text-muted-foreground">支持全文粘贴(Markdown),只存本机</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">{charCount(resume)}</span>
          {dirty && <span className="text-xs text-warning">未保存</span>}
          <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
            {saving ? '保存中…' : '保存简历'}
          </Button>
        </div>
      </div>

      <div className="mb-3 flex shrink-0 items-center gap-3">
        <Label htmlFor="resume-company" className="shrink-0 text-xs text-muted-foreground">默认公司 / 岗位</Label>
        <Input
          id="resume-company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="如:示例公司 · AI 应用工程师(新增 JD 时预填)"
          className="max-w-md flex-1"
        />
      </div>

      {/* 全高编辑区:输入面即卡面 */}
      <Textarea
        id="resume-content"
        value={resume}
        onChange={(e) => setResume(e.target.value)}
        placeholder="粘贴简历全文(markdown)…"
        aria-label="简历全文(Markdown)"
        className="min-h-0 flex-1 resize-none rounded-xl bg-card p-5 text-[13px] leading-relaxed"
      />

      {dirty && (
        <p className="pt-2 text-right text-xs text-warning">有未保存的修改</p>
      )}
    </div>
  );
}

export type { JobProfile };
