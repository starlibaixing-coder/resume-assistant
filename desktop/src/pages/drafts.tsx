import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Inbox, Plus, X } from 'lucide-react';
import { approveQuestion, getMyQuestions, rejectDraft, subscribeMyLib } from '@/lib/mylib';
import type { MyQuestion } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { AddQuestionDialog } from '@/components/add-question-dialog';

// 待审核(ADR-10 草稿区):AI 出的题先进 pending,在这里人工过目,
// 通过(approved)才进「我的题库」聚合刷题;拒绝 = 永久删除,需确认(与删题同款防线)。

export function DraftsPage() {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 进行中的操作(按钮禁用防重入):'all:模块号' 或题 id
  const [busy, setBusy] = useState<string | null>(null);
  // 拒绝确认(拒绝 = 删除,不可恢复)
  const [confirmReject, setConfirmReject] = useState<MyQuestion | null>(null);
  const [addOpen, setAddOpen] = useState(false);

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

  // 反馈统一 toast + try/catch(审计 C1:审核是 ADR-10 关键闸门,曾全程静默)
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
    setBusy(q.id);
    try {
      await rejectDraft(q.id);
      toast.success('已拒绝并删除');
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error('拒绝失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
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
    <div className="mx-auto max-w-3xl space-y-6" data-version={version}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PageHeader title="待审核" subtitle={pending.length > 0 ? `${pending.length} 题待审核` : undefined} />
        <Button size="sm" variant="outline" className="mb-1" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" aria-hidden />
          添加题目
        </Button>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-16 text-center">
            <Inbox className="mx-auto size-10 text-muted-foreground" aria-hidden />
            <div className="text-foreground">没有待审核的题</div>
            <div className="text-sm text-muted-foreground">
              AI 出的题先进这里,你逐题通过后才进学习队列。
            </div>
            <div>
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                添加题目
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([moduleId, qs]) => (
            <div key={moduleId} className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-muted-foreground">
                  批次 {String(moduleId).padStart(2, '0')} · {qs[0].moduleName}({qs.length} 题)
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy != null}
                  onClick={() => handleApproveAll(qs)}
                >
                  {busy === `all:${moduleId}` ? '通过中…' : '本批全部通过'}
                </Button>
              </div>

              <Card className="overflow-hidden">
                {qs.map((q) => {
                  const isOpen = expandedId === q.id;
                  return (
                    <div key={q.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-3 p-3 text-left cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => setExpandedId(isOpen ? null : q.id)}
                      >
                        <span className="flex shrink-0 items-center gap-0.5 font-mono text-xs text-muted-foreground">
                          {isOpen
                            ? <ChevronDown className="size-3.5" aria-hidden />
                            : <ChevronRight className="size-3.5" aria-hidden />}
                          {q.id}
                        </span>
                        <span className="text-sm text-foreground flex-1">{q.title}</span>
                        <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                      </button>
                      {isOpen && (
                        <div className="px-3.5 pb-4 space-y-3">
                          <div className="text-sm text-muted-foreground pt-2">{q.focus}</div>
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
              </Card>
            </div>
          ))}

          <div className="text-xs text-muted-foreground text-center pt-2">
            通过后的题在「我的题库」分类里学习(<Link to="/my" className="text-primary hover:underline">去学习</Link>),进度走同一套 SM-2。
          </div>
        </div>
      )}

      <AddQuestionDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* 拒绝 = 永久删除:确认(审计 C2,与删题/清空进度同款防线) */}
      <Dialog open={!!confirmReject} onOpenChange={(o) => !o && setConfirmReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝这道题?</DialogTitle>
            <DialogDescription>
              「{confirmReject?.title}」将被永久删除,不会进任何题库。此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={() => confirmReject && handleReject(confirmReject)}>
                确认拒绝
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
