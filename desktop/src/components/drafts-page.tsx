import { useEffect, useState } from 'react';
import { approveQuestion, getMyQuestions, rejectDraft, subscribeMyLib } from '@/lib/mylib';
import type { MyQuestion } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// 草稿区(ADR-10):AI 生成的题先进 pending,在这里人工过目,
// 通过(approved)才进「我的题库」聚合刷题;拒绝 = 删除。

export function DraftsPage() {
  const [version, setVersion] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const handleApprove = async (id: string) => {
    await approveQuestion(id);
    setVersion((v) => v + 1); // 立即刷新(订阅也会触发,幂等)
  };
  const handleReject = async (id: string) => {
    await rejectDraft(id);
    setVersion((v) => v + 1);
  };
  const handleApproveAll = async (qs: MyQuestion[]) => {
    await Promise.all(qs.map((q) => approveQuestion(q.id)));
    setVersion((v) => v + 1);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-version={version}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">
          <span className="text-primary">●</span> 草稿区
          {pending.length > 0 && <span className="ml-2 font-mono text-base text-muted-foreground">{pending.length} 待审</span>}
        </h1>
        <a href="#/generate" className="text-sm text-primary hover:underline font-mono">+ AI 生题</a>
      </div>

      {pending.length === 0 ? (
        <div className="text-center py-16 space-y-3 rounded-lg border border-border bg-card">
          <div className="text-4xl">✓</div>
          <div className="text-foreground">草稿区是空的</div>
          <div className="text-sm text-muted-foreground">
            AI 生成的题会先进这里,你确认后才进刷题队列。
          </div>
          <a href="#/generate" className="inline-block text-primary hover:underline text-sm">去生题 →</a>
        </div>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([moduleId, qs]) => (
            <div key={moduleId} className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-mono text-sm text-muted-foreground">
                  批次 {String(moduleId).padStart(2, '0')} · {qs[0].moduleName}({qs.length} 题)
                </div>
                <Button size="sm" variant="outline" onClick={() => handleApproveAll(qs)}>
                  本批全部通过
                </Button>
              </div>

              <div className="bg-card border border-border rounded-md overflow-hidden">
                {qs.map((q) => {
                  const isOpen = expandedId === q.id;
                  return (
                    <div key={q.id} className="border-b border-border last:border-b-0">
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => setExpandedId(isOpen ? null : q.id)}
                      >
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {isOpen ? '▼' : '▶'} {q.id}
                        </span>
                        <span className="text-sm text-foreground flex-1">{q.title}</span>
                        <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                      </div>
                      {isOpen && (
                        <div className="px-3.5 pb-4 space-y-3">
                          <div className="text-sm text-muted-foreground pt-2">{q.focus}</div>
                          <AnswerPanel answer={q.answer} followups={q.followups} />
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="success" onClick={() => handleApprove(q.id)}>
                              ✓ 通过,进我的题库
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleReject(q.id)}>
                              ✗ 拒绝
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="text-xs text-muted-foreground text-center pt-2">
            通过后的题在「我的题库」分类里刷(<a href="#/my" className="text-primary hover:underline">去刷题</a>),进度走同一套 SM-2。
          </div>
        </div>
      )}
    </div>
  );
}
