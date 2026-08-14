// LLM provider 抽象(OpenAI 兼容)—— TDD 先行(红)。mock fetch 验请求构造 + SSE 流式。
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chat, chatStream, type ChatMessage, type ChatOptions } from './provider';

const OPTS: ChatOptions = {
  apiKey: 'sk-test',
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4-flash',
};

const MSGS: ChatMessage[] = [{ role: 'user', content: 'hi' }];

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const spy = vi.fn(() => response) as unknown as ReturnType<typeof vi.fn>;
  vi.stubGlobal('fetch', spy);
  return spy;
}

function jsonRes(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function sseRes(lines: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines.join('\n') + '\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

async function drain(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const d of gen) out.push(d);
  return out;
}

beforeEach(() => vi.unstubAllGlobals());

describe('chat(非流式)', () => {
  it('请求构造: POST {baseURL}/chat/completions + Bearer + body', async () => {
    const spy = mockFetch(jsonRes({ choices: [{ message: { content: 'hello' } }] }));
    expect(await chat(MSGS, OPTS)).toBe('hello');
    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('glm-4-flash');
    expect(body.messages).toEqual(MSGS);
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0.7);
  });

  it('自定义 temperature 透传', async () => {
    const spy = mockFetch(jsonRes({ choices: [{ message: { content: 'x' } }] }));
    await chat(MSGS, { ...OPTS, temperature: 0.1 });
    expect(JSON.parse(spy.mock.calls[0][1].body as string).temperature).toBe(0.1);
  });

  it('HTTP 错误抛异常(含状态码)', async () => {
    mockFetch(jsonRes({ error: 'bad' }, { status: 401 }));
    await expect(chat(MSGS, OPTS)).rejects.toThrow(/401/);
  });

  it('空 choices 返回空串(不崩)', async () => {
    mockFetch(jsonRes({ choices: [] }));
    expect(await chat(MSGS, OPTS)).toBe('');
  });
});

describe('chatStream(流式)', () => {
  it('逐块 yield delta.content, 遇 [DONE] 结束', async () => {
    mockFetch(
      sseRes([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"lo"}}]}',
        '',
        'data: [DONE]',
      ]),
    );
    expect(await drain(chatStream(MSGS, OPTS))).toEqual(['Hel', 'lo']);
  });

  it('流式请求 body stream:true', async () => {
    const spy = mockFetch(sseRes(['data: {"choices":[{"delta":{"content":"x"}}]}', '', 'data: [DONE]']));
    await drain(chatStream(MSGS, OPTS));
    expect(JSON.parse(spy.mock.calls[0][1].body as string).stream).toBe(true);
  });

  it('流式 HTTP 错误抛异常', async () => {
    mockFetch(jsonRes({}, { status: 500 }));
    await expect(drain(chatStream(MSGS, OPTS))).rejects.toThrow(/500/);
  });

  it('跳过非 data 行(keepalive 注释/空行)', async () => {
    mockFetch(
      sseRes([': keepalive', '', 'data: {"choices":[{"delta":{"content":"ok"}}]}', '', 'data: [DONE]']),
    );
    expect(await drain(chatStream(MSGS, OPTS))).toEqual(['ok']);
  });
});
