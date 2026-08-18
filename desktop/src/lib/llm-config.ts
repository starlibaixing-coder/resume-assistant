// LLM 运行配置(ADR-8):baseURL/model 非敏感,存 localStorage;
// API key 只进 OS keyring(Tauri command),浏览器预览降级为内存(刷新即失,不落盘)。
// 自定义形式:任何 OpenAI 兼容端点(智谱/DeepSeek/Ollama/…),不设预设。

import type { ChatOptions } from './provider';

export interface LlmConfig {
  baseURL: string;
  model: string;
}

const STORAGE_KEY = 'llm-config';
const EMPTY: LlmConfig = { baseURL: '', model: '' };

export function loadConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const c = JSON.parse(raw) as Partial<LlmConfig>;
    return { baseURL: c.baseURL ?? '', model: c.model ?? '' };
  } catch {
    return EMPTY;
  }
}

export function saveConfig(c: LlmConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

// ===== key:keyring(ADR-8)优先,非 Tauri 内存降级 =====

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let memoryKey = ''; // 非 Tauri 降级(仅测试用,不落盘)

export async function loadKey(): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const key = await invoke<string | null>('get_api_key');
    return key ?? '';
  }
  return memoryKey;
}

export async function saveKey(key: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_api_key', { key });
    return;
  }
  memoryKey = key;
}

// ===== 拼装 provider.chat 所需参数;未配齐(key/baseURL/model 任缺)返回 null =====

export async function resolveChatOptions(): Promise<ChatOptions | null> {
  const c = loadConfig();
  const key = await loadKey();
  if (!key || !c.baseURL || !c.model) return null;
  return { apiKey: key, baseURL: c.baseURL, model: c.model };
}

// 测试钩子:清内存 key
export function _resetLlmConfigForTest(): void {
  memoryKey = '';
  localStorage.removeItem(STORAGE_KEY);
}
