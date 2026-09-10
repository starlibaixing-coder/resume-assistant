// 主题:meta.theme('light'|'dark')为持久真相;localStorage 镜像供 index.html 首帧免闪。
// 切换 = html.dark class,即时生效。

import { getMeta, setMeta, subscribe } from './storage';

export type Theme = 'light' | 'dark';

const MIRROR_KEY = 'cc-theme';
let theme: Theme = 'light';

const listeners = new Set<() => void>();

export function initTheme(): void {
  const saved = getMeta('theme');
  if (saved === 'dark' || saved === 'light') theme = saved;
  else if (typeof localStorage !== 'undefined' && localStorage.getItem(MIRROR_KEY) === 'dark') theme = 'dark';
  apply();
  subscribe('meta', () => {
    const next = getMeta('theme') === 'dark' ? 'dark' : 'light';
    if (next !== theme) {
      theme = next;
      apply();
      listeners.forEach((l) => l());
    }
  });
}

function apply(): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(MIRROR_KEY, theme);
  } catch {
    /* 隐私模式静默 */
  }
}

export function getTheme(): Theme {
  return theme;
}

export function setTheme(t: Theme): void {
  setMeta('theme', t);
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
