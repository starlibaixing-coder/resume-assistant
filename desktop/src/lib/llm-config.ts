// LLM 运行配置(ADR-8,2026-08-20 修订):baseURL/model 非敏感,存 localStorage;
// API key 存本地 SQLite secrets 表(secrets.ts),浏览器预览降级为内存(刷新即失,不落盘)。
// 自定义形式:任何 OpenAI 兼容端点(智谱/DeepSeek/Ollama/…),不设预设。

import type { ChatOptions } from './provider';
import { getSecret, setSecret, _resetSecretsForTest, LLM_API_KEY_NAME } from './secrets';

export { isTauri } from './secrets';

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

// ===== key:本地库 secrets 表(原 keyring 已弃,见 secrets.ts 头注) =====

export async function loadKey(): Promise<string> {
  return getSecret(LLM_API_KEY_NAME);
}

export async function saveKey(key: string): Promise<void> {
  await setSecret(LLM_API_KEY_NAME, key);
}

// ===== 拼装 provider.chat 所需参数;未配齐(key/baseURL/model 任缺)返回 null =====

export async function resolveChatOptions(): Promise<ChatOptions | null> {
  const c = loadConfig();
  const key = await loadKey();
  if (!key || !c.baseURL || !c.model) return null;
  return { apiKey: key, baseURL: c.baseURL, model: c.model };
}

// 测试钩子:清 localStorage 配置 + 内存 key
export function _resetLlmConfigForTest(): void {
  localStorage.removeItem(STORAGE_KEY);
  _resetSecretsForTest();
}
