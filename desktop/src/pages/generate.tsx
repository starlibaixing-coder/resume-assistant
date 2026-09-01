import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { generateQuestions, generateJdQuestions, type GeneratedQuestion } from '@/lib/generate';
import { getProfile, subscribeProfile } from '@/lib/profile';
import { resolveChatOptions } from '@/lib/llm-config';
import { addDrafts, addManualQuestion, getMyCategory } from '@/lib/mylib';
import type { Difficulty } from '@/types/question';
import { AnswerPanel } from '@/components/answer-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EMPTY_FORM,
  QuestionFormFields,
  formToDraft,
  type QuestionFormState,
} from '@/components/question-edit-dialog';

// 生题页:顶层 Tabs「AI 生题 / 手动加题」(2026-08-28 审计 A4)。
// ?mode=manual 深链直达手动表单(队列/浏览页空态入口收敛,A5);
// 手动加题用页面级表单(原 max-w-lg 弹窗塞不下长题干),人写即人审直接 approved(ADR-10)。

const DIFFICULTIES: Array<Difficulty | '不限'> = ['不限', '初', '中', '高'];
type Mode = 'topic' | 'jd';

// JD 模式批次名:JD定向 · 公司(无公司取 JD 前 12 字);addDrafts 再截 30 字
function jdBatchName(company: string, jd: string): string {
  const c = company.trim() || jd.trim().slice(0, 12);
  return `JD定向 · ${c}`;
}

export function GeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageMode = searchParams.get('mode') === 'manual' ? 'manual' : 'ai';

  const [mode, setMode] = useState<Mode>('topic');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty | '不限'>('不限');
  const [includeResume, setIncludeResume] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null); // 存草稿失败:就近渲染在结果区,不远处表单卡底
  const [noKey, setNoKey] = useState(false);
  const [result, setResult] = useState<{ questions: GeneratedQuestion[]; retries: number; topic: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  // 生成计时(审计 C5:LLM 十几秒,光"生成中"不够)与取消(AbortSignal 透传到 fetch)
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
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

  // 生成中每秒计时(审计 C5:十几秒的等待,光"生成中"不够);离开页面中断请求
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleGenerate = async () => {
    setError(null);
    setNoKey(false);
    // 不预清旧结果:重新生成期间旧批次保持在屏,新结果回来才替换(审计 D)
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
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setElapsed(0);
    setLoading(true);
    try {
      const diff = difficulty === '不限' ? undefined : difficulty;
      const r =
        mode === 'topic'
          ? await generateQuestions({ topic: topic.trim(), difficulty: diff }, { ...chatOpts, signal: ctrl.signal })
          : await generateJdQuestions(
              profile!,
              { difficulty: diff, includeResume: includeResume && !!profile!.resume.trim() },
              { ...chatOpts, signal: ctrl.signal },
            );
      setResult({
        questions: r.questions,
        retries: r.retries,
        topic: mode === 'topic' ? topic.trim() : jdBatchName(profile!.company, profile!.jd),
      });
    } catch (e) {
      // 主动取消:静默回到表单态,不算错误
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  };

  const handleSaveDrafts = async () => {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
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
      toast.success('已存入草稿区,审核通过后进我的题库');
      navigate('/drafts');
    } catch (e) {
      // 失败就近渲染在结果区按钮下方(审计 D),不远放表单卡
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="生题" subtitle="AI 生成整批进草稿区审核;或手动写一道,直接进我的题库。" />

      <Tabs
        value={pageMode}
        onValueChange={(v) => setSearchParams(v === 'manual' ? { mode: 'manual' } : {}, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="ai">AI 生题</TabsTrigger>
          <TabsTrigger value="manual">手动加题</TabsTrigger>
        </TabsList>

        {/* forceMount 保持挂载(切 tab 不丢已生成的结果/表单),但 radix 的 forceMount 不隐藏——
            必须自己按 data-state 加 display:none,否则两个 tab 内容同时渲染(2026-08-31 用户发现) */}
        <TabsContent value="ai" forceMount className="mt-6 space-y-6 data-[state=inactive]:hidden">
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
              <Button size="sm" variant={mode === 'topic' ? 'default' : 'outline'} onClick={() => setMode('topic')} disabled={loading}>
                知识点生题
              </Button>
              <Button size="sm" variant={mode === 'jd' ? 'default' : 'outline'} onClick={() => setMode('jd')} disabled={loading}>
                JD 定向
              </Button>
            </div>

            {mode === 'topic' ? (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">知识点</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    // 回车即生成(输入法组词结束才触发,审计 D)
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !loading) void handleGenerate();
                  }}
                  placeholder="如:React Hooks 深入 / 浏览器事件循环 / RAG 检索优化"
                  autoFocus
                  disabled={loading}
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
                  <label className="text-xs text-muted-foreground">档案上下文</label>
                  <div className="text-xs leading-relaxed text-muted-foreground">
                    {profile!.company.trim() || '(未填公司)'} · JD {profile!.jd.trim().length} 字
                    {profile!.resume.trim() ? ` · 简历 ${profile!.resume.trim().length} 字` : ' · 无简历(只用 JD 出题)'}
                  </div>
                </div>
                {profile!.resume.trim() && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">出题范围</span>
                    <Button size="sm" variant={!includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(false)} disabled={loading}>
                      只用 JD
                    </Button>
                    <Button size="sm" variant={includeResume ? 'default' : 'outline'} onClick={() => setIncludeResume(true)} disabled={loading}>
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
              <span className="text-xs text-muted-foreground">难度</span>
              {DIFFICULTIES.map((d) => (
                <Button key={d} size="sm" variant={difficulty === d ? 'default' : 'outline'} onClick={() => setDifficulty(d)} disabled={loading}>
                  {d}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">(出题数量由 LLM 按知识点广度判断)</span>
            </div>

            {/* 生成中锁定表单 + 可取消(审计 C5) */}
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={loading} className="flex-1">
                {loading ? `生成中…已用 ${elapsed}s` : '生成'}
              </Button>
              {loading && (
                <Button variant="outline" onClick={() => abortRef.current?.abort()}>
                  取消
                </Button>
              )}
            </div>

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
                <div className="text-sm text-muted-foreground">
                  LLM 判断出 {result.questions.length} 道 · {result.retries === 0 ? '一次通过' : `自修正 ${result.retries} 次`}
                  {loading && <span className="ml-2 text-xs">重新生成中…</span>}
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

              {saveError && (
                <div className="text-sm text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  {saveError}
                </div>
              )}

              {result.questions.map((q, i) => {
                const isOpen = expanded === i;
                return (
                  <Card key={i} className="overflow-hidden">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 p-3 text-left cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setExpanded(isOpen ? null : i)}
                    >
                      {isOpen
                        ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      <span className="text-sm text-foreground flex-1">{q.title}</span>
                      <Badge variant="outline" className="shrink-0">{q.difficulty}</Badge>
                    </button>
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
        </TabsContent>

        <TabsContent value="manual" forceMount className="mt-6 data-[state=inactive]:hidden">
          <ManualAddForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 模块归属:'new' = 新建模块,否则为模块号字符串
const NEW_MODULE = '__new__';

// 手动加题页面级表单:直接 approved(人写即人审,ADR-10 只约束 AI 产物),保存即进刷题/SM-2。
// 保存后清空题面、保留模块选择——连续录入同一模块不用重选。
function ManualAddForm() {
  const [form, setForm] = useState<QuestionFormState>(EMPTY_FORM);
  const [modules, setModules] = useState<Array<{ id: number; name: string }>>(() =>
    getMyCategory().modules.map((m) => ({ id: m.id, name: m.name })),
  );
  const [moduleTarget, setModuleTarget] = useState(NEW_MODULE);
  const [newModuleName, setNewModuleName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const existing = modules.find((m) => String(m.id) === moduleTarget);
      const created = await addManualQuestion(formToDraft(form), existing
        ? { moduleId: existing.id, moduleName: existing.name }
        : { moduleName: newModuleName });
      toast.success('已加入我的题库', { description: created.id });
      // 重置题面;模块指到刚落的模块,连续加题不重选
      setForm(EMPTY_FORM);
      setModules(getMyCategory().modules.map((m) => ({ id: m.id, name: m.name })));
      setModuleTarget(String(created.module));
      setNewModuleName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">归属模块</label>
          <div className="flex items-center gap-2">
            <Select value={moduleTarget} onValueChange={setModuleTarget}>
              <SelectTrigger aria-label="归属模块" className="h-9 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={NEW_MODULE} className="text-xs">新建模块</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                    {String(m.id).padStart(2, '0')} · {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {moduleTarget === NEW_MODULE && (
              <Input
                className="flex-1"
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                placeholder="模块名,如:面试手写"
                aria-label="新模块名"
              />
            )}
          </div>
        </div>

        <QuestionFormFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />

        {error && (
          <div className="text-sm text-destructive whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 p-3">
            {error}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? '保存中…' : '加入我的题库'}
        </Button>
        <div className="text-xs leading-relaxed text-muted-foreground">
          手写的题不经草稿区,保存后直接进我的题库与复习队列;提交走共享校验(答案要点合计 ≥50 字)。
        </div>
      </CardContent>
    </Card>
  );
}
