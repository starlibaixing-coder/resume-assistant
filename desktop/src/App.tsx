import { HashRouter, Routes, Route, Outlet, useParams } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { OverviewPage } from '@/pages/overview';
import { QueuePage } from '@/pages/queue';
import { QuizPage } from '@/pages/quiz';
import { BrowsePage } from '@/pages/browse';
import { GeneratePage } from '@/pages/generate';
import { DraftsPage } from '@/pages/drafts';
import { SettingsPage } from '@/pages/settings';

// 路由:/ 总览;/generate /drafts /settings 工具页;/:category 分类队列;
// /:category/quiz 刷题、/:category/browse 浏览(下钻子页,壳里显示"回到xxx题库")。
// HashRouter:沿用 #/ 地址形态(Tauri 本地加载,无需服务端路由)。

function CategoryRoute({ children }: { children: (category: string) => React.ReactElement }) {
  const { category } = useParams();
  return <>{children(category ?? '')}</>;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell><Outlet /></AppShell>}>
          <Route index element={<OverviewPage />} />
          <Route path="generate" element={<GeneratePage />} />
          <Route path="drafts" element={<DraftsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path=":category" element={<CategoryRoute>{(c) => <QueuePage category={c} />}</CategoryRoute>} />
          <Route path=":category/quiz" element={<CategoryRoute>{(c) => <QuizPage category={c} />}</CategoryRoute>} />
          <Route path=":category/browse" element={<CategoryRoute>{(c) => <BrowsePage category={c} />}</CategoryRoute>} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
