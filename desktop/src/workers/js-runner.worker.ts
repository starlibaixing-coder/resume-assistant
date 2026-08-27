// JS 运行 worker —— 沙箱执行 + console 捕获(与 js-runner.ts 一对,协议见彼处头注释)。
//
// 同步执行完回 done 后不恢复原 console、不自杀:主线程会让 worker 活到超时窗,
// 期间异步回调(setTimeout/Promise)的输出继续以 log 消息转发,窗到由主线程 terminate。

/// <reference lib="webworker" />
import { serializeArg } from '../lib/js-runner';

type Level = 'log' | 'warn' | 'error';

self.onmessage = (e: MessageEvent) => {
  if ((e.data as { type?: string })?.type !== 'run') return;
  const code = (e.data as { code?: string }).code ?? '';

  const send = (msg: Record<string, unknown>) => (self as unknown as Worker).postMessage(msg);
  const capture = (level: Level) => (...args: unknown[]) =>
    send({ type: 'log', log: { level, text: args.map(serializeArg).join(' ') } });

  // 劫持 console(log/warn/error);done 前的日志攒进结果一起回,之后走 log 消息流
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
    // new Function 包一层:同步执行且不污染 worker 模块作用域
    new Function(code)();
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  const durationMs = Math.round(performance.now() - t0);

  // 切换到流式转发(done 之后到达的输出都是异步回调的)
  const logs = collected.splice(0);
  for (const level of ['log', 'warn', 'error'] as const) {
    console[level] = capture(level);
  }
  send({ type: 'done', logs, error, durationMs });
};
