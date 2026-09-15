// LLM 网关:OpenAI 兼容 /chat/completions(§5.4)。错误三分类:key / network / parse。
// 生成参数可选:params 里没带的字段不进请求体,走服务端默认
// (zhipu:temperature 1 / top_p 0.95 / effort max / thinking 仅 enabled;deepseek:thinking enabled|disabled、effort high|max)。

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  temperature?: number;
  top_p?: number;
  reasoning_effort?: string;
  thinking?: string; // 'enabled' | 'disabled'
}

export interface ChatArgs {
  apiKey: string;
  baseUrl: string;
  model: string;
  params?: ChatParams;
}

export type LlmErrorKind = 'key' | 'network' | 'parse' | 'unknown';

export class LlmError extends Error {
  kind: LlmErrorKind;
  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

/** 只把已设置的字段放进请求体;thinking 映射为 {type} */
export function paramFields(p?: ChatParams): Record<string, unknown> {
  if (!p) return {};
  const out: Record<string, unknown> = {};
  if (p.temperature !== undefined) out.temperature = p.temperature;
  if (p.top_p !== undefined) out.top_p = p.top_p;
  if (p.reasoning_effort) out.reasoning_effort = p.reasoning_effort;
  if (p.thinking) out.thinking = { type: p.thinking };
  return out;
}

export async function chat(messages: ChatMessage[], args: ChatArgs, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${args.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${args.apiKey}` },
      body: JSON.stringify({ model: args.model, messages, stream: false, ...paramFields(args.params) }),
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
