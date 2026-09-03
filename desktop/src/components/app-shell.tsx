import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Settings, Bot, Code2, LibraryBig, BookOpen, Zap, ArrowLeft, Target, FileText,
  type LucideIcon,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useImmersive } from '@/lib/immersive';

// 桌面壳:常驻侧栏导航 + 内容区(页面由 App.tsx 的 Routes 经 children 传入)。
// 品牌 CommitCareer(窗口标题/productName/侧栏/document.title 四处统一)。
// 菜单按两大块分组(2026-09-02 IA 重构):总览 →【题库】官方分类+我的题库(待审数挂
// 我的题库 badge)→【求职】JD 管理 / 简历管理(同一中枢页的两个 tab)→ 设置。
// 出题不是菜单:是各页面的按钮(添加题目 / AI 生成题目 / 按 JD 生成)。
// 后退语义:侧栏直达页是同级切换不显示后退;只有下钻子页(刷题/浏览)显示
// 「← 回到{分类名}题库」,固定回该分类队列页(不依赖历史栈)。
// Cmd/Ctrl/Alt+← 为系统级 history.back()(编辑器内不抢键);窄窗(<lg)侧栏收成图标栏。
// 沉浸式刷题(lib/immersive)时侧栏与返回条不渲染,内容区结构不变。
// document.title 跟随路由显示「页面 · CommitCareer」。

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  agent: Bot,
  fe: Code2,
  my: LibraryBig,
};

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number; // 右侧灰字计数(分类题数)
  badge?: number; // 警示角标(草稿待审)
}

function NavItem({ to, icon: Icon, label, active, count, badge }: NavItemProps) {
  return (
    <Link
      to={to}
      title={label}
      className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm cursor-pointer transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{label}</span>
      {/* 角标挂图标右上角:窄窗(<lg 只剩图标)也能看到"有待审"信号(审计 E4) */}
      {badge != null && badge > 0 && (
        <span className="absolute left-5.5 top-1 min-w-4 rounded-full bg-warning px-1 text-center text-[10px] font-mono leading-4 text-warning-foreground">
          {badge}
        </span>
      )}
      {count != null && (
        <span className="hidden font-mono text-xs text-muted-foreground/70 lg:inline">{count}</span>
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

  // 草稿角标/我的题库计数跟随 mylib 变化
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  // 路由切换:内容区滚回顶部
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  // document.title 跟随路由:顶层页用菜单名,子页用「分类 · 页面」
  useEffect(() => {
    const root = parts[0] ?? '';
    const sub = parts[1];
    const topTitles: Record<string, string> = {
      '': '总览',
      drafts: '待审核',
      settings: '设置',
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
      title = backCatName ?? catNameOf(root) ?? root; // 题库分类页:分类名(如「我的题库」)
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
  // 求职中枢的两个侧栏入口(JD 管理 / 简历管理)共用 /profile,按 ?tab= 预选
  const profileTab = new URLSearchParams(location.search).get('tab') === 'resume' ? 'resume' : 'jds';

  // 分类名(分类页标题 / 返回条共用):my 特判,官方分类查聚合
  const catNameOf = (slug: string) =>
    slug === 'my' ? myCategory.name : data?.categories.find((c) => c.slug === slug)?.name;

  // 下钻子页(刷题/浏览):显示固定返回所属分类队列
  const isSubPage = parts.length >= 2;
  const backCatSlug = isSubPage ? parts[0] : null;
  const backCatName = backCatSlug ? (catNameOf(backCatSlug) ?? null) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* 沉浸式:侧边栏与返回条都不渲染,内容区结构保持不变(刷题页自留进度行作唯一 chrome) */}
      {!immersive && (
        <aside className="flex h-full w-14 shrink-0 flex-col border-r border-border bg-card lg:w-56">
          {/* 品牌 */}
          <Link to="/" className="flex items-center gap-2.5 px-2.5 py-4 lg:px-3.5" title="CommitCareer">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <span className="hidden text-sm font-semibold tracking-tight lg:inline">CommitCareer</span>
          </Link>

          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
            <NavItem to="/" icon={LayoutDashboard} label="总览" active={root === ''} />

            {/* 题库组:官方分类 + 我的题库;待审数挂我的题库(待审的题本质是进我库的候选) */}
            <div className="hidden px-2.5 pb-1 pt-4 text-xs font-medium text-muted-foreground/70 lg:block">
              题库
            </div>
            {cats.map((c) => (
              <NavItem
                key={c.slug}
                to={`/${c.slug}`}
                icon={CATEGORY_ICONS[c.slug] ?? BookOpen}
                label={c.name}
                active={root === c.slug}
                count={c.count}
              />
            ))}
            <NavItem
              to="/my"
              icon={LibraryBig}
              label="我的题库"
              active={root === 'my'}
              count={myCategory.count}
              badge={pendingCount}
            />

            {/* 求职组:同一中枢页的两个入口,按 ?tab= 预选 */}
            <div className="hidden px-2.5 pb-1 pt-4 text-xs font-medium text-muted-foreground/70 lg:block">
              求职
            </div>
            <NavItem
              to="/profile"
              icon={Target}
              label="JD 管理"
              active={root === 'profile' && profileTab === 'jds'}
            />
            <NavItem
              to="/profile?tab=resume"
              icon={FileText}
              label="简历管理"
              active={root === 'profile' && profileTab === 'resume'}
            />
          </nav>

          {/* 底部:设置 */}
          <div className="border-t border-border p-2">
            <NavItem to="/settings" icon={Settings} label="设置" active={root === 'settings'} />
          </div>
        </aside>
      )}

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {!immersive && isSubPage && backCatSlug && (
          <div className="shrink-0 px-6 pt-4">
            <Link
              to={`/${backCatSlug}`}
              title="回到该分类题库"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 回到{backCatName ?? backCatSlug}
              {(backCatName ?? '').endsWith('题库') ? '' : '题库'}
            </Link>
          </div>
        )}
        <div ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
