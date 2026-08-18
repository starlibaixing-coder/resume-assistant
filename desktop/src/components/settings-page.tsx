import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';
import { PRESETS, loadConfig, loadKey, saveConfig, saveKey, isTauri } from '@/lib/llm-config';
import { useTheme, type Theme } from '@/lib/theme';
import { useQuestions } from '@/lib/questions';
import { clearProgress, clearNotes, loadProgress, loadNotes } from '@/lib/storage';
import { getMyCategory } from '@/lib/mylib';
import { loadLimit, saveLimit, LIMIT_OPTIONS } from '@/lib/prefs';
import { chat } from '@/lib/provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

// 设置页五分区:刷题(全局偏好)→ 外观 → LLM(生题)→ 数据管理 → 关于。

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

export function SettingsPage() {
  const { data } = useQuestions();
  const myCategory = getMyCategory();

  // ── 刷题 ──
  const [limit, setLimit] = useState<number>(() => loadLimit());

  // ── 外观 ──
  const { theme, setTheme } = useTheme();

  // ── LLM ──
  const [preset, setPreset] = useState(loadConfig().preset);
  const [baseURL, setBaseURL] = useState(loadConfig().baseURL);
  const [model, setModel] = useState(loadConfig().model);
  const [apiKey, setApiKey] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // ── 数据管理 ──
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState<{ kind: 'progress' | 'notes'; category: string; name: string } | null>(null);

  // 启动时从 keyring 读 key(只判断有无,不回显明文)
  useEffect(() => {
    loadKey()
      .then((k) => {
        setApiKey(k ? '********' : '');
        setKeyLoaded(!!k);
      })
      .catch(() => setKeyLoaded(false));
  }, []);

  const pickPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setBaseURL(p.baseURL);
    setModel(p.model);
    setStatus(null);
  };

  const handleSave = async () => {
    try {
      saveConfig({ preset, baseURL: baseURL.trim(), model: model.trim() });
      // 占位符 ******** = 不改 key
      if (apiKey && apiKey !== '********') {
        await saveKey(apiKey.trim());
        setKeyLoaded(true);
        setApiKey('********');
      }
      setStatus({ kind: 'ok', text: '已保存' });
    } catch (e) {
      setStatus({ kind: 'err', text: `保存失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus({ kind: 'info', text: '测试中…' });
    try {
      // 用当前表单值直接测(不要求先保存)
      const key = apiKey && apiKey !== '********' ? apiKey.trim() : await loadKey();
      if (!key) throw new Error('未填 API key');
      if (!baseURL.trim() || !model.trim()) throw new Error('baseURL / model 未填全');
      const reply = await chat(
        [
          { role: 'system', content: '只回复:ok' },
          { role: 'user', content: 'ping' },
        ],
        { apiKey: key, baseURL: baseURL.trim(), model: model.trim() },
      );
      setStatus({ kind: 'ok', text: `连通正常${reply ? `:${reply.slice(0, 20)}` : ''}` });
    } catch (e) {
      setStatus({ kind: 'err', text: `连接失败: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  // 分类清单:官方 + 我的库(即使为空也列,进度/笔记可能残留)
  const categories = [
    ...(data?.categories ?? []).filter((c) => c.slug !== 'my').map((c) => ({ slug: c.slug, name: c.name })),
    { slug: 'my', name: myCategory.name },
  ];

  const handleClear = () => {
    if (!confirm) return;
    if (confirm.kind === 'progress') clearProgress(confirm.category);
    else clearNotes(confirm.category);
    setConfirm(null);
    setRefresh((v) => v + 1);
  };

  const activePreset = PRESETS.find((p) => p.id === preset);

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-refresh={refresh}>
      <PageHeader title="设置" />

      {/* ── 刷题 ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">刷题</CardTitle></CardHeader>
        <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">每次学习题量</span>
          {LIMIT_OPTIONS.map((opt) => (
            <Button
              key={opt}
              size="sm"
              variant={limit === opt ? 'default' : 'outline'}
              className="font-mono"
              onClick={() => {
                setLimit(opt);
                saveLimit(opt);
              }}
            >
              {opt === 0 ? '全部' : opt}
            </Button>
          ))}
        </div>
          <p className="text-xs text-muted-foreground">进入队列即按此数量取题;待复习优先,不足用新题补。</p>
        </CardContent>
      </Card>

      {/* ── 外观 ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">外观</CardTitle></CardHeader>
        <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant={theme === o.value ? 'default' : 'outline'}
              onClick={() => setTheme(o.value)}
            >
              <o.icon className="mr-1.5 h-3.5 w-3.5" />
              {o.label}
            </Button>
          ))}
        </div>
        </CardContent>
      </Card>

      {/* ── LLM ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">LLM(AI 生题用)</CardTitle></CardHeader>
        <CardContent className="space-y-5">

        {/* 预设 */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">服务商(OpenAI 兼容)</div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={preset === p.id ? 'default' : 'outline'}
                onClick={() => pickPreset(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
          {activePreset?.hint && (
            <div className="text-xs text-muted-foreground font-mono">{activePreset.hint}</div>
          )}
        </div>

        {/* baseURL / model */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">baseURL</label>
            <Input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://…/v1" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">model</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="glm-4-flash" />
          </div>
        </div>

        {/* API key */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono">
            API key{keyLoaded ? '(已存于系统钥匙串)' : ''}
          </label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyLoaded ? '留空或 ******** 保持不变' : 'sk-…'}
            autoComplete="off"
          />
          <div className="text-xs text-muted-foreground">
            {isTauri()
              ? 'key 只存操作系统钥匙串(macOS Keychain),不落应用数据目录。'
              : '当前是浏览器预览:key 仅存内存,刷新即失(桌面版才进钥匙串)。'}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleSave}>保存</Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </Button>
          {status && (
            <span
              className={`text-xs font-mono ${
                status.kind === 'ok' ? 'text-success' : status.kind === 'err' ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {status.text}
            </span>
          )}
        </div>
        </CardContent>
      </Card>

      {/* ── 数据管理 ───────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">数据管理</CardTitle></CardHeader>
        <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          清空操作按分类执行:清空进度删 SM-2 记录(题目和笔记保留);清空笔记只删笔记(进度保留)。均不可恢复。
        </div>
        {categories.map((c) => {
          const progressCount = Object.keys(loadProgress(c.slug)).length;
          const noteCount = Object.keys(loadNotes(c.slug)).length;
          return (
            <div
              key={c.slug}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm">{c.name}</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                  进度 {progressCount} 条 · 笔记 {noteCount} 条
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={progressCount === 0}
                  onClick={() => setConfirm({ kind: 'progress', category: c.slug, name: c.name })}
                >
                  清空进度
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={noteCount === 0}
                  onClick={() => setConfirm({ kind: 'notes', category: c.slug, name: c.name })}
                >
                  清空笔记
                </Button>
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>

      {/* ── 关于 ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">关于</CardTitle></CardHeader>
        <CardContent>
          <a
            href="https://github.com/starlibaixing-coder/resume-assistant"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-muted-foreground hover:text-primary"
          >
            GitHub ↗ 源码与官方题库
          </a>
        </CardContent>
      </Card>

      {/* 清空确认 */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.kind === 'progress' ? '清空复习进度?' : '清空笔记?'}</DialogTitle>
            <DialogDescription>
              将删除「{confirm?.name}」的{confirm?.kind === 'progress' ? '全部刷题进度(SM-2 记录)' : '全部笔记'}
              ,{confirm?.kind === 'progress' ? '笔记会保留' : '复习进度会保留'}。此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" onClick={handleClear}>确认清空</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
