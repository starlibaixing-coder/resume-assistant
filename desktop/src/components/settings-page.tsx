import { useEffect, useState } from 'react';
import { PRESETS, loadConfig, loadKey, saveConfig, saveKey, isTauri } from '@/lib/llm-config';
import { chat } from '@/lib/provider';
import { Button } from '@/components/ui/button';

const inputCls =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring';

export function SettingsPage() {
  const [preset, setPreset] = useState(loadConfig().preset);
  const [baseURL, setBaseURL] = useState(loadConfig().baseURL);
  const [model, setModel] = useState(loadConfig().model);
  const [apiKey, setApiKey] = useState('');
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

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

  const activePreset = PRESETS.find((p) => p.id === preset);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">
        <span className="text-primary">●</span> 设置 / LLM
      </h1>

      <div className="space-y-5 rounded-lg border border-border bg-card p-5">
        {/* 预设 */}
        <div className="space-y-2">
          <div className="text-sm font-medium">服务商(OpenAI 兼容)</div>
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
            <input className={inputCls} value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder="https://…/v1" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-mono">model</label>
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} placeholder="glm-4-flash" />
          </div>
        </div>

        {/* API key */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-mono">
            API key{keyLoaded ? '(已存于系统钥匙串)' : ''}
          </label>
          <input
            className={inputCls}
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
      </div>

      <div className="text-xs text-muted-foreground font-mono">
        <a
          href="https://github.com/starlibaixing-coder/resume-assistant"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary"
        >
          GitHub ↗ 源码与官方题库
        </a>
      </div>
    </div>
  );
}
