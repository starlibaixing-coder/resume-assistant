// 日志:Tauri log 插件落 ~/Library/Logs/<bundle>/app.log;浏览器降级 console。
// 存储失败等关键事件必须落这里(用户报障先查)。

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string): void {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    // 动态引入避免顶层依赖 runtime;失败静默回 console
    void import('@tauri-apps/plugin-log')
      .then((m) => {
        if (level === 'error') return m.error(msg);
        if (level === 'warn') return m.warn(msg);
        return m.info(msg);
      })
      .catch(() => console[level](`[cc] ${msg}`));
  } else {
    console[level](`[cc] ${msg}`);
  }
}

export const logger = {
  info: (msg: string) => emit('info', msg),
  warn: (msg: string) => emit('warn', msg),
  error: (msg: string) => emit('error', msg),
};
