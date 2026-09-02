import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { generateQuestions, generateJdQuestions, type GeneratedQuestion } from '@/lib/generate';
import { getProfile } from '@/lib/profile';
import type { Jd } from '@/lib/jd';
import { resolveChatOptions } from '@/lib/llm-config';
import { addDrafts } from '@/lib/mylib';
import type { Difficulty } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

// AI 生成题目弹窗(2026-09-02 IA 重构:出题不再是独立页面,是各页面的按钮)。
// 两种模式:传 jd = 按 JD(和可选简历)生成,来源标 'jd';不传 = 按知识点生成,来源标 'ai'。
// 产物先进待审核(ADR-10,用户 2026-09-02 确认保留);提交后跳待审核页。
// 沿用原生题页的可靠性行为:AbortSignal 可取消、生成计时、失败可重试、预览后才提交。

const DIFFICULTIES: Array<Difficulty | '不限'> = ['不限', '初', '中', '高'];

// JD 模式批次名:JD定向 · 公司(无公司取 JD 前 12 字);addDrafts 再截 30 字
function jdBatchName(jd: Jd): string {
  const c = jd.company.trim() || jd.content.trim().slice(0, 12);
  return `JD定向 · ${c}`;
}

export function GenerateDialog({
  open,
  onOpenChange,
  jd = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jd?: Jd | null;
}) {
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | '不限'>('不限');
  const [includeResume, setIncludeResume] = useState(true);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; retries: number; topic: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const profile = getProfile();

  // 打开时检查 LLM 配置 + 重置;关闭时中断进行中的生成
  useEffect(() => {
    if (open) {
      resolveChatOptions()
        .then((opts) => setLlmReady(!!opts))
        .catch(() => setLlmReady(false));
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
      setLoading(false);
      setElapsed(0);
      setError(null);
      setNoKey(false);
      setResult(null);
      setExpanded(null);
      setSubmitting(false);
    }
  }, [open]);

  // 生成计时
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const handleGenerate = async () => {
    setError(null);
    setNoKey(false);
    if (!jd && !topic.trim()) {
      setError('先填一个知识点,比如「React Hooks 深入」「浏览器事件循环」');
      return;
    }
    const chatOpts = await resolveChatOptions();
    if (!chatOpts) {
      setNoKey(true);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setLoading(true);
    try {
      const diff = difficulty === '不限' ? undefined : difficulty;
      const r = jd
        ? await generateJdQuestions(
            { company: jd.company, content: jd.content, resume: includeResume ? (profile?.resume ?? '') : '' },
            { difficulty: diff, includeResume: includeResume && !!profile?.resume.trim() },
            { ...chatOpts, signal: ctrl.signal },
          )
        : await generateQuestions({ topic: topic.trim(), difficulty: diff }, { ...chatOpts, signal: ctrl.signal });
      setResult({
        questions: r.questions,
        retries: r.retries,
        topic: jd ? jdBatchName(jd) : topic.trim(),
      });
      setExpanded(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 主动取消
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!result) return;
    setSubmitting(true);
    try {
      await addDrafts(
        result.questions.map((q) => ({
          difficulty: q.difficulty as Difficulty,
          title: q.title,
          focus: q.focus,
          answer: q.answer,
          followups: q.followups,
          tags: q.tags,
        })),
        result.topic,
        jd ? 'jd' : 'ai',
      );
      toast.success(`已提交审核,通过后进我的题库(来源:${jd ? '按 JD' : 'AI 生成'})`);
      onOpenChange(false);
      navigate('/drafts');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="text-base">{jd ? `按 JD 生成题目 · ${jd.title}` : 'AI 生成题目'}</DialogTitle>
          <DialogDescription>
            {jd
              ? '按这份 JD 的技术要求出题(核心必备项优先),数量由 LLM 判断;生成后先进待审核。'
              : '按知识点出一批不同角度的题,数量由 LLM 按广度判断;生成后先进待审核。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {llmReady === false && !noKey && (
            <div className="text-sm text-muted-foreground">
              还没配置 LLM。先去设置页填 API key(智谱/DeepSeek/本地 Ollama 均可)。
            </div>
          )}
          {noKey && (
            <div className="text-sm text-muted-foreground">
              还没配置 LLM。先去设置页填 API key。
            </div>
          )}

          {jd ? (
            <div className="space-y-2.5">
              <div className="text-xs leading-relaxed text-muted-foreground">
                {jd.company.trim() || '(未填公司)'} · JD {jd.content.trim().length} 字
                {profile?.resume.trim() ? ` · 简历 ${profile.resume.trim().length} 字` : ' · 无简历(只用 JD 出题)'}
              </div>
              {profile?.resume.trim() && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">出题范围</span>
                  <Button size="sm" variant={!includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(false)} disabled={loading}>
                    只用 JD
                  </Button>
                  <Button size="sm" variant={includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(true)} disabled={loading}>
                    结合简历
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">知识点</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && !loading) void handleGenerate();
                }}
                placeholder="如:React Hooks 深入 / 浏览器事件循环 / RAG 检索优化"
                autoFocus
                disabled={loading}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">难度</span>
            {DIFFICULTIES.map((d) => (
              <Button key={d} size="sm" variant={difficulty === d ? 'default' : 'outline'} onClick={() => setDifficulty(d)} disabled={loading}>
                {d}
              </Button>
            ))}
          </div>

          {error && (
            <div className="text-sm text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2 pt-1">
              <div className="text-sm text-muted-foreground">
                LLM 判断出 {result.questions.length} 道 · {result.retries === 0 ? '一次通过' : `自修正 ${result.retries} 次`}
                <span className="ml-2 text-xs text-muted-foreground">先过目,确认质量后再提交审核</span>
              </div>
              {result.questions.map((q, i) => {
                const isOpen = expanded === i;
                return (
                  <div key={i} className="rounded-md border border-border">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 p-2.5 text-left cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExpanded(isOpen ? null : i)}
                    >
                      {isOpen
                        ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      <span className="text-sm text-foreground flex-1">{q.title}</span>
                      <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                        <div className="text-sm text-muted-foreground">{q.focus}</div>
                        <AnswerPanel answer={q.answer} followups={q.followups} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-3.5">
          {result && !loading && (
            <>
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={submitting}>重新生成</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '提交中…' : `提交审核(${result.questions.length} 题)`}
              </Button>
            </>
          )}
          {!result && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? `生成中…已用 ${elapsed}s` : '生成'}
              </Button>
            </>
          )}
          {loading && (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>取消生成</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
