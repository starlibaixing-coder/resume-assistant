// 全局脏守卫(§6.2 GuardDialog):管理面表单(JD 编辑/题目编辑/简历)dirty 时,
// 一切路由切换(侧栏/⌘K/⌘数字/历史键)先过这里;确认放弃才放行。

export interface DirtyGuard {
  id: string;
  isDirty(): boolean;
  /** 确认放弃后的回调(页面借此复位自身状态) */
  onDiscard?: () => void;
}

let guard: DirtyGuard | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function registerDirtyGuard(g: DirtyGuard): void {
  guard = g;
}

export function clearDirtyGuard(id: string): void {
  if (guard?.id === id) guard = null;
}

export function getDirtyGuard(): DirtyGuard | null {
  return guard?.isDirty() ? guard : null;
}

export function subscribeGuard(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function discardChanges(): void {
  guard?.onDiscard?.();
  if (guard) guard = null;
  emit();
}

/**
 * 守卫式导航:无 dirty 直接执行 perform;有 dirty 返回 false 并通知 GuardDialog 弹确认
 * (确认后由 UI 调 discardChanges() + perform())。
 */
export function requestNavigation(perform: () => void): boolean {
  const g = getDirtyGuard();
  if (!g) {
    perform();
    return true;
  }
  pendingPerform = perform;
  emit();
  return false;
}

/** GuardDialog 确认时取走挂起的导航动作 */
export function takePendingNavigation(): (() => void) | null {
  const p = pendingPerform;
  pendingPerform = null;
  return p;
}

let pendingPerform: (() => void) | null = null;
