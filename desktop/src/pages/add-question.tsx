import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Pencil, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { generateQuestions, generateJdQuestions, type GeneratedQuestion } from '@/lib/generate';
import { getProfile } from '@/lib/profile';
import { getJds, type Jd } from '@/lib/jd';
import { resolveChatOptions } from '@/lib/llm-config';
import { addDrafts } from '@/lib/mylib';
import { ManualAddForm } from '@/components/question-edit-dialog';
import type { Difficulty } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 添加题目页(2026-09-03,弃弹窗改独立路由 /add):三种方式——手动(直接 approved,
// 人写即人审)/ AI 生成 / 按 JD 生成(后两者先进待审核,ADR-10)。
// ?jd=<id> 深链(JD 条目行内捷径)锁定按 JD 模式。生成可取消、计时、失败可重试、
// 预览后才提交;AI/按 JD 提交后跳待审核,手动保存后落我的题库题目列表。

export type AddQuestionTab = 'manual' | 'ai' | 'jd';

const DIFFICULTIES: Array<Difficulty | '不限'> = ['不限', '初', '中', '高'];

// JD 模式批次名:JD定向 · 公司(无公司取 JD 前 12 字);addDrafts 再截 30 字
function jdBatchName(jd: Jd): string {
  const c = jd.company.trim() || jd.content.trim().slice(0, 12);
  return `JD定向 · ${c}`;
}

// AI / 按 JD 生成表单(生成→预览→提交审核)。jd 为 null = 按知识点;jd 传入 = 按 JD 定向。
function GenerateForm({ jd, onCancel }: { jd: Jd | null; onCancel: () => void }) {
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
  const navigate = useNavigate();

  const profile = getProfile();

  // 挂载时检查 LLM 配置;卸载(切页签/离页)时中断进行中的生成
  useEffect(() => {
    resolveChatOptions()
      .then((opts) => setLlmReady(!!opts))
      .catch(() => setLlmReady(false));
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

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
      navigate('/drafts');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {llmReady === false && !noKey && (
        <div className="text-sm text-muted-foreground">
          还没配置 LLM。先去设置页填 API key(智谱/DeepSeek/本地 Ollama 均可)。
        </div>
      )}
      {noKey && (
        <div className="text-sm text-muted-foreground">还没配置 LLM。先去设置页填 API key。</div>
      )}

      {jd ? (
        <div className="space-y-2.5">
          <div className="text-xs leading-relaxed text-muted-foreground">
            {jd.company.trim() || '(未填公司)'} · JD {jd.content.trim().length} 字
            {profile?.resume.trim() ? ` · 简历 ${profile.resume.trim().length} 字` : ' · 无简历(只用 JD 生成)'}
          </div>
          {profile?.resume.trim() && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">生成范围</span>
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
            LLM 判断出 {result.questions.length} 道题 · {result.retries === 0 ? '一次通过' : `自修正 ${result.retries} 次`}
            <span className="ml-2 text-xs text-muted-foreground">先过目,确认质量后再提交审核</span>
          </div>
          {result.questions.map((q, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i} className="rounded-md border border-border">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center gap-3 p-2.5 text-left transition-colors hover:bg-accent"
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

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
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
            <Button variant="outline" onClick={onCancel}>取消</Button>
            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? `生成中…已用 ${elapsed}s` : '生成'}
            </Button>
          </>
        )}
        {loading && (
          <Button variant="outline" onClick={() => abortRef.current?.abort()}>取消生成</Button>
        )}
      </div>
    </div>
  );
}

// 按 JD 模式的 JD 下拉(直接进页时未指定 JD)
function JdPicker({ value, onChange }: { value: Jd | null; onChange: (jd: Jd | null) => void }) {
  const jds = getJds();
  if (jds.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        还没有 JD。先去「求职 → JD 管理」添加一份,再按 JD 生成题目。
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">目标 JD</label>
      <Select
        value={value ? String(value.id) : ''}
        onValueChange={(v) => onChange(jds.find((j) => String(j.id) === v) ?? null)}
      >
        <SelectTrigger aria-label="目标 JD" className="h-9 text-xs">
          <SelectValue placeholder="选一份 JD" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {jds.map((j) => (
            <SelectItem key={j.id} value={String(j.id)} className="text-xs">
              {j.title.trim() || '(未填标题)'}{j.company.trim() ? ` · ${j.company.trim()}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AddQuestionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jdParam = params.get('jd');
  const fixedJd = jdParam ? getJds().find((j) => String(j.id) === jdParam) ?? null : null;
  const [jdPick, setJdPick] = useState<Jd | null>(fixedJd);
  const jdSectionRef = useRef<HTMLDivElement | null>(null);

  // JD 深链:同步选中并滚动到「按 JD 生成」段
  useEffect(() => {
    setJdPick(fixedJd);
    if (fixedJd) jdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [fixedJd]);

  const goBack = () => {
    if (window.history.length > 2) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div className="flex items-end justify-between gap-2">
        <PageHeader
          title={fixedJd ? `按 JD 生成题目 · ${fixedJd.title.trim() || '(未填标题)'}` : '添加题目'}
          subtitle="手动写题保存即进我的题库;AI 与按 JD 生成的题先进待审核,通过后入队。"
        />
        <Button variant="outline" size="sm" className="mb-1" onClick={goBack}>返回</Button>
      </div>

      <section data-add-section="manual">
        <SectionHead icon={Pencil} title="手动写题" desc="人写即人审,保存直接进我的题库。" />
        <div className="mt-4">
          <ManualAddForm onSaved={(id) => {
            toast.success('已加入我的题库', { description: id });
            navigate('/my/browse');
          }} />
        </div>
      </section>

      <section data-add-section="ai">
        <SectionHead icon={Sparkles} title="AI 生成" desc="按知识点出一批题,先进待审核。" />
        <div className="mt-4">
          <GenerateForm jd={null} onCancel={goBack} />
        </div>
      </section>

      <section data-add-section="jd" ref={jdSectionRef}>
        <SectionHead icon={Target} title="按 JD 生成" desc="对着目标 JD 的技术要求出题,先进待审核。" />
        <div className="mt-4 space-y-4">
          <JdPicker value={jdPick} onChange={setJdPick} />
          {jdPick && <GenerateForm jd={jdPick} onCancel={goBack} />}
        </div>
      </section>
    </div>
  );
}

// 小节标题行:图标章 + 标题 + 说明(与总览同一套语言)
function SectionHead({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 flex-none items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <p className="mt-1 pl-8.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
