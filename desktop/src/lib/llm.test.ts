// LLM 网关:paramFields 只把已设置项放进请求体;chat 组装与合并(参数未设置走服务端默认)

import { afterEach, describe, expect, it, vi } from 'vitest';

import { chat, paramFields } from './llm';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('paramFields', () => {
  it('空参数 → 不带任何字段', () => {
    expect(paramFields(undefined)).toEqual({});
    expect(paramFields({})).toEqual({});
  });

  it('只带已设置项;thinking 映射为 {type}', () => {
    expect(paramFields({ temperature: 1, thinking: 'enabled' })).toEqual({ temperature: 1, thinking: { type: 'enabled' } });
    expect(paramFields({ top_p: 0.95, reasoning_effort: 'max' })).toEqual({ top_p: 0.95, reasoning_effort: 'max' });
  });
});

describe('chat 请求体', () => {
  const ok = () =>
    new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  it('未设置参数:请求体不含参数字段(走服务端默认,不再硬编码 temperature)', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    await chat([{ role: 'user', content: 'ping' }], { apiKey: 'k', baseUrl: 'https://x.example/', model: 'm' });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ model: 'm', messages: [{ role: 'user', content: 'ping' }], stream: false });
  });

  it('设置了参数:仅合并已设置项', async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal('fetch', fetchMock);
    await chat([{ role: 'user', content: 'ping' }], {
      apiKey: 'k',
      baseUrl: 'https://x.example',
      model: 'm',
      params: { temperature: 1, reasoning_effort: 'max' },
    });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.temperature).toBe(1);
    expect(body.reasoning_effort).toBe('max');
    expect(body.top_p).toBeUndefined();
    expect(body.thinking).toBeUndefined();
  });
});
