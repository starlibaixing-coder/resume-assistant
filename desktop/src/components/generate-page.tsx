import { useEffect, useState } from 'react';
import { generateQuestions, type GeneratedQuestion } from '@/lib/generate';
import { resolveChatOptions } from '@/lib/llm-config';
import { addDrafts } from '@/lib/mylib';
import type { Difficulty } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

const DIFFICULTIES: Array<Difficulty | '不限'> = ['不限', '初', '中', '高'];

const inputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

const pill = (active: boolean) =>
  `px-2.5 py-1 rounded text-xs font-mono transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
  }`;

export function GeneratePage() {
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | '不限'>('不限');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; retries: number; topic: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  // 进入页面就检查 LLM 配置(不等点生成才提示);从设置页回来也刷新
  const [llmReady, setLlmReady] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      resolveChatOptions()
        .then((opts) => setLlmReady(!!opts))
        .catch(() => setLlmReady(false));
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setNoKey(false);
    setResult(null);
    if (!topic.trim()) {
      setError('先填一个知识点,比如「React Hooks 深入」「浏览器事件循环」');
      return;
    }
    const chatOpts = await resolveChatOptions();
    if (!chatOpts) {
      setNoKey(true);
      return;
    }
    setLoading(true);
    try {
      const r = await generateQuestions(
        { topic: topic.trim(), difficulty: difficulty === '不限' ? undefined : difficulty },
        chatOpts,
      );
      setResult({ questions: r.questions, retries: r.retries, topic: topic.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDrafts = async () => {
    if (!result) return;
    setSaving(true);
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
      );
      window.location.hash = '#/drafts';
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="AI 生题" />

      {llmReady === false && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          <span>还没配置 LLM(服务商 / API key),生成前需要先设置。</span>
          <Button asChild size="sm">
            <a href="#/settings">去设置 →</a>
          </Button>
        </div>
      )}

      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono">知识点</label>
          <input
            className={inputCls}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="如:React Hooks 深入 / 浏览器事件循环 / RAG 检索优化"
            autoFocus
          />
          <div className="text-xs leading-relaxed text-muted-foreground">
            出多少道题由 LLM 按知识点广度判断(简单概念 2~4 道,宽领域可达 10 道,宁缺毋滥);整批作为一个「批次」进草稿区,审核通过后成为一个模块进我的题库。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">难度</span>
          {DIFFICULTIES.map((d) => (
            <button key={d} className={pill(difficulty === d)} onClick={() => setDifficulty(d)}>{d}</button>
          ))}
          <span className="text-xs text-muted-foreground">(出题数量由 LLM 按知识点广度判断)</span>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? '生成中…(LLM 出题约需十几秒)' : '生成'}
        </Button>

        {noKey && (
          <div className="text-sm text-muted-foreground">
            还没配置 LLM。先去{' '}
            <a href="#/settings" className="text-primary hover:underline">设置页</a>
            {' '}填 API key(智谱/DeepSeek/本地 Ollama 均可)。
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3">
            {error}
          </div>
        )}
      </Card>

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground font-mono">
              LLM 判断出 {result.questions.length} 道 · {result.retries === 0 ? '一次通过' : `自修正 ${result.retries} 次}`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading || saving}>重新生成</Button>
              <Button size="sm" onClick={handleSaveDrafts} disabled={saving}>
                {saving ? '入库中…' : '存入草稿区 →'}
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            先过目,确认质量后进草稿区;在草稿区 approve 才会进刷题队列。
          </div>

          {result.questions.map((q, i) => {
            const isOpen = expanded === i;
            return (
              <Card key={i} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{isOpen ? '▼' : '▶'}</span>
                  <span className="text-sm text-foreground flex-1">{q.title}</span>
                  <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                </div>
                {isOpen && (
                  <div className="px-3.5 pb-4 space-y-2">
                    <div className="text-sm text-muted-foreground pt-2">{q.focus}</div>
                    <AnswerPanel answer={q.answer} followups={q.followups} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
