// JS 运行器 —— Web Worker 沙箱执行草稿纸代码。
// 每次运行新起 Worker(无状态残留);超时(默认 3s)terminate 强杀;
// 同步执行完回 done,存活到超时窗,期间异步回调的 console 输出继续以 log 消息转发。
// 消息协议:主线程 → {type:'run', code};worker → {type:'done',...} | {type:'log', log}

export interface RunLog {
  level: 'log' | 'warn' | 'error';
  text: string;
}

export interface RunResult {
  logs: RunLog[];
  error: string | null;
  timedOut: boolean;
  durationMs: number;
}

export const DEFAULT_TIMEOUT_MS = 3000;

export function serializeArg(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return v.toString().replace(/\s+/g, ' ').slice(0, 120);
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'bigint') return `${v}n`;
  if (typeof v === 'symbol') return v.toString();
  if (v === undefined) return 'undefined';
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? `${val}n` : val)) ?? 'null';
  } catch {
    return String(v);
  }
}

function defaultWorkerFactory(): Worker {
  return new Worker(new URL('../workers/js-runner.worker.ts', import.meta.url), { type: 'module' });
}

export function runJs(
  code: string,
  opts: { timeoutMs?: number; workerFactory?: () => Worker; onAsyncLog?: (log: RunLog) => void } = {},
): Promise<RunResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, workerFactory = defaultWorkerFactory, onAsyncLog } = opts;
  return new Promise((resolve) => {
    const worker = workerFactory();
    const logs: RunLog[] = [];
    let error: string | null = null;
    let done = false;
    let durationMs = 0;

    const finish = (timedOut: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
      resolve({ logs, error, timedOut, durationMs });
    };

    const timer = setTimeout(() => finish(true), timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; logs?: RunLog[]; error?: string | null; durationMs?: number; log?: RunLog };
      if (msg.type === 'done') {
        if (msg.logs) logs.push(...msg.logs);
        error = msg.error ?? null;
        durationMs = msg.durationMs ?? 0;
        finish(false);
      } else if (msg.type === 'log' && msg.log) {
        if (!done) logs.push(msg.log);
        onAsyncLog?.(msg.log);
      }
    };
    worker.onerror = (e) => {
      error = e.message || 'worker 执行出错';
      finish(false);
    };
    worker.postMessage({ type: 'run', code });
  });
}
