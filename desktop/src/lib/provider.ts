// LLM provider 抽象(OpenAI 兼容协议)。
// 智谱 GLM / DeepSeek / 月之暗面 / 本地 Ollama 等大多兼容此格式,一套抽象覆盖大半。
// 阶段 0 不联网:provider.test.ts 用 mock fetch 验证请求构造 + SSE 流式。
// 真实联调(智谱)留阶段 1 MVP 生题。key 由 keyring 存(ADR-8)。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  apiKey: string;
  baseURL: string; // 如 https://open.bigmodel.cn/api/paas/v4(智谱)
  model: string; // 如 glm-4-flash
  temperature?: number;
  signal?: AbortSignal;
}

function buildHeaders(opts: ChatOptions): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${opts.apiKey}`,
  };
}

function buildBody(messages: ChatMessage[], opts: ChatOptions, stream: boolean): string {
  return JSON.stringify({
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    stream,
  });
}

// 非流式:返回完整文本
export async function chat(messages: ChatMessage[], opts: ChatOptions): Promise<string> {
  const res = await fetch(`${opts.baseURL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(opts),
    body: buildBody(messages, opts, false),
    signal: opts.signal,
  });
  if (!res.ok) {
    throw new Error(`chat failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

// 流式:async generator,逐块 yield 文本 delta。解析 SSE(data: {...} 行)。
export async function* chatStream(
  messages: ChatMessage[],
  opts: ChatOptions,
): AsyncGenerator<string> {
  const res = await fetch(`${opts.baseURL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(opts),
    body: buildBody(messages, opts, true),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`chatStream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // 保留最后不完整行,下轮拼接
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // 跳过非 JSON 行(keepalive 注释等)
      }
    }
  }
}
