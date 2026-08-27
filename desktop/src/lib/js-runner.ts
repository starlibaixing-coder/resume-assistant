// JS 运行器 —— Web Worker 沙箱执行用户草稿代码(2026-08-26,plan D2)。
//
// 设计:
// - 每次运行新起一个 Worker(无状态残留);主线程超时(默认 3s)terminate 并报超时。
// - worker 同步执行完即回 done(logs + error + 耗时),但存活到超时窗,期间异步回调
//   (setTimeout/Promise)里的 console 输出继续以 log 消息转发——FE 面试异步题不能丢输出。
// - workerFactory 可注入:jsdom 单测用假 Worker,真实环境走 Vite 的 ?module worker。
//
// 消息协议(与 js-runner.worker.ts 一对):
//   主线程 → worker: { type: 'run', code }
//   worker → 主线程: { type: 'done', logs, error, durationMs } | { type: 'log', log }

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

// console 参数序列化:任意值 → 单行文本(循环引用/函数/Error 各自降级)
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
    // 循环引用等 JSON.stringify 抛错时降级
    return String(v);
  }
}

// 默认工厂:Vite 约定式 worker URL(bundle 时正确切 chunk)
function defaultWorkerFactory(): Worker {
  return new Worker(new URL('../workers/js-runner.worker.ts', import.meta.url), { type: 'module' });
}

// 运行一段 JS。resolve 于同步执行完成;异步日志经 onAsyncLog 持续转发直到超时窗结束。
// 超时窗(默认 3s)从启动起算:同步跑不完按超时报;跑完后剩余窗口留给异步回调输出,
// 窗到统一 terminate(每次运行都是新 worker,不残留)。
export function runJs(
  code: string,
  opts: { timeoutMs?: number; workerFactory?: () => Worker; onAsyncLog?: (log: RunLog) => void } = {},
): Promise<RunResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, workerFactory = defaultWorkerFactory, onAsyncLog } = opts;
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = workerFactory();
    } catch (e) {
      resolve({
        logs: [],
        error: `无法创建运行环境: ${e instanceof Error ? e.message : String(e)}`,
        timedOut: false,
        durationMs: 0,
      });
      return;
    }

    let settled = false; // done 已回(此后到的是异步日志)

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { type: string } & Record<string, unknown>;
      if (data.type === 'done' && !settled) {
        settled = true;
        resolve({
          logs: data.logs as RunLog[],
          error: (data.error as string | null) ?? null,
          timedOut: false,
          durationMs: data.durationMs as number,
        });
      } else if (data.type === 'log') {
        onAsyncLog?.(data.log as RunLog);
      }
    };
    worker.onerror = (e) => {
      // 顶层加载错误(如模块级语法错误)
      if (!settled) {
        settled = true;
        resolve({ logs: [], error: e.message || '脚本加载失败', timedOut: false, durationMs: 0 });
        worker.terminate();
      }
    };

    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ logs: [], error: `执行超时(>${timeoutMs}ms),已强制终止`, timedOut: true, durationMs: timeoutMs });
      }
      worker.terminate();
    }, timeoutMs);

    worker.postMessage({ type: 'run', code });
  });
}
