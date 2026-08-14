// LLM 运行配置(ADR-8):baseURL/model 非敏感,存 localStorage;
// API key 只进 OS keyring(Tauri command)。非 Tauri 环境(web dev/e2e)key 存内存,刷新即失,仅供测试。
// 预设走 OpenAI 兼容协议,智谱优先。

import type { ChatOptions } from './provider';

export interface LlmPreset {
  id: string;
  name: string;
  baseURL: string;
  model: string; // 空串 = 需用户填
  hint?: string;
}

export const PRESETS: LlmPreset[] = [
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    hint: 'https://open.bigmodel.cn 获取 API key',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    hint: 'https://platform.deepseek.com 获取 API key',
  },
  {
    id: 'ollama',
    name: 'Ollama 本地',
    baseURL: 'http://localhost:11434/v1',
    model: '',
    hint: '本地零成本,key 随便填(如 ollama),模型名填本地已拉取的模型',
  },
  { id: 'custom', name: '自定义', baseURL: '', model: '', hint: '任何 OpenAI 兼容端点' },
];

export interface LlmConfig {
  preset: string;
  baseURL: string;
  model: string;
}

const STORAGE_KEY = 'llm-config';
const DEFAULT_CONFIG: LlmConfig = { preset: PRESETS[0].id, baseURL: PRESETS[0].baseURL, model: PRESETS[0].model };

export function loadConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const c = JSON.parse(raw) as Partial<LlmConfig>;
    return { preset: c.preset ?? DEFAULT_CONFIG.preset, baseURL: c.baseURL ?? '', model: c.model ?? '' };
  } catch {
    return DEFAULT_CONFIG;
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
