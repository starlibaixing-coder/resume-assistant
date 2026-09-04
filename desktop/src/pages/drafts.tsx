import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Inbox, Plus, X } from 'lucide-react';
import { approveQuestion, getMyQuestions, rejectDraft, subscribeMyLib } from '@/lib/mylib';
import type { MyQuestion } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// 待审核看板(ADR-10 草稿区;v4 收编进题库空间的「审核」模式,由 /library 渲染):
// 批次小签 + 细线行目录;拒绝 = 永久删除,AlertDialog 确认。
// AI 出的题先进 pending,在这里人工过目,通过(approved)才进「我的题库」;
// 拒绝 = 永久删除,AlertDialog 确认。

export function DraftsBoard() {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 进行中的操作(按钮禁用防重入):'all:模块号' 或题 id
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<MyQuestion | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => subscribeMyLib(() => setVersion((v) => v + 1)), []);

  const pending = getMyQuestions().filter((q) => q.status === 'pending');

  // 按批次(模块)分组
  const groups = new Map<number, MyQuestion[]>();
  for (const q of pending) {
    let g = groups.get(q.module);
    if (!g) {
      g = [];
      groups.set(q.module, g);
    }
    g.push(q);
  }

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

  return (
    <div className="space-y-8" data-version={version}>
      <PageHeader
        title="待审核"
        description={pending.length > 0 ? `${pending.length} 题待审核` : 'AI 生成的题先进这里,逐题把关'}
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="没有待审核的题"
          description="AI 出的题先进这里,你逐题通过后才进学习队列。"
          action={
            <Button size="sm" variant="outline" asChild>
              <Link to="/add">
                <Plus className="size-3.5" aria-hidden />
                添加题目
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {[...groups.entries()].map(([moduleId, qs]) => (
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
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => handleApproveAll(qs)}
                >
                  {busy === `all:${moduleId}` ? '通过中…' : '本批全部通过'}
                </Button>
              </div>

              <div className="mt-3 border-t border-border">
                {qs.map((q) => {
                  const isOpen = expandedId === q.id;
                  return (
                    <div key={q.id} className="border-b border-border">
                      <div className="flex w-full items-center gap-3 py-3 transition-colors hover:bg-accent/40">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-label={isOpen ? '收起题目详情' : '展开题目详情'}
                          title={isOpen ? '收起' : '展开看答案后决定'}
                          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                          onClick={() => setExpandedId(isOpen ? null : q.id)}
                        >
                          <span className="flex shrink-0 items-center gap-0.5 font-mono text-xs text-muted-foreground">
                            {isOpen
                              ? <ChevronDown className="size-3.5" aria-hidden />
                              : <ChevronRight className="size-3.5" aria-hidden />}
                            {q.id}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{q.title}</span>
                          <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                        </button>
                        <span className="flex shrink-0 items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-success hover:bg-success/10 hover:text-success"
                                aria-label={`通过:${q.title}`}
                                disabled={busy != null}
                                onClick={() => handleApprove(q.id)}
                              >
                                <Check className="size-4" aria-hidden />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>通过,进我的题库</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                aria-label={`拒绝:${q.title}`}
                                disabled={busy != null}
                                onClick={() => setConfirmReject(q)}
                              >
                                <X className="size-4" aria-hidden />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>拒绝并删除</TooltipContent>
                          </Tooltip>
                        </span>
                      </div>
                      {isOpen && (
                        <div className="space-y-3 px-1 pb-5">
                          <div className="pt-1 text-sm text-muted-foreground">{q.focus}</div>
                          <AnswerPanel answer={q.answer} followups={q.followups} />
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="success"
                              disabled={busy != null}
                              onClick={() => handleApprove(q.id)}
                            >
                              {busy === q.id ? '通过中…' : (
                                <>
                                  <Check className="size-3.5" aria-hidden />
                                  通过,进我的题库
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busy != null}
                              onClick={() => setConfirmReject(q)}
                            >
                              <X className="size-3.5" aria-hidden />
                              拒绝
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

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
