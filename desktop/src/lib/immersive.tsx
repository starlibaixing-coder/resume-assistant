import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import { isTauri } from './secrets';
import { logger } from './logger';

// 沉浸式刷题:session 级状态(不持久化),AppShell 消费它隐藏应用内 chrome,
// Tauri 壳内同时跟随系统全屏(连窗口标题栏一起藏);浏览器/web 层自动只剩 CSS 沉浸。
// 退出三通道:Esc 全局键、刷题页退出按钮、离开刷题路由自动退出。
// Esc 不加输入框/编辑器守卫——刷题时焦点常驻 CodeMirror/tiptap,守卫会让 Esc 永远够不到;
// 编辑器内 Esc 会先关掉补全提示再冒泡到这里退出沉浸,两者并存可接受。
// 弹窗优先:Dialog/Sheet(代码草稿纸/笔记)开着时 Esc 归弹窗,不退沉浸(2026-08-28)。

interface ImmersiveState {
  immersive: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const ImmersiveContext = createContext<ImmersiveState>({
  immersive: false,
  enter: () => {},
  exit: () => {},
  toggle: () => {},
});

async function setNativeFullscreen(on: boolean): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setFullscreen(on);
  } catch (e) {
    // 全屏失败不阻塞 CSS 沉浸:记日志即可
    logger.warn(
      `[immersive] setFullscreen(${on}) 失败: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [immersive, setImmersive] = useState(false);
  const location = useLocation();

  const enter = useCallback(() => setImmersive(true), []);
  const exit = useCallback(() => setImmersive(false), []);
  const toggle = useCallback(() => setImmersive((v) => !v), []);

  // 系统全屏跟随沉浸态(浏览器层 isTauri 为 false,天然只剩 CSS 沉浸)
  useEffect(() => {
    if (!isTauri()) return;
    void setNativeFullscreen(immersive);
  }, [immersive]);

  // Esc 退出:只在沉浸中挂监听
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 弹窗优先(Esc 归 Dialog/Sheet,不退沉浸)。两道守卫都与监听顺序无关:
      // radix 的关闭监听在 document 捕获阶段先跑,关弹窗时会 preventDefault——
      // 本监听(冒泡)看到 defaultPrevented 即返回;若本监听先执行,
      // DOM 里 data-state=open 还在,第二道守卫兜住
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
        return;
      }
      setImmersive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersive]);

  // 离开刷题路由自动退出(含 Cmd+← 后退场景),全屏由上面的跟随 effect 一并还原
  useEffect(() => {
    if (immersive && !location.pathname.endsWith('/session')) setImmersive(false);
  }, [location.pathname, immersive]);

  const value = useMemo(
    () => ({ immersive, enter, exit, toggle }),
    [immersive, enter, exit, toggle],
  );

  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

export const useImmersive = () => useContext(ImmersiveContext);
