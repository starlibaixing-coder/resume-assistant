// 壳:文字侧栏(216px,学习/求职两组)+ 内容 Outlet + 底部状态栏(§6.2)。
// 专注模式:html.cc-focus 下 [data-chrome] 隐藏(FocusLayer 联动,题干放大在 session 页)。
// document.title = {页面名} · CommitCareer。

import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Sidebar } from './sidebar';
import { StatusBar } from './status-bar';

const TITLES: Record<string, string> = {
  '/': '今日',
  '/session': '学习队列',
  '/library': '题库',
  '/review': '审核',
  '/add': '添加题目',
  '/jd': 'JD',
  '/resume': '简历',
  '/settings': '设置',
};

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${TITLES[pathname] ?? 'CommitCareer'} · CommitCareer`;
  }, [pathname]);

  return (
    <div className="flex h-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
