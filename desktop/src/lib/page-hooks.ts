// 页面级钩子注册表:列表 ↑/↓ 选中移动(题库/审核/JD)与 ⌘S 保存(简历)。
// hotkeys.ts 统一监听,页面只注册回调,勿再手写 window keydown。

type ListNavHandler = (dir: 1 | -1) => void;
type SaveHandler = () => void;

let listNav: ListNavHandler | null = null;
let saveHook: SaveHandler | null = null;

export function registerListNav(fn: ListNavHandler | null): void {
  listNav = fn;
}

export function moveListSelection(dir: 1 | -1): boolean {
  if (!listNav) return false;
  listNav(dir);
  return true;
}

export function registerSaveHook(fn: SaveHandler | null): void {
  saveHook = fn;
}

export function triggerSave(): boolean {
  if (!saveHook) return false;
  saveHook();
  return true;
}
