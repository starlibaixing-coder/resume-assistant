// 添加题目(M5):三段平铺(禁 Tabs,D7)—— 按使用频率排序:AI 生成 → 按 JD 生成 → 手动录入。
// AI / 按 JD 产物先进审核(ADR-10);手动人写即人审,直接入我的题库。
// 深链 ?jd=<id> 定位按 JD 段并预选。AI 未配置 → 引导条精确列出缺项。

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { AlertCircleIcon, BriefcaseIcon, Loader2Icon, PencilLineIcon, SparklesIcon, Wand2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuestionFormFields, applyDraft, validateDraft } from '@/components/biz/edit-question-form';
import { generateQuestions, resolveConfig } from '@/lib/generate';
import { useJdList, useMeta, useResumes, useSecret } from '@/lib/hooks';
import { nextMyQuestionId, saveMyQuestion } from '@/lib/storage';
import { apiKeySecretName, PROVIDERS, providerNeedsKey } from '@/lib/types';
import type { Jd } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AddPage() {
  const [params] = useSearchParams();
  const jdParam = params.get('jd');
  const jdSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (jdParam) jdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jdParam]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-8">
        <div>
          <h1 className="font-display text-lg font-semibold">添加题目</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            选择出题方式。AI 生成与按 JD 生成先进入待审核;手动录入直接进入我的题库。
          </p>
        </div>

        <AiSection />
        <div ref={jdSectionRef}>
          <JdSection preselectId={jdParam ? Number(jdParam) : null} />
        </div>
        <ManualSection />
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  desc,
  children,
  highlight,
  testid,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
  highlight?: boolean;
  testid?: string;
}) {
  return (
    <section
      data-testid={testid}
      data-highlight={highlight ? 'true' : undefined}
      className={cn('rounded-xl bg-card p-6 shadow-sm', highlight && 'ring-2 ring-primary/40')}
    >
      <div className="mb-5 flex items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ===== AI 服务配置状态(全页共用) =====

function useLlmConfig() {
  const providerId = useMeta('ll_provider') || 'zhipu';
  const preset = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];
  const apiKey = useSecret(apiKeySecretName(providerId));
  // 配置按服务商各存各的;缺省回落该家预设
  const baseUrl = useMeta(`ll_base_url:${providerId}`) || preset.baseUrl;
  const model = useMeta(`ll_model:${providerId}`) || preset.model;
  return useMemo(() => {
    const keyMissing = providerNeedsKey(providerId) && !apiKey;
    return {
      cfg: resolveConfig(providerId, baseUrl, model, apiKey),
      missing: [keyMissing && 'API Key', !baseUrl && 'Base URL', !model && '模型'].filter(Boolean).join('、'),
    };
  }, [apiKey, baseUrl, model, providerId]);
}

function ConfigGuide({ missing }: { missing: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning" data-testid="ai-guide">
      <AlertCircleIcon className="size-4 shrink-0" />
      AI 服务还没配置完整,缺少:{missing}。请先到「设置 · AI 服务」完成配置。
    </div>
  );
}

function llmErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/鉴权失败/.test(msg)) return 'API Key 无效,请到「设置 · AI 服务」检查';
  if (/网络错误/.test(msg)) return '网络错误,请检查 Base URL 或网络连接';
  return `生成失败:${msg}`;
}

// ===== AI 生成 =====

function AiSection() {
  const { cfg, missing } = useLlmConfig();
  const [knowledge, setKnowledge] = useState('');
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!knowledge.trim()) return;
    setRunning(true);
    try {
      const { saved } = await generateQuestions({ kind: 'ai', prompt: knowledge.trim() }, cfg);
      toast.success(`已生成 ${saved.length} 道题,进入待审核`, { description: '到「审核」页裁定后才会进入我的题库。' });
      setKnowledge('');
    } catch (e) {
      toast.error(llmErrorText(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <SectionCard icon={<SparklesIcon />} title="AI 生成题目" desc="输入知识点,AI 围绕它出题;生成后先进待审核。" testid="section-ai">
      {!cfg.ready && <ConfigGuide missing={missing} />}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ai-knowledge">
            <span className="text-destructive">*</span> 知识点
          </Label>
          <Input
            id="ai-knowledge"
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder="如:Event Loop 与微任务 / RAG 召回优化"
          />
        </div>
        <div className="flex justify-end">
          <Button disabled={!cfg.ready || running || !knowledge.trim()} onClick={run} data-testid="ai-generate-btn">
            {running ? <Loader2Icon className="animate-spin" /> : <Wand2Icon />}
            {running ? '生成中…' : 'AI 生成题目'}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

// ===== 按 JD 生成 =====

function JdSection({ preselectId }: { preselectId: number | null }) {
  const jds = useJdList();
  const { cfg, missing } = useLlmConfig();
  const resumes = useResumes();
  const [jdId, setJdId] = useState<string>(preselectId ? String(preselectId) : jds[0] ? String(jds[0].id) : '');
  const [withResume, setWithResume] = useState(false);
  const [resumePick, setResumePick] = useState<number | null>(null); // null = 默认最近编辑(B6)
  const [running, setRunning] = useState(false);
  const activeResume = resumes.find((r) => r.id === resumePick) ?? resumes[0] ?? null;
  const resumeEmpty = !activeResume || !activeResume.content.trim();

  useEffect(() => {
    if (preselectId && jds.some((j) => j.id === preselectId)) setJdId(String(preselectId));
  }, [preselectId, jds]);

  const jd: Jd | undefined = jds.find((j) => String(j.id) === jdId);

  const run = async () => {
    if (!jd) return;
    setRunning(true);
    try {
      const { saved } = await generateQuestions(
        {
          kind: 'jd',
          prompt: jd.content,
          jdTitle: jd.company ? `${jd.company} · ${jd.title}` : jd.title,
          jdId: jd.id,
          resume: withResume ? activeResume?.content : undefined,
        },
        cfg,
      );
      toast.success(`已生成 ${saved.length} 道题,进入待审核`, { description: '到「审核」页裁定后才会进入我的题库。' });
    } catch (e) {
      toast.error(llmErrorText(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <SectionCard
      icon={<BriefcaseIcon />}
      title="按 JD 生成题目"
      desc="对着招聘要求出题,定位知识盲区;生成后先进待审核。"
      highlight={!!preselectId}
      testid="section-jd"
    >
      {!cfg.ready && <ConfigGuide missing={missing} />}
      {jds.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有 JD。先到「JD」页添加一条招聘要求,再回来按它生成题目。</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jd-pick">目标 JD</Label>
            <Select value={jdId} onValueChange={setJdId}>
              <SelectTrigger className="w-full" aria-label="选择 JD" data-testid="jd-select">
                <SelectValue placeholder="选择 JD" />
              </SelectTrigger>
              <SelectContent>
                {jds.map((j) => (
                  <SelectItem key={j.id} value={String(j.id)}>
                    {j.company ? `${j.company} · ${j.title}` : j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="with-resume" checked={withResume} disabled={resumeEmpty || running} onCheckedChange={(v) => setWithResume(!!v)} />
            <Label htmlFor="with-resume" className="font-normal">
              结合简历出题
            </Label>
            {resumes.length > 1 && (
              <Select
                value={String(activeResume?.id ?? '')}
                onValueChange={(v) => setResumePick(Number(v))}
              >
                <SelectTrigger aria-label="选择用哪份简历" className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {resumeEmpty && <span className="text-xs text-muted-foreground">简历为空,请先到「简历」页填写</span>}
          </div>
          <div className="flex justify-end">
            <Button disabled={!cfg.ready || running || !jd} onClick={run} data-testid="jd-generate-btn">
              {running ? <Loader2Icon className="animate-spin" /> : <Wand2Icon />}
              {running ? '生成中…' : '按 JD 生成题目'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ===== 手动录入 =====

function blankDraft(): Parameters<typeof QuestionFormFields>[0]['draft'] {
  return { moduleName: '自定义', difficulty: '中', title: '', focus: '', answerText: '', followupsText: '', tagsText: '' };
}

function ManualSection() {
  const [draft, setDraft] = useState(blankDraft);
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const errs = validateDraft(draft);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    const now = Date.now();
    const q = applyDraft(
      {
        id: '',
        origin: 'my',
        category: 'my',
        module: 0,
        moduleName: '',
        index: 0,
        difficulty: '中',
        title: '',
        focus: '',
        answer: [],
        followups: [],
        tags: [],
        status: 'approved',
        source: 'manual',
        sourceId: null,
        sourceRef: '',
        jdId: null,
        isCode: false,
        createdAt: now,
        updatedAt: now,
      },
      { ...draft, moduleName: draft.moduleName || '自定义' },
    );
    q.id = nextMyQuestionId(0);
    saveMyQuestion(q);
    setDraft(blankDraft());
    setErrors([]);
    toast.success('已加入我的题库', { description: `id:${q.id}` });
  };

  return (
    <SectionCard icon={<PencilLineIcon />} title="手动添加题目" desc="自己录入的题目,保存后直接进入我的题库。" testid="section-manual">
      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <QuestionFormFields draft={draft} onChange={setDraft} idPrefix="manual" />
      <div className="mt-5 flex justify-end">
        <Button onClick={submit}>保存题目</Button>
      </div>
    </SectionCard>
  );
}
