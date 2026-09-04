import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';
import { loadConfig, loadKey, saveConfig, saveKey, isTauri } from '@/lib/llm-config';
import { syncOfficialBank, getLastSyncedAt } from '@/lib/officialbank';
import { toast } from 'sonner';
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

  // ── LLM(自定义:任何 OpenAI 兼容端点)──
  const [baseURL, setBaseURL] = useState(loadConfig().baseURL);
  const [model, setModel] = useState(loadConfig().model);
  const [apiKey, setApiKey] = useState('');
  // 内联状态只承载"异步就近"的结果:测试连接回显 + key 读取失败;
  // 保存的成败走 toast(全局反馈统一,审计 C1),不再挤在这里
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── 数据管理 ──
  const [refresh, setRefresh] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'progress' | 'notes'; category: string; name: string } | null>(null);

  // 启动时读已存 key 回显(password 输入框视觉遮蔽即可,不做 '********' 掩码——
  // 掩码会制造"已保存"的错觉,浏览器预览刷新后 key 实际为空却看不出来)
  useEffect(() => {
    loadKey()
      .then((k) => setApiKey(k))
      .catch((e) => {
        // 钥匙串读取失败必须显式暴露(曾经静默吞掉,掩盖 keyring feature 缺失数月)
        setStatus({ kind: 'err', text: `读取已存 key 失败:${e instanceof Error ? e.message : String(e)}` });
      });
  }, []);

  useEffect(() => {
    getLastSyncedAt().then(setLastSynced).catch(() => {});
  }, [refresh]);

  const handleSyncOfficial = async () => {
    setSyncing(true);
    try {
      const stats = await syncOfficialBank();
      toast.success(`官方题库已同步:新增 ${stats.added} · 修订 ${stats.updated} · 移除 ${stats.removed}`);
      setLastSynced(await getLastSyncedAt());
    } catch (e) {
      toast.error('同步失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      saveConfig({ baseURL: baseURL.trim(), model: model.trim() });
      await saveKey(apiKey.trim());
      toast.success('LLM 配置已保存');
    } catch (e) {
      toast.error('保存失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true); // 状态只显示最终结果,进行中由按钮自己表达(不重复提示)
    try {
      const key = apiKey.trim(); // 输入框即真相,不另读存储
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

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-refresh={refresh}>
      <PageHeader title="设置" />

      {/* ── 刷题 ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">学习</CardTitle></CardHeader>
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
          <p className="text-xs text-muted-foreground">进入队列即按此数量取题;先取待复习,再取待学习。</p>
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
        <CardHeader className="pb-3"><CardTitle className="text-base">AI 生成(LLM)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="text-xs text-muted-foreground">
            任何 OpenAI 兼容端点(智谱 / DeepSeek / 本地 Ollama 等)。
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
          <label className="text-xs text-muted-foreground font-mono">API key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
          <div className="text-xs text-muted-foreground">
            {isTauri()
              ? 'key 保存在本机应用数据中,退出不丢;保存后会回显在这里。'
              : '浏览器预览:key 只存内存,刷新即丢;桌面版才会保存。'}
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
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
        {/* 行列表用分隔线,不再卡中卡(审计 E6):同层级信息不套边框 */}
        <CardContent className="divide-y divide-border">
        {/* 官方题库同步:远端(GitHub Pages)→ 本地 SQLite 物化 */}
        <div className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <div className="text-sm">官方题库</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {lastSynced ? `上次同步 ${new Date(lastSynced).toLocaleString()}` : '尚未同步(仅包内快照)'}
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={syncing} onClick={handleSyncOfficial}>
            {syncing ? '同步中…' : '同步官方题库'}
          </Button>
        </div>
        {categories.map((c) => {
          const progressCount = Object.keys(loadProgress(c.slug)).length;
          const noteCount = Object.keys(loadNotes(c.slug)).length;
          return (
            <div key={c.slug} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <div className="text-sm">{c.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
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
        <div className="py-3 text-xs text-muted-foreground">
          清空按分类执行:清空进度会删除学习进度(题目和笔记保留);清空笔记只删笔记(进度保留)。均不可恢复。
        </div>
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
              将删除「{confirm?.name}」的{confirm?.kind === 'progress' ? '全部学习进度' : '全部笔记'}
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
