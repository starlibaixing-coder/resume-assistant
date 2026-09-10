// LLM 网关:OpenAI 兼容 /chat/completions(§5.4)。错误三分类:key / network / parse。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatArgs {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type LlmErrorKind = 'key' | 'network' | 'parse' | 'unknown';

export class LlmError extends Error {
  kind: LlmErrorKind;
  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export async function chat(messages: ChatMessage[], args: ChatArgs, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${args.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({ model: args.model, messages, temperature: 0.7, stream: false }),
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw new LlmError('network', `网络错误: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new LlmError('key', `鉴权失败(${res.status})`);
    throw new LlmError('unknown', `请求失败 ${res.status}: ${body.slice(0, 200)}`);
  }
  let data: { choices?: { message?: { content?: string } }[] };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new LlmError('parse', '响应不是合法 JSON');
  }
  return data.choices?.[0]?.message?.content ?? '';
}
