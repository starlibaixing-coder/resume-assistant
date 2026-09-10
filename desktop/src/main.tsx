import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { isTauri } from './lib/db';
import './index.css';

// 真机冒烟模式(SMOKE=1 / --smoke):不渲染 UI,跑存储自检后退出
async function boot(): Promise<void> {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (await invoke<boolean>('is_smoke_mode')) {
        const { runSmoke } = await import('./lib/smoke');
        await runSmoke();
        return;
      }
    } catch {
      /* 非 Tauri 壳或命令缺失,正常渲染 */
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
