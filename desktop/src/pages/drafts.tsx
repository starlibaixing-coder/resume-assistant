import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, Inbox, Plus, X } from 'lucide-react';
import { approveQuestion, getMyQuestions, rejectDraft, subscribeMyLib } from '@/lib/mylib';
import { usePageKeys } from '@/lib/use-page-keys';
import type { MyQuestion, QuestionSource } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { TwoPane } from '@/components/two-pane';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// 待审核(v10 交互重做:与题库浏览同一套「选行 → 详情就地操作」语法):
// 批次组头(本批全部通过)+ 行目录;右侧详情看题面与答案,通过/拒绝就地完成,
// 处理完自动选中下一题(批量过审不断手)。拒绝 = 永久删除,AlertDialog 确认。
// 页头由题库空间(/library)按模式统一渲染,本组件只出内容,避免双层页头。
// AI 出的题先进 pending,在这里人工过目,通过(approved)才进「我的题库」(ADR-10)。

const SOURCE_LABELS: Record<QuestionSource, string> = {
  manual: '手动',
  ai: 'AI 生成',
  jd: '按 JD',
  copy: '官方复制',
};

export function DraftsBoard() {
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  // 进行中的操作(按钮禁用防重入):'all:模块号' 或题 id
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<MyQuestion | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => subscribeMyLib(() => setVersion((v) => v + 1)), []);

  const pending = useMemo(
    () => getMyQuestions().filter((q) => q.status === 'pending'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  // 按批次(模块)分组
  const groups = useMemo(() => {
    const g = new Map<number, MyQuestion[]>();
    for (const q of pending) {
      const arr = g.get(q.module) ?? [];
      arr.push(q);
      g.set(q.module, arr);
    }
    return [...g.entries()];
  }, [pending]);

  // 选中项跟随列表:被处理掉就自动落到下一题(批量过审的连续流)
  const flat = groups.flatMap(([, qs]) => qs);
  const effectiveSelectedId = flat.some((q) => q.id === selectedId)
    ? selectedId
    : flat[0]?.id ?? null;
  const selected = flat.find((q) => q.id === effectiveSelectedId) ?? null;

  // 反馈统一 toast + try/catch(审核是 ADR-10 关键闸门)
  const handleApprove = async (id: string) => {
    setBusy(id);
    try {
      await approveQuestion(id);
      toast.success('已通过,进我的题库');
      setVersion((v) => v + 1); // 立即刷新(订阅也会触发,幂等)
    } catch (e) {
      toast.error('通过失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };
  const handleReject = async (q: MyQuestion) => {
    setRejecting(true);
    try {
      await rejectDraft(q.id);
      toast.success('已拒绝并删除');
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error('拒绝失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRejecting(false);
      setConfirmReject(null);
    }
  };
  const handleApproveAll = async (qs: MyQuestion[]) => {
    const key = `all:${qs[0]?.module ?? ''}`;
    setBusy(key);
    try {
      await Promise.all(qs.map((q) => approveQuestion(q.id)));
      toast.success(`本批 ${qs.length} 题已全部通过`);
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error('批量通过失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  // 键盘:↑↓ 选择,Enter = 通过(先看答案再一键放行);输入框/弹窗打开时让键
  usePageKeys((e) => {
    if (flat.length === 0) return;
    const idx = flat.findIndex((x) => x.id === effectiveSelectedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedId(flat[Math.min(idx + 1, flat.length - 1)].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedId(flat[Math.max(idx - 1, 0)].id);
    } else if (e.key === 'Enter' && effectiveSelectedId && !busy) {
      e.preventDefault();
      void handleApprove(effectiveSelectedId);
    }
  }, busy == null && confirmReject == null);

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="没有待审核的题"
        description="AI 出的题先进这里,你逐题通过后才进学习队列。"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link to="/add">
              <Plus className="size-3.5" aria-hidden />
              添加题目
            </Link>
          </Button>
        }
      />
    );
  }

  const detailContent = selected ? (
    <div className="rounded-md bg-card">
      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{selected.id}</span>
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {SOURCE_LABELS[selected.source]}
          </span>
          <Badge variant="secondary">{selected.difficulty}</Badge>
        </div>
        <h2 className="mt-1.5 text-sm font-semibold leading-snug text-foreground">{selected.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{selected.focus}</p>
      </div>

      {/* 就地把关:看完答案直接决定;处理完自动选中下一题 */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <Button
          size="sm"
          variant="success"
          disabled={busy != null}
          onClick={() => handleApprove(selected.id)}
        >
          <Check className="size-3.5" aria-hidden />
          {busy === selected.id ? '通过中…' : '通过,进我的题库'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={busy != null}
          onClick={() => setConfirmReject(selected)}
        >
          <X className="size-3.5" aria-hidden />
          拒绝
        </Button>
      </div>

      <div className="px-4 pb-4 pt-3">
        <AnswerPanel answer={selected.answer} followups={selected.followups} />
      </div>
    </div>
  ) : (
    <div className="rounded-md bg-secondary/60 px-4 py-10 text-center text-sm text-muted-foreground">
      选中左侧一行,在这里看题面与答案
    </div>
  );

  return (
    <div className="space-y-4" data-version={version}>
      <TwoPane
        mobileOpen={mobileDetailOpen && !!selected}
        onCloseMobile={() => setMobileDetailOpen(false)}
        list={
          <div className="space-y-6">
            {groups.map(([moduleId, qs]) => (
              <section key={moduleId}>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs tabular-nums text-primary" aria-hidden>
                    {String(moduleId).padStart(2, '0')}
                  </span>
                  <h2 className="text-sm font-semibold tracking-wide text-foreground">
                    {qs[0].moduleName}
                  </h2>
                  <span className="text-xs text-muted-foreground">({qs.length} 题)</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy != null}
                    onClick={() => handleApproveAll(qs)}
                  >
                    {busy === `all:${moduleId}` ? '通过中…' : '本批全部通过'}
                  </Button>
                </div>

                <div className="mt-3 rounded-lg bg-card divide-y divide-border">
                  {qs.map((q) => {
                    const isSelected = q.id === effectiveSelectedId;
                    return (
                      <div
                        key={q.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedId(q.id);
                          setMobileDetailOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(q.id);
                            setMobileDetailOpen(true);
                          }
                        }}
                        className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-accent/70' : 'hover:bg-accent/60'
                        }`}
                      >
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">{q.id}</span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{q.title}</span>
                        <Badge variant="secondary" className="shrink-0">{q.difficulty}</Badge>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        }
        detail={detailContent}
      />

      {/* 拒绝 = 永久删除:AlertDialog 确认(不可逆操作统一防线) */}
      <AlertDialog open={!!confirmReject} onOpenChange={(o) => !o && setConfirmReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>拒绝这道题?</AlertDialogTitle>
            <AlertDialogDescription>
              「{confirmReject?.title}」将被永久删除,不会进任何题库。此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
              onClick={(e) => {
                e.preventDefault(); // 失败时弹窗留在原地可重试
                if (confirmReject) void handleReject(confirmReject);
              }}
            >
              {rejecting ? '删除中…' : '确认拒绝'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
