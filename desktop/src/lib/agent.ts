// JS agent 编排骨架(Vercel AI SDK)。阶段 0 框架,真正用于生题/简历/面试在阶段 1+。
// provider 配置复用 ChatOptions 字段(baseURL/apiKey/model,ADR-8 OpenAI 兼容)。
import { streamText, tool as aiTool, type CoreMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// 工具定义(agent 可调用的能力)。parameters 用 zod schema,AI SDK 自动校验输入。
export interface ToolDef {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute: (input: unknown) => Promise<unknown>;
}

// 工具注册表
export class ToolRegistry {
  private readonly map = new Map<string, ToolDef>();

  register(t: ToolDef): void {
    if (this.map.has(t.name)) throw new Error(`工具已注册: ${t.name}`);
    this.map.set(t.name, t);
  }

  get(name: string): ToolDef | undefined {
    return this.map.get(name);
  }

  list(): ToolDef[] {
    return [...this.map.values()];
  }

  get size(): number {
    return this.map.size;
  }
}

export function defineTool(t: ToolDef): ToolDef {
  return t;
}

// agent 配置(复用 provider 的字段)
export interface AgentConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

// agent 运行:streamText + tools。Vercel AI SDK 自动处理 tool call 多步循环。
// 阶段 0 骨架;阶段 1 生题等真正接入。
export function runAgent(
  messages: CoreMessage[],
  config: AgentConfig,
  registry: ToolRegistry,
) {
  const openai = createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey });
  const tools = Object.fromEntries(
    registry.list().map((t) => [
      t.name,
      aiTool({
        description: t.description,
        parameters: t.parameters,
        execute: t.execute,
      }),
    ]),
  );
  return streamText({ model: openai(config.model), messages, tools });
}
