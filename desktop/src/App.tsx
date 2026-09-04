import { HashRouter, Routes, Route, Outlet, Navigate, useParams } from 'react-router';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { ImmersiveProvider } from '@/lib/immersive';
import { TodayPage } from '@/pages/overview';
import { QuizPage } from '@/pages/quiz';
import { LibraryPage } from '@/pages/library';
import { ProfilePage } from '@/pages/profile';
import { SettingsPage } from '@/pages/settings';
import { AddQuestionPage } from '@/pages/add-question';

// 路由(v4「今日驱动」IA,2026-09-04):
//   /            今日(计划 + 主 CTA「开始练习」)
//   /session     练习会话(?category= 限定分类,?focus=due|new|all 限定范围)
//   /library     题库空间(?category= 分类,?tab=review 审核模式)
//   /add         添加题目;  /profile 求职;  /settings 设置
// 旧路由重定向兼容:/drafts → 题库·审核;/my、/:category、/:category/browse →
// 题库对应分类;/:category/quiz → /session?category=(书签不断链)。
// HashRouter:沿用 #/ 地址形态(Tauri 本地加载,无需服务端路由)。

function CategoryRedirect({ kind }: { kind: 'home' | 'quiz' | 'browse' }) {
  const { category } = useParams();
  const to = kind === 'quiz' ? `/session?category=${category}` : `/library?category=${category}`;
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <HashRouter>
      {/* 沉浸式状态需在 Router 内(useLocation 路由守卫),AppShell/练习页共同消费 */}
      <ImmersiveProvider>
        <Routes>
          <Route element={<AppShell><Outlet /></AppShell>}>
            <Route index element={<TodayPage />} />
            <Route path="session" element={<QuizPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="add" element={<AddQuestionPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* 旧路由重定向(v3 及以前的书签/深链) */}
            <Route path="drafts" element={<Navigate to="/library?tab=review" replace />} />
            <Route path="my" element={<Navigate to="/library?category=my" replace />} />
            <Route path=":category" element={<CategoryRedirect kind="home" />} />
            <Route path=":category/quiz" element={<CategoryRedirect kind="quiz" />} />
            <Route path=":category/browse" element={<CategoryRedirect kind="browse" />} />
          </Route>
        </Routes>
      </ImmersiveProvider>
      <Toaster />
    </HashRouter>
  );
}
