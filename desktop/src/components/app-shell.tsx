import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import {
  LayoutDashboard, Settings, Bot, Code2, LibraryBig, BookOpen, ArrowLeft, Target, FileText,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger,
} from '@/components/ui/sidebar';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useImmersive } from '@/lib/immersive';

// 桌面壳:shadcn 官方 Sidebar(collapsible="icon",Cmd/Ctrl+B 切换、贴边 Rail、
// 折叠态 Tooltip)+ 内容区。沉浸式刷题时侧栏与返回条不渲染。
// 菜单两大块(2026-09-02 IA):总览 →【题库】官方分类+我的题库(待审 badge 挂
// 右侧计数位,折叠态也可见)→【求职】JD 管理 / 简历管理 → 底部设置。
// 品牌 CommitCareer 只在窗口标题与 document.title(用户指示,侧栏不常驻)。
// 后退语义:侧栏直达页不显示后退;下钻子页(学习/题目列表)显示「← 回到{分类}题库」,
// 固定回该分类页;Cmd/Ctrl/Alt+← 为系统级 history.back()(输入控件内不抢键)。

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
  count?: number; // 右侧灰字计数(分类题数);待审 badge 出现时让位
  badge?: number; // 待审数:右缘警示徽标,折叠为图标态时覆盖在图标上(审计 E4)
}

function NavItem({ to, icon: Icon, label, active, count, badge }: NavItemProps) {
  const showBadge = badge != null && badge > 0;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link to={to}>
          <Icon />
          <span className="flex-1 truncate">{label}</span>
          {!showBadge && count != null && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground/70">{count}</span>
          )}
        </Link>
      </SidebarMenuButton>
      {showBadge && (
        <SidebarMenuBadge className="justify-center rounded-full bg-warning/15 text-warning">
          {badge}
        </SidebarMenuBadge>
      )}
    </SidebarMenuItem>
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

  // 下钻子页(学习/题目列表):显示固定返回所属分类页
  const isSubPage = parts.length >= 2;
  const backCatSlug = isSubPage ? parts[0] : null;
  const backCatName = backCatSlug ? (catNameOf(backCatSlug) ?? null) : null;

  return (
    <SidebarProvider className="h-svh overflow-hidden bg-background text-foreground">
      {/* 沉浸式:侧栏与返回条都不渲染,内容区结构保持不变(刷题页自留进度行作唯一 chrome) */}
      {!immersive && (
        <Sidebar collapsible="icon">
          <SidebarHeader className="pt-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarTrigger className="text-muted-foreground" />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem to="/" icon={LayoutDashboard} label="总览" active={root === ''} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 题库组:官方分类 + 我的题库;待审数挂我的题库(待审的题本质是进我库的候选) */}
            <SidebarGroup>
              <SidebarGroupLabel>题库</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* 求职组:同一中枢页的两个入口,按 ?tab= 预选 */}
            <SidebarGroup>
              <SidebarGroupLabel>求职</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
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
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* 底部:设置 */}
          <SidebarFooter>
            <SidebarMenu>
              <NavItem to="/settings" icon={Settings} label="设置" active={root === 'settings'} />
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
      )}

      <main className="flex h-svh min-w-0 flex-1 flex-col overflow-hidden">
        {!immersive && isSubPage && backCatSlug && (
          <div className="shrink-0 px-6 pt-4">
            <Link
              to={`/${backCatSlug}`}
              title="回到该分类题库"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
    </SidebarProvider>
  );
}
