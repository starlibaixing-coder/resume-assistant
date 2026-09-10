// JS 运行 worker:沙箱执行 + console 捕获(协议见 lib/js-runner.ts 头注)。
// done 后不自杀:存活到主线程超时窗,异步回调输出继续流式转发。

/// <reference lib="webworker" />
import { serializeArg } from '../lib/js-runner';

type Level = 'log' | 'warn' | 'error';

self.onmessage = (e: MessageEvent) => {
  if ((e.data as { type?: string })?.type !== 'run') return;
  const code = (e.data as { code?: string }).code ?? '';

  const send = (msg: Record<string, unknown>) => (self as unknown as Worker).postMessage(msg);
  const capture = (level: Level) => (...args: unknown[]) =>
    send({ type: 'log', log: { level, text: args.map(serializeArg).join(' ') } });

  const collected: Array<{ level: Level; text: string }> = [];
  const original: Partial<Record<Level, (...args: unknown[]) => void>> = {};
  for (const level of ['log', 'warn', 'error'] as const) {
    original[level] = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      collected.push({ level, text: args.map(serializeArg).join(' ') });
      original[level]!(...args);
    };
  }

  const t0 = performance.now();
  let error: string | null = null;
  try {
    new Function(code)();
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  const durationMs = Math.round(performance.now() - t0);

  for (const level of ['log', 'warn', 'error'] as const) {
    console[level] = original[level]!;
  }
  send({ type: 'done', logs: collected, error, durationMs });

  // 切换到流式转发(done 之后到达的输出都是异步回调的)
  for (const level of ['log', 'warn', 'error'] as const) {
    console[level] = capture(level);
  }
};
