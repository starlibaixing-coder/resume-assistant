import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { generateQuestions, generateJdQuestions, type GeneratedQuestion } from '@/lib/generate';
import { getProfile, subscribeProfile } from '@/lib/profile';
import { resolveChatOptions } from '@/lib/llm-config';
import { addDrafts } from '@/lib/mylib';
import type { Difficulty } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';

const DIFFICULTIES: Array<Difficulty | '不限'> = ['不限', '初', '中', '高'];
type Mode = 'topic' | 'jd';

// JD 模式批次名:JD定向 · 公司(无公司取 JD 前 12 字);addDrafts 再截 30 字
function jdBatchName(company: string, jd: string): string {
  const c = company.trim() || jd.trim().slice(0, 12);
  return `JD定向 · ${c}`;
}

const pill = (active: boolean) =>
  `px-2.5 py-1 rounded text-xs font-mono transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
  }`;

export function GeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('topic');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | '不限'>('不限');
  const [includeResume, setIncludeResume] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; retries: number; topic: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  // 进入页面就检查 LLM 配置(不等点生成才提示);从设置页回来也刷新
  const [llmReady, setLlmReady] = useState<boolean | null>(null);

  // 档案跟随 profile 变化(保存/清空后本页摘要同步)
  const [, bump] = useState(0);
  useEffect(() => subscribeProfile(() => bump((v) => v + 1)), []);
  const profile = getProfile();
  const jdReady = !!profile?.jd.trim();

  useEffect(() => {
    const check = () => {
      resolveChatOptions()
        .then((opts) => setLlmReady(!!opts))
        .catch(() => setLlmReady(false));
    };
    check();
  }, [location.pathname]);

  const handleGenerate = async () => {
    setError(null);
    setNoKey(false);
    setResult(null);
    if (mode === 'topic' && !topic.trim()) {
      setError('先填一个知识点,比如「React Hooks 深入」「浏览器事件循环」');
      return;
    }
    if (mode === 'jd' && !jdReady) {
      setError('档案里还没有 JD——先去「求职目标」页填写');
      return;
    }
    const chatOpts = await resolveChatOptions();
    if (!chatOpts) {
      setNoKey(true);
      return;
    }
    setLoading(true);
    try {
      const diff = difficulty === '不限' ? undefined : difficulty;
      const r =
        mode === 'topic'
          ? await generateQuestions({ topic: topic.trim(), difficulty: diff }, chatOpts)
          : await generateJdQuestions(
              profile!,
              { difficulty: diff, includeResume: includeResume && !!profile!.resume.trim() },
              chatOpts,
            );
      setResult({
        questions: r.questions,
        retries: r.retries,
        topic: mode === 'topic' ? topic.trim() : jdBatchName(profile!.company, profile!.jd),
      });
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
      navigate('/drafts');
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
          <span>还没配置 LLM(baseURL / model / API key),生成前需要先设置。</span>
          <Button asChild size="sm">
            <Link to="/settings">去设置 →</Link>
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
        {/* 模式切换:知识点(通用刷题)/ JD 定向(读求职档案,功能④) */}
        <div className="flex gap-2">
          <Button size="sm" variant={mode === 'topic' ? 'default' : 'outline'} onClick={() => setMode('topic')}>
            知识点生题
          </Button>
          <Button size="sm" variant={mode === 'jd' ? 'default' : 'outline'} onClick={() => setMode('jd')}>
            JD 定向
          </Button>
        </div>

        {mode === 'topic' ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">知识点</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="如:React Hooks 深入 / 浏览器事件循环 / RAG 检索优化"
              autoFocus
            />
            <div className="text-xs leading-relaxed text-muted-foreground">
              出多少道题由 LLM 按知识点广度判断(简单概念 2~4 道,宽领域可达 10 道,宁缺毋滥);整批作为一个「批次」进草稿区,审核通过后成为一个模块进我的题库。
            </div>
          </div>
        ) : !jdReady ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
            <span>还没填求职档案——JD 定向生题需要档案里的职位描述(JD)。</span>
            <Button asChild size="sm">
              <Link to="/profile">去填写 →</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-mono">档案上下文</label>
              <div className="text-xs leading-relaxed text-muted-foreground">
                {profile!.company.trim() || '(未填公司)'} · JD {profile!.jd.trim().length} 字
                {profile!.resume.trim() ? ` · 简历 ${profile!.resume.trim().length} 字` : ' · 无简历(只用 JD 出题)'}
              </div>
            </div>
            {profile!.resume.trim() && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">出题范围</span>
                <Button size="sm" variant={!includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(false)}>
                  只用 JD
                </Button>
                <Button size="sm" variant={includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(true)}>
                  结合简历
                </Button>
                <span className="text-xs text-muted-foreground">结合简历 = 出深挖题,考察 JD 要求与简历声称能力的匹配</span>
              </div>
            )}
            <div className="text-xs leading-relaxed text-muted-foreground">
              按 JD 的技术要求出题(核心必备项优先),数量由 LLM 判断;整批进草稿区,审核通过后成一个模块。改动档案去
              <Link to="/profile" className="mx-0.5 text-primary hover:underline">求职目标</Link>。
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">难度</span>
          {DIFFICULTIES.map((d) => (
            <Button key={d} size="sm" variant={difficulty === d ? 'default' : 'outline'} onClick={() => setDifficulty(d)}>
              {d}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground">(出题数量由 LLM 按知识点广度判断)</span>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? '生成中…(LLM 出题约需十几秒)' : '生成'}
        </Button>

        {noKey && (
          <div className="text-sm text-muted-foreground">
            还没配置 LLM。先去{' '}
            <Link to="/settings" className="text-primary hover:underline">设置页</Link>
            {' '}填 API key(智谱/DeepSeek/本地 Ollama 均可)。
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3">
            {error}
          </div>
        )}
        </CardContent>
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
