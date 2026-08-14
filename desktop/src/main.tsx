import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from '@/lib/theme';
import { initStorage } from '@/lib/storage';
import './index.css';

// 启动加载:从 SQLite 灌内存缓存(B 方案)。失败(web 预览/降级)不阻塞,用空缓存渲染。
initStorage()
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="quiz-theme">
          <App />
        </ThemeProvider>
      </StrictMode>,
    );
  });
