// 站内导航守卫:页面有未保存修改时,拦截一切编程式导航(⌘K 面板 / Cmd+数字切空间 /
// 历史前进后退),统一弹确认。此前只拦 <a> 点击,键盘路径会静默丢改动(2026-09-07 走查)。
// 页面自身只负责 register/unregister 与自己弹窗内的放行;shell 侧消费 firstBlocked()。

export interface NavBlocker {
  /** 是否处于未保存状态 */
  isDirty: () => boolean;
  /** 确认离开后由 shell 调用:页面复位 dirty 标记,放行接下来的导航 */
  release: () => void;
}

const blockers = new Map<symbol, NavBlocker>();

/** 注册守卫;返回注销函数(页面卸载时调用) */
export function addNavBlocker(b: NavBlocker): () => void {
  const key = Symbol('nav-blocker');
  blockers.set(key, b);
  return () => blockers.delete(key);
}

/** 第一个未保存的守卫;无则 null。shell 在导航前检查 */
export function firstBlocked(): NavBlocker | null {
  for (const b of blockers.values()) {
    if (b.isDirty()) return b;
  }
  return null;
}
