// JS 运行器 —— serializeArg 纯函数 + runJs 编排(注入假 Worker,零真 worker 依赖)
import { describe, it, expect, vi } from 'vitest';
import { serializeArg, runJs, DEFAULT_TIMEOUT_MS, type RunLog } from './js-runner';

describe('serializeArg', () => {
  it('字符串原样', () => {
    expect(serializeArg('hello')).toBe('hello');
  });
  it('数字/布尔/null', () => {
    expect(serializeArg(42)).toBe('42');
    expect(serializeArg(true)).toBe('true');
    expect(serializeArg(null)).toBe('null');
    expect(serializeArg(undefined)).toBe('undefined');
  });
  it('对象走 JSON', () => {
    expect(serializeArg({ a: 1 })).toBe('{"a":1}');
    expect(serializeArg([1, 'x'])).toBe('[1,"x"]');
  });
  it('循环引用降级 String(v) 不抛错', () => {
    const o: Record<string, unknown> = {};
    o.self = o;
    expect(serializeArg(o)).toBe('[object Object]');
  });
  it('函数降级为源码(压空白、截 120 字)', () => {
    const s = serializeArg(function longFn(a: number) { return a + 1; });
    expect(s).toContain('longFn');
    expect(s.length).toBeLessThanOrEqual(120);
  });
  it('Error 取 name: message', () => {
    expect(serializeArg(new TypeError('bad'))).toBe('TypeError: bad');
  });
  it('bigint / symbol', () => {
    expect(serializeArg(10n)).toBe('10n');
    expect(serializeArg(Symbol('s'))).toBe('Symbol(s)');
  });
});

// ===== runJs 编排(假 Worker) =====

// 假 Worker:postMessage 后按 responder 决定回什么;responder 为 null 则永不回(模拟死循环)
function makeFakeWorker(responder: ((data: unknown) => Record<string, unknown> | null) | null) {
  const instances: FakeWorker[] = [];
  class FakeWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: ErrorEvent) => void) | null = null;
    terminate = vi.fn();
    received: unknown[] = [];
    constructor() {
      instances.push(this);
    }
    postMessage = (data: unknown) => {
      this.received.push(data);
      const reply = responder?.(data) ?? null;
      if (reply) {
        // done 之后再补一条异步日志(验证流式转发)
        setTimeout(() => this.onmessage?.({ data: reply } as MessageEvent), 0);
        setTimeout(
          () => this.onmessage?.({ data: { type: 'log', log: { level: 'log', text: 'async-out' } } } as MessageEvent),
          5,
        );
      }
    };
  }
  return { factory: () => new FakeWorker() as unknown as Worker, instances };
}

describe('runJs', () => {
  it('正常完成:done 的 logs/error/duration 透传', async () => {
    const logs: RunLog[] = [{ level: 'log', text: 'hi' }];
    const { factory } = makeFakeWorker(() => ({ type: 'done', logs, error: null, durationMs: 3 }));
    const result = await runJs('console.log("hi")', { workerFactory: factory });
    expect(result).toEqual({ logs, error: null, timedOut: false, durationMs: 3 });
  });

  it('运行抛错:error 字符串透传', async () => {
    const { factory } = makeFakeWorker(() => ({ type: 'done', logs: [], error: 'TypeError: x is not a function', durationMs: 1 }));
    const result = await runJs('x()', { workerFactory: factory });
    expect(result.error).toBe('TypeError: x is not a function');
    expect(result.timedOut).toBe(false);
  });

  it('异步日志经 onAsyncLog 转发(done 之后)', async () => {
    const { factory } = makeFakeWorker(() => ({ type: 'done', logs: [], error: null, durationMs: 0 }));
    const onAsyncLog = vi.fn();
    await runJs('setTimeout(() => console.log("later"))', { workerFactory: factory, onAsyncLog });
    await vi.waitFor(() => expect(onAsyncLog).toHaveBeenCalledWith({ level: 'log', text: 'async-out' }));
  });

  it('超时:worker 不回话 → timedOut + terminate', async () => {
    const { factory, instances } = makeFakeWorker(null);
    const result = await runJs('while(true){}', { workerFactory: factory, timeoutMs: 20 });
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain('超时');
    expect(instances[0].terminate).toHaveBeenCalled();
  });

  it('done 后超时窗到仍 terminate(清异步残留)', async () => {
    const { factory, instances } = makeFakeWorker(() => ({ type: 'done', logs: [], error: null, durationMs: 0 }));
    await runJs('console.log(1)', { workerFactory: factory, timeoutMs: 20 });
    expect(instances[0].terminate).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(instances[0].terminate).toHaveBeenCalled(), { timeout: 100 });
  });

  it('发送的消息带 code(run 协议)', async () => {
    const { factory, instances } = makeFakeWorker(() => ({ type: 'done', logs: [], error: null, durationMs: 0 }));
    await runJs('let a = 1', { workerFactory: factory });
    expect(instances[0].received).toEqual([{ type: 'run', code: 'let a = 1' }]);
  });

  it('worker 创建失败 → 错误结果不抛', async () => {
    const result = await runJs('x', { workerFactory: () => { throw new Error('no worker'); } });
    expect(result.error).toContain('无法创建运行环境');
  });

  it('默认超时 3s(常量导出供 UI 提示)', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(3000);
  });
});
