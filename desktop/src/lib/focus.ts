// 专注模式(FocusLayer):/session 内 F 切换;隐壳 + 题干放大(27px);
// Tauri 壳内联动系统全屏(ADR-0006:进入/退出完整还原);浏览器降级仅 CSS 专注态。

import { isTauri } from './db';
import { logger } from './logger';

let focused = false;
const listeners = new Set<() => void>();

export function isFocusMode(): boolean {
  return focused;
}

export function subscribeFocus(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(): void {
  for (const fn of listeners) fn();
}

export async function toggleFocusMode(on?: boolean): Promise<void> {
  const next = on ?? !focused;
  if (next === focused) return;
  focused = next;
  document.documentElement.classList.toggle('cc-focus', focused);
  emit();
  if (isTauri()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(focused);
    } catch (e) {
      logger.warn(`[focus] 系统全屏失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
