import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/theme';
import { initStorage } from '@/lib/storage';
import { isTauri } from '@/lib/llm-config';
import { runSmoke } from '@/lib/smoke';
import { logger } from '@/lib/logger';
import { syncOfficialBank } from '@/lib/officialbank';
import '@fontsource-variable/fraunces';
import './index.css';

// 启动分流:
// - 冒烟模式(SMOKE=1 / --smoke):不渲染 UI,跑真机五步自检(smoke.ts),按结果退出码收尾
// - 常规:SQLite 灌内存缓存。web 预览(无 Tauri)走空缓存属正常降级,只打日志;
//   Tauri 壳内失败 = 数据不持久化,必须横幅暴露,不允许静默内存模式。
async function boot(): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const smoke = await invoke<boolean>('is_smoke_mode').catch(() => false);
    if (smoke) {
      const passed = await runSmoke();
      await invoke('smoke_finish', { passed }).catch(() => {});
      return; // 等待 Rust 侧 app.exit,不渲染 UI
    }
  }

  let storageError: string | null = null;
  await initStorage()
    .then(() => {
      // 启动自动同步官方题库(用户确认):失败静默只记日志,不打扰
      if (isTauri()) {
        void syncOfficialBank().catch((e: unknown) => {
          logger.warn(`[official] 启动自动同步失败: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    })
    .catch((e) => {
      storageError = e instanceof Error ? e.message : String(e);
      logger.error(`[storage] initStorage 失败,当前会话数据不会持久化: ${storageError}`);
    });
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
}

void boot();
