import { HashRouter, Routes, Route, Outlet, useParams } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { ImmersiveProvider } from '@/lib/immersive';
import { OverviewPage } from '@/pages/overview';
import { QueuePage } from '@/pages/queue';
import { QuizPage } from '@/pages/quiz';
import { BrowsePage } from '@/pages/browse';
import { ProfilePage } from '@/pages/profile';
import { DraftsPage } from '@/pages/drafts';
import { SettingsPage } from '@/pages/settings';
import { AddQuestionPage } from '@/pages/add-question';

// 路由:/ 总览;/profile 求职(JD+简历,?tab= 预选);/drafts 待审核;/settings;
// /:category 题库分类页;/:category/quiz 刷题、/:category/browse 题目列表(下钻子页)。
// /add 添加题目页(2026-09-03 用户确认弃弹窗改页面)。
// HashRouter:沿用 #/ 地址形态(Tauri 本地加载,无需服务端路由)。

function CategoryRoute({ children }: { children: (category: string) => React.ReactElement }) {
  const { category } = useParams();
  return <>{children(category ?? '')}</>;
}

export default function App() {
  return (
    <HashRouter>
      {/* 沉浸式状态需在 Router 内(useLocation 路由守卫),AppShell/刷题页共同消费 */}
      <ImmersiveProvider>
        <Routes>
          <Route element={<AppShell><Outlet /></AppShell>}>
            <Route index element={<OverviewPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="drafts" element={<DraftsPage />} />
            <Route path="add" element={<AddQuestionPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path=":category" element={<CategoryRoute>{(c) => <QueuePage category={c} />}</CategoryRoute>} />
            <Route path=":category/quiz" element={<CategoryRoute>{(c) => <QuizPage category={c} />}</CategoryRoute>} />
            <Route path=":category/browse" element={<CategoryRoute>{(c) => <BrowsePage category={c} />}</CategoryRoute>} />
          </Route>
        </Routes>
      </ImmersiveProvider>
      <Toaster />
    </HashRouter>
  );
}
