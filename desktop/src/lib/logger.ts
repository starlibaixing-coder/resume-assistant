// 统一日志出口。Tauri 壳内走 tauri-plugin-log(stdout + ~/Library/Logs/<id>/app.log
// + webview 控制台),web 预览/单测回退 console。fire-and-forget,不阻塞调用方。
// 模块前缀约定:[storage] [mylib] [profile] [secrets] [boot] [smoke] [llm]。

import { isTauri } from './secrets';

type Level = 'info' | 'warn' | 'error';

async function forward(level: Level, msg: string): Promise<void> {
  if (!isTauri()) {
    console[level](msg);
    return;
  }
  try {
    const p = await import('@tauri-apps/plugin-log');
    await p[level](msg);
  } catch {
    console[level](msg); // 插件不可用兜底,日志不能丢
  }
}

export const logger = {
  info: (msg: string): void => void forward('info', msg),
  warn: (msg: string): void => void forward('warn', msg),
  error: (msg: string): void => void forward('error', msg),
};
