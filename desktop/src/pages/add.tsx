// 添加题目(M5):三段平铺(禁 Tabs,D7)—— 手动(approved 直接入库)/ AI 知识点生成 /
// 按 JD 生成(产物一律 pending,ADR-10)。深链 ?jd=<id> 定位第三段并预选。
// AI 未配置 → 引导条 + 禁用;简历为空 → 「结合简历」禁用并提示。

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useJdList, useMyQuestions, useProfile, useSecret } from '@/lib/hooks';
import { getMeta, nextMyQuestionId, saveMyQuestion } from '@/lib/storage';
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
          <p className="mt-0.5 text-sm text-muted-foreground">手动添加直接入库;AI / 按 JD 生成会先进审核,通过后才进入复习队列。</p>
        </div>

        <ManualSection />

        <AiSection />

        <div ref={jdSectionRef}>
          <JdSection preselectId={jdParam ? Number(jdParam) : null} />
        </div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, desc, children, highlight }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section
      data-highlight={highlight ? 'true' : undefined}
      className={cn('rounded-xl bg-card p-6 shadow-sm', highlight && 'ring-2 ring-primary/40')}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="text-primary">{icon}</span>
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ===== 手动 =====

function blankDraft(): Parameters<typeof QuestionFormFields>[0]['draft'] {
  return { moduleName: '自定义', difficulty: '中', title: '', focus: '', answerText: '', followupsText: '', tagsText: '' };
}

function ManualSection() {
  const allMy = useMyQuestions();
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
    toast.success('已入库', { description: `id:${q.id}` });
    void allMy;
  };

  return (
    <SectionCard icon={<PencilLineIcon />} title="手动添加" desc="自己写的题,人写即人审,直接进入题库。">
      {errors.length > 0 && (
        <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}
      <QuestionFormFields draft={draft} onChange={setDraft} idPrefix="manual" />
      <div className="mt-4 flex justify-end">
        <Button onClick={submit}>入库</Button>
      </div>
    </SectionCard>
  );
}


// ===== AI 生成 =====

function useLlmConfig() {
  const apiKey = useSecret('llm-api-key');
  return useMemo(() => resolveConfig((k) => getMeta(k), apiKey), [apiKey]);
}

function AiSection() {
  const cfg = useLlmConfig();
  const ready = cfg.ready;
  const [knowledge, setKnowledge] = useState('');
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!knowledge.trim()) return;
    setRunning(true);
    try {
      const { saved } = await generateQuestions({ kind: 'ai', prompt: knowledge.trim() }, cfg);
      toast.success(`已生成 ${saved.length} 题,待审核`, {
        description: '到「审核」页裁定后才会进入题库。',
      });
      setKnowledge('');
    } catch (e) {
      toast.error(llmErrorText(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <SectionCard icon={<SparklesIcon />} title="AI 生成" desc="给一个知识点,AI 围绕它出题;产物先进审核。">
      {!ready && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning" data-testid="ai-guide">
          <AlertCircleIcon className="size-4 shrink-0" />
          先到「设置 · AI 服务」配置服务商与 API Key,再使用生成。
        </div>
      )}
      <div className="space-y-3">
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
          <Button disabled={!ready || running || !knowledge.trim()} onClick={run} data-testid="ai-generate-btn">
            {running ? <Loader2Icon className="animate-spin" /> : <Wand2Icon />}
            {running ? '生成中…' : '生成题目'}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}


function llmErrorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API Key 无效|鉴权失败/.test(msg)) return 'API Key 无效,请到设置检查';
  if (/网络错误/.test(msg)) return '网络错误,请检查 Base URL 或代理';
  return `生成失败:${msg}`;
}

// ===== 按 JD 生成 =====

function JdSection({ preselectId }: { preselectId: number | null }) {
  const jds = useJdList();
  const cfg = useLlmConfig();
  const ready = cfg.ready;
  const profile = useProfile();
  const [jdId, setJdId] = useState<string>(preselectId ? String(preselectId) : jds[0] ? String(jds[0].id) : '');
  const [withResume, setWithResume] = useState(false);
  const [running, setRunning] = useState(false);
  const resumeEmpty = !profile.resume.trim();

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
          resume: withResume ? profile.resume : undefined,
        },
        cfg,
      );
      toast.success(`已生成 ${saved.length} 题,待审核`, { description: '到「审核」页裁定后才会进入题库。' });
    } catch (e) {
      toast.error(llmErrorText(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <SectionCard icon={<BriefcaseIcon />} title="按 JD 生成" desc="对着一招聘要求出题,查漏补缺;产物先进审核。" highlight={!!preselectId}>
      {!ready && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircleIcon className="size-4 shrink-0" />
          先到「设置 · AI 服务」配置服务商与 API Key,再使用生成。
        </div>
      )}
      {jds.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有 JD。到「JD」页添加一条招聘要求,再回来按它出题。</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>目标 JD</Label>
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
            {resumeEmpty && <span className="text-xs text-muted-foreground">简历为空,先到「简历」页填写</span>}
          </div>
          <div className="flex justify-end">
            <Button disabled={!ready || running || !jd} onClick={run} data-testid="jd-generate-btn">
              {running ? <Loader2Icon className="animate-spin" /> : <Wand2Icon />}
              {running ? '生成中…' : '生成题目'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

