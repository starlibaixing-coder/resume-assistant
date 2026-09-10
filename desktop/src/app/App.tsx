// 应用根:HashRouter + 八路由(§6.1)+ 全局件(⌘K / GuardDialog / Toaster / Tooltip)。
// AppShell 挂全部路由(/session 也挂壳,专注由 FocusLayer 隐壳,§6.2)。
// document.title = {页面名} · CommitCareer(见 AppShell)。

import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';

import { AppShell } from './app-shell';
import { CommandPalette } from './command-palette';
import { GuardDialog } from './guard-dialog';
import { TodayPage } from '@/pages/today';
import { SessionPage } from '@/pages/session';
import { LibraryPage } from '@/pages/library';
import { ReviewPage } from '@/pages/review';
import { AddPage } from '@/pages/add';
import { JdPage } from '@/pages/jd';
import { ResumePage } from '@/pages/resume';
import { SettingsPage } from '@/pages/settings';
import { ErrorState } from '@/components/biz/states';
import { initHotkeys, setHotkeyDeps } from '@/lib/hotkeys';
import { requestNavigation } from '@/lib/guard';
import { initStorage, setOnPersistError, getMeta, setMeta, _seedForTest, _resetStorageForTest } from '@/lib/storage';
import { migrateLegacyLlmConfig } from '@/lib/generate';
import { startSession } from '@/lib/session';
import { seedOfficialIfEmpty } from '@/lib/sync';
import { initTheme } from '@/lib/theme';
import { logger } from '@/lib/logger';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export function App() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOnPersistError((msg) => toast.error('存储写入失败', { description: msg }));
    initStorage()
      .then(async () => {
        await seedOfficialIfEmpty();
        migrateLegacyLlmConfig(getMeta, setMeta);
        if (cancelled) return;
        initTheme();
        setReady(true);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`[boot] 存储初始化失败: ${msg}`);
        if (!cancelled) setBootError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <ErrorState title="存储初始化失败" description={bootError} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!ready) return <BootSplash />;
  return (
    <HashRouter>
      <TooltipProvider>
        <AppInner />
      </TooltipProvider>
    </HashRouter>
  );
}

function BootSplash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background">
      <span className="font-display text-3xl tracking-wide text-primary">CommitCareer</span>
      <RefreshCwIcon className="size-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const guardedNavigate = useCallback(
    (to: string) => {
      requestNavigation(() => navigate(to));
    },
    [navigate],
  );

  // e2e / dev 演示数据钩子(仅开发构建暴露)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__cc = {
        _seedForTest,
        _resetStorageForTest,
        startSession,
        version: 'frontend-rebuild',
      };
    }
  }, []);

  useEffect(() => {
    setHotkeyDeps({
      navigate: guardedNavigate,
      currentPath: () => location.pathname,
      openPalette: () => setPaletteOpen(true),
      isPaletteOpen: () => paletteOpen,
      isModalOpen: () => !!document.querySelector('[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [data-slot="sheet-content"]'),
    });
    return initHotkeys();
  }, [guardedNavigate, location.pathname, paletteOpen]);

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<TodayPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/add" element={<AddPage />} />
          <Route path="/jd" element={<JdPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navigate={guardedNavigate} />
      <GuardDialog />
      <Toaster />
    </>
  );
}
