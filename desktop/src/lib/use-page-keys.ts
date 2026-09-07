import { useEffect, useRef } from 'react';

// 页面级键盘 hook:全站共享一份「让键」判定 + 稳定监听。
// 此前 app-shell / quiz / browse 各写一份同样的守卫,且两个页面级监听没有依赖数组、
// 每次渲染都 remove/add(2026-09-07 走查)。这里集中:输入控件与弹窗打开时不抢键,
// handler 经 ref 转发,监听器只挂一次。

/** 当前是否应忽略页面快捷键(输入控件聚焦 / 任何弹层打开) */
export function keysBlocked(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (el?.closest('input, textarea, select, [contenteditable="true"], .cm-editor, .ProseMirror')) return true;
  if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return true;
  return false;
}

/**
 * 挂页面级 keydown。enabled=false 时不下监听(如队列空/会话结束)。
 * handler 每次渲染都可换新闭包,内部经 ref 使用,不会反复挂摘监听。
 */
export function usePageKeys(handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (keysBlocked()) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
