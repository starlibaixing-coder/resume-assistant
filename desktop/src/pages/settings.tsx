// 设置(M9):分组卡纵列 —— AI 服务(Provider/Key/BaseURL/测试连接)/ 学习偏好(batch_size)/
// 外观(暖纸/夜读,即时生效)/ 官方题库(同步三态)/ 备份(导出/导入,真机下载需后端 dialog+fs)/ 关于。

import { useEffect, useRef, useState } from 'react';
import { DatabaseBackupIcon, DownloadIcon, KeyRoundIcon, PaletteIcon, RefreshCwIcon, ServerIcon, SlidersHorizontalIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PageHeader } from '@/components/biz/states';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { downloadTextFile, envelopeToJson, myQuestionsToYaml, parseEnvelope, type QuestionYamlSource } from '@/lib/backup';
import { isTauri } from '@/lib/db';
import { PROVIDERS } from '@/lib/types';
import { useMeta, useMyQuestions, useSecret, useThemeValue } from '@/lib/hooks';
import { buildEnvelope, importEnvelope, setMeta, setSecret } from '@/lib/storage';
import { lastSyncAt, syncOfficial } from '@/lib/sync';
import { setTheme } from '@/lib/theme';
import { testConnection } from '@/lib/generate';
import { formatDateTime } from '@/lib/utils';

export function SettingsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-8">
        <PageHeader title="设置" description="AI 服务、学习偏好、外观与数据管理。" />
        <AiGroup />
        <StudyGroup />
        <AppearanceGroup />
        <SyncGroup />
        <BackupGroup />
        <AboutGroup />
      </div>
    </div>
  );
}

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-display text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ===== AI 服务 =====

function AiGroup() {
  const savedBaseUrl = useMeta('ll_base_url');
  const savedModel = useMeta('ll_model');
  const savedKey = useSecret('llm-api-key');
  const providerId = useMeta('ll_provider') || 'zhipu';
  const preset = PROVIDERS.find((p) => p.id === providerId) ?? PROVIDERS[0];

  const [baseUrl, setBaseUrl] = useState(savedBaseUrl || preset.baseUrl);
  const [model, setModel] = useState(savedModel || preset.model);
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const hydrated = useRef(false);

  // 首次拿到持久化值后不再跟随(本地可编辑)
  useEffect(() => {
    if (!hydrated.current && (savedBaseUrl || savedModel)) {
      setBaseUrl(savedBaseUrl || preset.baseUrl);
      setModel(savedModel || preset.model);
      hydrated.current = true;
    }
  }, [savedBaseUrl, savedModel, preset]);

  const pickProvider = (id: string) => {
    const p = PROVIDERS.find((x) => x.id === id)!;
    setMeta('ll_provider', p.id);
    if (!savedBaseUrl) setBaseUrl(p.baseUrl);
    if (!savedModel) setModel(p.model);
  };

  const cfgReady = !!(savedKey && baseUrl && model);

  const save = async () => {
    setMeta('ll_base_url', baseUrl.trim());
    setMeta('ll_model', model.trim());
    if (keyInput.trim()) {
      try {
        await setSecret('llm-api-key', keyInput.trim());
      } catch (e) {
        toast.error('API Key 保存失败', { description: e instanceof Error ? e.message : String(e) });
        return;
      }
    }
    toast.success('AI 服务配置已保存');
  };

  const test = async () => {
    if (!savedKey) {
      toast.error('请先填写并保存 API Key');
      return;
    }
    setTesting(true);
    try {
      await testConnection({ apiKey: savedKey, baseUrl: baseUrl.trim(), model: model.trim(), ready: true });
      toast.success('连接成功');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(/鉴权失败/.test(msg) ? 'API Key 无效' : /网络错误/.test(msg) ? '网络错误,检查 Base URL' : `连接失败:${msg}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Group icon={<ServerIcon />} title="AI 服务">
      <div className="space-y-1.5">
        <Label>服务商</Label>
        <RadioGroup value={preset.id} onValueChange={pickProvider} className="flex h-9 items-center gap-5">
          {PROVIDERS.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value={p.id} id={`provider-${p.id}`} />
              <Label htmlFor={`provider-${p.id}`} className="font-normal">
                {p.label}
              </Label>
            </span>
          ))}
        </RadioGroup>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ll-base-url">Base URL</Label>
          <Input id="ll-base-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={preset.baseUrl} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ll-model">模型</Label>
          <Input id="ll-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder={preset.model} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ll-key">
          <KeyRoundIcon className="inline size-3.5" /> API Key
        </Label>
        <Input
          id="ll-key"
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={savedKey ? '已配置(不回显,可覆盖)' : '粘贴 API Key'}
          autoComplete="off"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={testing || !cfgReady} onClick={test}>
          {testing ? '测试中…' : '测试连接'}
        </Button>
        <Button onClick={save}>保存</Button>
      </div>
    </Group>
  );
}

// ===== 学习偏好 =====

function StudyGroup() {
  const batch = useMeta('batch_size') || '50';
  return (
    <Group icon={<SlidersHorizontalIcon />} title="学习偏好">
      <div className="space-y-1.5">
        <Label>每次学习题量</Label>
        <RadioGroup value={batch} onValueChange={(v) => setMeta('batch_size', v)} className="flex h-9 items-center gap-5">
          {(['20', '50', 'all'] as const).map((v) => (
            <span key={v} className="flex items-center gap-1.5 text-sm">
              <RadioGroupItem value={v} id={`batch-${v}`} />
              <Label htmlFor={`batch-${v}`} className="font-normal">
                {v === 'all' ? '全部学完' : `每次 ${v} 题`}
              </Label>
            </span>
          ))}
        </RadioGroup>
        <p className="text-xs text-muted-foreground">复习永远不限量(ADR-0001);此选项只限制每次「学习」进入队列的题量。</p>
      </div>
    </Group>
  );
}

// ===== 外观 =====

function AppearanceGroup() {
  const theme = useThemeValue();
  return (
    <Group icon={<PaletteIcon />} title="外观">
      <div className="space-y-1.5">
        <Label>主题</Label>
        <RadioGroup value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')} className="flex h-9 items-center gap-5">
          <span className="flex items-center gap-1.5 text-sm">
            <RadioGroupItem value="light" id="theme-light" />
            <Label htmlFor="theme-light" className="font-normal">
              暖纸(浅色)
            </Label>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <RadioGroupItem value="dark" id="theme-dark" />
            <Label htmlFor="theme-dark" className="font-normal">
              夜读(深色)
            </Label>
          </span>
        </RadioGroup>
      </div>
    </Group>
  );
}

// ===== 官方题库同步 =====

function SyncGroup() {
  const [syncing, setSyncing] = useState(false);
  const last = lastSyncAt();
  const run = async () => {
    setSyncing(true);
    try {
      const r = await syncOfficial();
      if (r.status === 'same') toast.info('官方题库已是最新');
      else if (r.status === 'updated') toast.success(`更新 ${r.added + r.removed} 题`, { description: `新增 ${r.added} 题,下架 ${r.removed} 题(连带清进度)` });
      else toast.error(`同步失败:${r.message}`, { description: '可稍后重试,不影响本地使用' });
    } finally {
      setSyncing(false);
    }
  };
  return (
    <Group icon={<RefreshCwIcon />} title="官方题库">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {last ? `上次同步:${formatDateTime(last)}` : '尚未同步;启动时会自动后台同步。'}
        </div>
        <Button size="sm" variant="outline" disabled={syncing} onClick={run} data-testid="sync-btn">
          {syncing ? '同步中…' : '立即同步'}
        </Button>
      </div>
    </Group>
  );
}

// ===== 备份 =====

function BackupGroup() {
  const my = useMyQuestions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImportEnv, setPendingImportEnv] = useState<ReturnType<typeof parseEnvelope> | null>(null);

  const exportJson = () => {
    const name = `commitcareer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (!downloadTextFile(name, envelopeToJson(buildEnvelope()))) {
      toast.info('当前版本暂不支持在桌面端导出文件', { description: '文件导出能力将在后续版本提供。' });
    }
  };

  const exportYaml = () => {
    const approved: QuestionYamlSource[] = my
      .filter((q) => q.status === 'approved')
      .map((q) => ({ id: q.id, difficulty: q.difficulty, tags: q.tags, title: q.title, focus: q.focus, answer: q.answer, followups: q.followups }));
    if (approved.length === 0) {
      toast.info('我的题库还没有已入库的题目');
      return;
    }
    if (!downloadTextFile('my-questions.yaml', myQuestionsToYaml(approved), 'text/yaml')) {
      toast.info('当前版本暂不支持在桌面端导出文件', { description: '文件导出能力将在后续版本提供。' });
    }
  };

  const onFile = async (file: File) => {
    try {
      const env = parseEnvelope(await file.text());
      setPendingImportEnv(env); // 校验通过,弹确认(整库覆盖)
    } catch (e) {
      toast.error('导入失败', { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Group icon={<DatabaseBackupIcon />} title="备份">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportJson}>
          <DownloadIcon /> 导出备份(JSON)
        </Button>
        <Button size="sm" variant="outline" onClick={exportYaml}>
          <DownloadIcon /> 导出我的题目(YAML)
        </Button>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          导入备份…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        备份含题目、进度、笔记、草稿、JD 与设置,不含 API Key;导入为整库覆盖。{isTauri() && '当前版本暂不支持在桌面端导出文件。'}
      </p>

      <AlertDialog open={!!pendingImportEnv} onOpenChange={(o) => !o && setPendingImportEnv(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导入将覆盖当前全部数据</AlertDialogTitle>
            <AlertDialogDescription>
              现有题目、进度、笔记、JD 与设置会被备份文件整体替换,且不可恢复。确定继续吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const env = pendingImportEnv;
                setPendingImportEnv(null);
                if (!env) return;
                try {
                  await importEnvelope(env);
                  toast.success('备份已导入');
                } catch (e) {
                  toast.error('导入失败', { description: e instanceof Error ? e.message : String(e) });
                }
              }}
            >
              覆盖导入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Group>
  );
}

// ===== 关于 =====

function AboutGroup() {
  return (
    <Group icon={<ServerIcon />} title="关于">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>CommitCareer · 求职学习工作台</p>
        <p>数据保存在本机 SQLite(resume.db),不经任何服务器;API Key 仅存本机 secrets 表,界面永不回显。</p>
      </div>
    </Group>
  );
}
