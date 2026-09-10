// JD 管理(M7):双栏工作台 —— 左:JD 列表(最近使用排序)+ 新建;右:详情/就地编辑表单/
// 统计(按 jd_id 聚合)/「按此 JD 生成」/删除(不可逆走 AlertDialog;删后选中第一项)。
// 表单 dirty 走全局守卫。

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PencilIcon, PlusIcon, Trash2Icon, Wand2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { EmptyState } from '@/components/biz/states';
import { clearDirtyGuard, registerDirtyGuard } from '@/lib/guard';
import { registerListNav } from '@/lib/page-hooks';
import { useJdList, useMyQuestions } from '@/lib/hooks';
import { deleteJd, nextJdId, saveJd } from '@/lib/storage';
import type { Jd } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export function JdPage() {
  const jds = useJdList();
  const allMy = useMyQuestions();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Jd | null>(null);

  const selected = jds.find((j) => j.id === selectedId) ?? jds[0] ?? null;

  useEffect(() => {
    if (selectedId != null && !jds.some((j) => j.id === selectedId)) setSelectedId(null);
  }, [jds, selectedId]);

  useEffect(() => {
    registerListNav((dir) => {
      setSelectedId((cur) => {
        if (jds.length === 0) return cur;
        const i = jds.findIndex((j) => j.id === (cur ?? jds[0]?.id));
        return jds[Math.min(jds.length - 1, Math.max(0, i + dir))]?.id ?? cur;
      });
    });
    return () => registerListNav(null);
  }, [jds]);

  const stats = useMemo(() => {
    const map = new Map<number, { total: number; pending: number }>();
    for (const q of allMy) {
      if (q.jdId == null) continue;
      const s = map.get(q.jdId) ?? { total: 0, pending: 0 };
      s.total += 1;
      if (q.status === 'pending') s.pending += 1;
      map.set(q.jdId, s);
    }
    return map;
  }, [allMy]);

  const createNew = () => {
    setCreating(true);
    setSelectedId(null);
  };

  const remove = (jd: Jd) => {
    deleteJd(jd.id);
    setDeleting(null);
    toast.success('JD 已删除', { description: '已生成的题目保留,来源显示岗位名快照。' });
  };

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 w-[42%] flex-col gap-3 px-6 py-5">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-lg font-semibold">JD</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">招聘要求集中管理,对着 JD 出题查漏补缺。</p>
          </div>
          <Button size="sm" variant="outline" onClick={createNew} data-testid="jd-new-btn">
            <PlusIcon /> 新建
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-card shadow-sm" data-testid="jd-list">
          {jds.length === 0 && !creating ? (
            <EmptyState title="还没有 JD" description="粘贴一条招聘要求,让 AI 对着它帮你找盲区。" />
          ) : (
            <div className="divide-y divide-border/60">
              {jds.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(j.id);
                    setCreating(false);
                  }}
                  className={cn(
                    'relative flex w-full cursor-pointer flex-col gap-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50',
                    j.id === selected?.id && !creating && 'bg-accent',
                  )}
                >
                  {j.id === selected?.id && !creating && (
                    <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary" />
                  )}
                  <span className="truncate text-sm">{j.company ? `${j.company} · ${j.title}` : j.title}</span>
                  <span className="text-xs text-muted-foreground">最近使用 {formatDateTime(j.lastActiveAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="min-h-0 flex-1 border-l border-border/60 bg-card/40" data-testid="jd-detail">
        {creating ? (
          <JdForm
            key="new"
            jd={null}
            onDone={(saved) => {
              setCreating(false);
              if (saved) {
                setSelectedId(saved.id);
                toast.success('JD 已保存');
              }
            }}
          />
        ) : selected ? (
          <JdDetail jd={selected} stats={stats.get(selected.id) ?? { total: 0, pending: 0 }} onDelete={() => setDeleting(selected)} />
        ) : (
          <EmptyState title="选择一条 JD" description="左侧选中后查看内容、统计,或按它生成题目。" />
        )}
      </section>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条 JD?</AlertDialogTitle>
            <AlertDialogDescription>
              已按它生成的题目会保留,来源仍显示岗位名;此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => deleting && remove(deleting)}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JdDetail({ jd, stats, onDelete }: { jd: Jd; stats: { total: number; pending: number }; onDelete: () => void }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="p-5">
        <h3 className="mb-4 font-display text-base font-semibold">编辑 JD</h3>
        <JdForm
          jd={jd}
          onDone={(saved) => {
            setEditing(false);
            if (saved) toast.success('JD 已保存');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5" data-testid="jd-detail-view">
      <div>
        <h3 className="font-display text-xl">{jd.company ? `${jd.company} · ${jd.title}` : jd.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">创建于 {formatDateTime(jd.createdAt)}</p>
      </div>

      <div className="flex gap-3">
        <div className="rounded-lg bg-muted/60 px-4 py-3 text-center">
          <div className="font-display text-xl tabular-nums">{stats.total}</div>
          <div className="text-[11px] text-muted-foreground">已生成题目</div>
        </div>
        <div className="rounded-lg bg-muted/60 px-4 py-3 text-center">
          <div className="font-display text-xl tabular-nums text-warning">{stats.pending}</div>
          <div className="text-[11px] text-muted-foreground">待审核</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigate(`/add?jd=${jd.id}`)} data-testid="jd-generate-shortcut">
          <Wand2Icon /> 按 JD 生成题目
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <PencilIcon /> 编辑
        </Button>
        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete}>
          <Trash2Icon /> 删除
        </Button>
      </div>

      <div className="min-h-0 flex-1 rounded-lg bg-input/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {jd.content || '(无内容)'}
      </div>
    </div>
  );
}

function JdForm({ jd, onDone }: { jd: Jd | null; onDone: (saved: Jd | null) => void }) {
  const [title, setTitle] = useState(jd?.title ?? '');
  const [company, setCompany] = useState(jd?.company ?? '');
  const [content, setContent] = useState(jd?.content ?? '');

  const isDirty = () =>
    title !== (jd?.title ?? '') || company !== (jd?.company ?? '') || content !== (jd?.content ?? '');

  useEffect(() => {
    registerDirtyGuard({ id: 'jd-form', isDirty });
    return () => clearDirtyGuard('jd-form');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, company, content]);

  const save = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('标题与内容不能为空');
      return;
    }
    const now = Date.now();
    const next: Jd = {
      id: jd?.id ?? nextJdId(),
      title: title.trim(),
      company: company.trim(),
      content,
      createdAt: jd?.createdAt ?? now,
      lastActiveAt: jd?.lastActiveAt ?? now,
    };
    saveJd(next);
    clearDirtyGuard('jd-form');
    onDone(next);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5" data-testid="jd-form">
      <div className="grid grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-3">
        <Label htmlFor="jd-company">公司</Label>
        <Input id="jd-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="选填" />
        <Label htmlFor="jd-title">
          <span className="text-destructive">*</span> 岗位名
        </Label>
        <Input id="jd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:资深前端工程师" />
        <Label htmlFor="jd-content" className="self-start pt-1.5">
          <span className="text-destructive">*</span> JD 全文
        </Label>
        <Textarea id="jd-content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-72" placeholder="粘贴完整的招聘要求" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { clearDirtyGuard('jd-form'); onDone(null); }}>
          取消
        </Button>
        <Button onClick={save}>保存</Button>
      </div>
    </div>
  );
}
