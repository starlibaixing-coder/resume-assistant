import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useImmersive } from '@/lib/immersive';

// 桌面壳 v2「纸面编辑部」:顶部导航条替代左侧栏(2026-09-04 从 0 重设计)。
// 布局 = 品牌字标 + 横向导航(当前项橙色下划线)+ 右侧设置;内容区在其下滚动。
// 分组语义保留:题库(官方分类 + 我的题库)/ 求职(JD 管理 / 简历管理),组间细线分隔。
// 品牌 CommitCareer 以字标形式回到导航条左端(v2 设计决策:顶导航范式需要home锚点,
// 推翻 2026-08-31 "侧栏不常驻品牌"——那是针对旧侧栏的指示)。
// 后退语义:下钻子页(学习/题目列表)在内容区顶部显示「← 回到{分类}题库」;
// Cmd/Ctrl/Alt+← 为系统级 history.back()(输入控件内不抢键)。
// 沉浸式刷题(lib/immersive)时导航条与返回条不渲染。

interface NavItemProps {
  to: string;
  label: string;
  active: boolean;
  count?: number; // 灰字计数(分类题数)
  badge?: number; // 警示角标(待审数)
}

function NavItem({ to, label, active, count, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      className={cn(
        'flex h-14 items-center gap-1.5 border-b-2 text-sm transition-colors',
        active
          ? 'border-primary font-medium text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-warning/15 px-1.5 text-xs font-medium tabular-nums leading-4 text-warning">
          {badge}
        </span>
      )}
      {count != null && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground/70">{count}</span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const { data } = useQuestions();
  const { immersive } = useImmersive();

  // 待审角标/我的题库计数跟随 mylib 变化
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  // 路由切换:内容区滚回顶部
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  // document.title 跟随路由:顶层页用导航名,子页用「分类 · 页面」
  useEffect(() => {
    const root = parts[0] ?? '';
    const sub = parts[1];
    const topTitles: Record<string, string> = {
      '': '总览',
      drafts: '待审核',
      settings: '设置',
      add: '添加题目',
    };
    let title: string;
    if (root === 'profile') {
      title = new URLSearchParams(location.search).get('tab') === 'resume' ? '简历管理' : 'JD 管理';
    } else if (topTitles[root] != null || root === '') {
      title = topTitles[root] ?? '总览';
    } else if (sub === 'quiz') {
      title = '学习';
    } else if (sub === 'browse') {
      title = '题目列表';
    } else {
      title = backCatName ?? catNameOf(root) ?? root; // 题库分类页:分类名
    }
    document.title = `${title} · CommitCareer`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Cmd/Ctrl+← 或 Alt+← 系统级后退;编辑场景(输入框/编辑器)不抢快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.altKey) && e.key === 'ArrowLeft') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        window.history.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const root = parts[0] ?? '';
  const cats = (data?.categories ?? []).filter((c) => c.slug !== 'my');
  const profileTab = new URLSearchParams(location.search).get('tab') === 'resume' ? 'resume' : 'jds';

  // 分类名(分类页标题 / 返回条共用):my 特判,官方分类查聚合
  const catNameOf = (slug: string) =>
    slug === 'my' ? myCategory.name : data?.categories.find((c) => c.slug === slug)?.name;

  // 下钻子页(学习/题目列表):显示固定返回所属分类页
  const isSubPage = parts.length >= 2;
  const backCatSlug = isSubPage ? parts[0] : null;
  const backCatName = backCatSlug ? (catNameOf(backCatSlug) ?? null) : null;

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      {/* 沉浸式:导航条与返回条都不渲染,内容区结构保持不变 */}
      {!immersive && (
        <header data-app-nav className="flex h-14 shrink-0 items-start border-b border-border bg-background">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-8 px-6">
            <Link to="/" className="text-sm font-bold tracking-tight text-foreground">
              CommitCareer<span className="text-primary">.</span>
            </Link>
            <nav className="flex h-14 items-center gap-5">
              <NavItem to="/" label="总览" active={root === ''} />
              <span className="h-4 w-px bg-border" aria-hidden />

              {/* 题库组:官方分类 + 我的题库(待审数挂角标) */}
              {cats.map((c) => (
                <NavItem
                  key={c.slug}
                  to={`/${c.slug}`}
                  label={c.name}
                  active={root === c.slug}
                  count={c.count}
                />
              ))}
              <NavItem
                to="/my"
                label="我的题库"
                active={root === 'my'}
                count={myCategory.count}
                badge={pendingCount}
              />
              <span className="h-4 w-px bg-border" aria-hidden />

              {/* 求职组:同一中枢页的两个入口,按 ?tab= 预选 */}
              <NavItem
                to="/profile"
                label="JD 管理"
                active={root === 'profile' && profileTab === 'jds'}
              />
              <NavItem
                to="/profile?tab=resume"
                label="简历管理"
                active={root === 'profile' && profileTab === 'resume'}
              />
            </nav>

            {/* 右侧:设置 */}
            <div className="ml-auto flex h-14 items-center">
              <NavItem to="/settings" label="设置" active={root === 'settings'} />
            </div>
          </div>
        </header>
      )}

      {!immersive && isSubPage && backCatSlug && (
        <div className="shrink-0 border-b border-border px-6">
          <div className="mx-auto max-w-6xl">
            <Link
              to={`/${backCatSlug}`}
              title="回到该分类题库"
              className="inline-flex items-center gap-1.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 回到{backCatName ?? backCatSlug}
              {(backCatName ?? '').endsWith('题库') ? '' : '题库'}
            </Link>
          </div>
        </div>
      )}
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* --page-pad-y:页面纵向内边距,学习页吸底操作条按它对齐(见 quiz.tsx 文件头) */}
        <div
          className="mx-auto max-w-6xl px-6 pb-10 pt-10 [--page-pad-y:2.5rem]"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
