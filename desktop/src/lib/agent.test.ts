// JS agent 编排骨架 —— TDD 先行(红)。ToolRegistry/defineTool 纯逻辑。
// runAgent(streamText)测真 LLM,阶段 0 不测,留编译验证 + 阶段 1。
import { describe, it, expect } from 'vitest';
import { ToolRegistry, defineTool, type ToolDef } from './agent';
import { z } from 'zod';

const helloTool: ToolDef = {
  name: 'hello',
  description: '打招呼',
  parameters: z.object({ name: z.string() }),
  execute: async (input) => `hi ${(input as { name: string }).name}`,
};

describe('defineTool', () => {
  it('透传工具定义(同一引用)', () => {
    expect(defineTool(helloTool)).toBe(helloTool);
  });
});

describe('ToolRegistry', () => {
  it('register + get', () => {
    const r = new ToolRegistry();
    r.register(helloTool);
    expect(r.get('hello')).toBe(helloTool);
  });

  it('get 不存在返回 undefined', () => {
    expect(new ToolRegistry().get('nope')).toBeUndefined();
  });

  it('list 返回全部(注册顺序)', () => {
    const r = new ToolRegistry();
    r.register(helloTool);
    r.register({ ...helloTool, name: 'bye' });
    expect(r.list().map((t) => t.name)).toEqual(['hello', 'bye']);
  });

  it('重复注册同名抛错', () => {
    const r = new ToolRegistry();
    r.register(helloTool);
    expect(() => r.register(helloTool)).toThrow(/已注册/);
  });

  it('size 计数', () => {
    const r = new ToolRegistry();
    expect(r.size).toBe(0);
    r.register(helloTool);
    expect(r.size).toBe(1);
  });
});

describe('工具 execute', () => {
  it('hello 工具执行返回结果', async () => {
    expect(await helloTool.execute({ name: 'world' })).toBe('hi world');
  });
});
