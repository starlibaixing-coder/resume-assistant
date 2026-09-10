// 全局热键(§6.4,单文件,window 捕获;顺序即优先级):
// 1. 可编辑焦点(input/textarea/select/contenteditable/.cm-content)→ 只放行 ⌘K
// 2. ⌘K 开命令面板;Esc 层级:Confirm/Guard → Palette → Focus(由各自组件处理,这里放行)
// 3. ⌘1–8 按路由表切页;⌘, → 设置
// 4. /session 且会话 active 且非可编辑焦点:␣/Enter 揭示;1/2/3 评分;F 专注
//    /resume:⌘S 保存(dirty 时)
// 5. /library /review /jd:↑/↓ 移动选中(经 page-hooks 注册回调)

import { reveal, getSessionSnapshot, isInSession, rateCurrent, skipMissing, currentQuestionExists } from './session';
import { isFocusMode, toggleFocusMode } from './focus';
import { moveListSelection, triggerSave } from './page-hooks';

export const ROUTES = [
  { path: '/', title: '今日' },
  { path: '/session', title: '学习队列' },
  { path: '/library', title: '题库' },
  { path: '/review', title: '审核' },
  { path: '/add', title: '添加题目' },
  { path: '/jd', title: 'JD' },
  { path: '/resume', title: '简历' },
  { path: '/settings', title: '设置' },
] as const;

export interface HotkeyDeps {
  navigate: (path: string) => void;
  currentPath: () => string;
  openPalette: () => void;
  isPaletteOpen: () => boolean;
  isModalOpen: () => boolean;
}

let deps: HotkeyDeps | null = null;

export function setHotkeyDeps(d: HotkeyDeps): void {
  deps = d;
}

function isEditableTarget(el: Element | null): boolean {
  if (!el) return false;
  return !!el.closest('input, textarea, select, [contenteditable="true"], .cm-content');
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
}

function mod(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

export function initHotkeys(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (!deps) return;
    const editable = isEditableTarget(e.target as Element);
    const modalOpen = deps.isModalOpen();

    // ⌘K:含可编辑焦点都放行;模态开着时交给模态
    if (mod(e) && (e.key === 'k' || e.key === 'K')) {
      if (modalOpen) return;
      e.preventDefault();
      deps.openPalette();
      return;
    }
    if (editable) return; // 规则 1:其余键全部交给输入
    if (mod(e) && e.key === ',') {
      if (modalOpen) return;
      e.preventDefault();
      deps.navigate('/settings');
      return;
    }
    // ⌘1–8
    if (mod(e) && /^[1-8]$/.test(e.key)) {
      if (modalOpen) return;
      e.preventDefault();
      const r = ROUTES[Number(e.key) - 1];
      if (r) deps.navigate(r.path);
      return;
    }
    if (modalOpen) return;

    // Esc 层级:Confirm/Guard(=取消)→ Palette 由组件自身处理;这里只管 Focus
    if (e.key === 'Escape') {
      if (deps.isPaletteOpen()) return;
      if (isFocusMode()) {
        e.preventDefault();
        toggleFocusMode(false);
      }
      return;
    }

    const path = deps.currentPath();
    if (path === '/session' && isInSession()) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!getSessionSnapshot()?.revealed) reveal();
        return;
      }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const snap = getSessionSnapshot();
        if (snap?.revealed) {
          e.preventDefault();
          if (!currentQuestionExists()) {
            skipMissing();
          } else {
            rateCurrent(e.key === '1' ? 'no' : e.key === '2' ? 'fuzzy' : 'ok');
          }
        }
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFocusMode();
        return;
      }
    }
    if (path === '/resume') {
      if (mod(e) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        triggerSave();
      }
      return;
    }
    if (path === '/library' || path === '/review' || path === '/jd') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveListSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveListSelection(-1);
      }
    }
  };
  window.addEventListener('keydown', onKey, { capture: true });
  return () => window.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions);
}
