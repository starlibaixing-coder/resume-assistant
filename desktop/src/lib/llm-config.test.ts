// LLM 配置 —— localStorage 读写 + 内存降级 key + resolveChatOptions 拼装
import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, saveConfig, loadKey, saveKey, resolveChatOptions, _resetLlmConfigForTest } from './llm-config';

beforeEach(() => _resetLlmConfigForTest());

describe('config(localStorage)', () => {
  it('默认智谱', () => {
    const c = loadConfig();
    expect(c.preset).toBe('zhipu');
    expect(c.baseURL).toContain('bigmodel');
    expect(c.model).toBe('glm-4-flash');
  });

  it('save 后 load 往返', () => {
    saveConfig({ preset: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'qwen3' });
    expect(loadConfig()).toEqual({ preset: 'ollama', baseURL: 'http://localhost:11434/v1', model: 'qwen3' });
  });

  it('localStorage 脏数据回退默认', () => {
    localStorage.setItem('llm-config', '{broken');
    expect(loadConfig().preset).toBe('zhipu');
  });
});

describe('key(非 Tauri 内存降级)', () => {
  it('save/load 往返', async () => {
    expect(await loadKey()).toBe('');
    await saveKey('sk-test');
    expect(await loadKey()).toBe('sk-test');
  });
});

describe('resolveChatOptions', () => {
  it('缺 key 返回 null', async () => {
    saveConfig({ preset: 'zhipu', baseURL: 'https://x/v1', model: 'm' });
    expect(await resolveChatOptions()).toBeNull();
  });

  it('缺 baseURL/model 返回 null', async () => {
    await saveKey('k');
    saveConfig({ preset: 'custom', baseURL: '', model: 'm' });
    expect(await resolveChatOptions()).toBeNull();
    saveConfig({ preset: 'custom', baseURL: 'https://x/v1', model: '' });
    expect(await resolveChatOptions()).toBeNull();
  });

  it('配齐返回 ChatOptions', async () => {
    await saveKey('k');
    saveConfig({ preset: 'zhipu', baseURL: 'https://x/v1', model: 'glm-4-flash' });
    expect(await resolveChatOptions()).toEqual({ apiKey: 'k', baseURL: 'https://x/v1', model: 'glm-4-flash' });
  });
});
