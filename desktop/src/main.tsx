import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/theme';
import { initStorage } from '@/lib/storage';
import { isTauri } from '@/lib/llm-config';
import './index.css';

// 启动加载:从 SQLite 灌内存缓存(B 方案)。web 预览(无 Tauri)走空缓存属正常降级,只打日志;
// Tauri 壳内失败 = 数据不持久化,必须横幅暴露,不允许静默内存模式(看着保存成功、实际退出全丢)。
let storageError: string | null = null;
initStorage()
  .catch((e) => {
    storageError = e instanceof Error ? e.message : String(e);
    console.error('[storage] initStorage 失败,当前会话数据不会持久化:', e);
  })
  .finally(() => {
    const banner =
      storageError && isTauri() ? (
        <div className="border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-xs text-destructive">
          存储初始化失败,当前会话的数据不会持久化:{storageError}
        </div>
      ) : null;
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="quiz-theme">
          {banner}
          <App />
        </ThemeProvider>
      </StrictMode>,
    );
  });
