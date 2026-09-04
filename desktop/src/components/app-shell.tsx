import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft, ArrowRight, Bot, Code2, FileText, Inbox, LayoutDashboard, LibraryBig,
  Search, Settings, Target, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useImmersive } from '@/lib/immersive';
import { CommandPalette } from '@/components/command-palette';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 桌面壳 v3「桌面工作台」(2026-09-04 从 0 设计,specs/2026-09-04-ui-redesign.md §v3):
// 按桌面应用操作习惯组织——
//   源列表侧栏(分组/图标/右对齐计数/待审角标,Cmd+1..8 切换)
//   工具栏(历史 ‹ › / 子页面包屑 / ⌘K 命令面板)
//   内容区(main,页面自绘页头)
//   状态栏(库计数 + 本地存储提示)
// 沉浸式刷题时全部 chrome 不渲染(工具栏挂 data-app-nav,供 e2e 断言);
// main 恒常渲染,沉浸切换不重挂页面(刷题/笔记状态不丢)。
// Cmd/Ctrl+←/→ = 历史 Back/Forward(输入控件内不抢键)。

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  badge?: number;
  shortcut?: string;
}

function NavItem({ to, icon: Icon, label, active, count, badge, shortcut }: NavItemProps) {
  return (
    <Link
      to={to}
      title={shortcut ? `${label}  ⌘${shortcut}` : label}
      className={cn(
        'flex h-7 items-center gap-2 rounded-md px-2 text-[13px] transition-colors',
        active
          ? 'bg-accent font-medium text-accent-foreground'
          : 'text-sidebar-foreground hover:bg-accent/60 hover:text-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-medium leading-4 tabular-nums text-warning">
          {badge}
        </span>
      )}
      {count != null && (
        <span className="text-[11px] tabular-nums text-muted-foreground/80">{count}</span>
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pb-1 pt-4 text-[11px] font-medium text-muted-foreground/70">
      {children}
    </div>
  );
}

function historyIdx(): number {
  return (window.history.state as { idx?: number } | null)?.idx ?? 0;
}

export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const { data } = useQuestions();
  const { immersive } = useImmersive();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // 前进可达性:记录见过的最大 history idx(react-router 在 history.state 里维护 idx)
  const maxIdxRef = useRef(0);
  const idx = historyIdx();
  if (idx > maxIdxRef.current) maxIdxRef.current = idx;
  const canBack = idx > 0;
  const canForward = idx < maxIdxRef.current;

  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();
  // 待审角标/计数跟随 mylib 变化(审核动作发生在别的页面)
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);

  // 路由切换:内容区滚回顶部
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  // document.title 跟随路由
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
      title = catNameOf(root) ?? root;
    }
    document.title = `${title} · CommitCareer`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // 快捷键:Cmd/Ctrl+1..8 切分区;Cmd/Ctrl+K 命令面板(输入控件/弹窗打开时让键)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"], .cm-editor, .ProseMirror')) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const targets: Array<[string, string]> = [
        ['1', '/'], ['2', '/fe'], ['3', '/agent'], ['4', '/my'],
        ['5', '/profile'], ['6', '/profile?tab=resume'], ['7', '/drafts'], ['8', '/settings'],
      ];
      const hit = targets.find(([k]) => e.key === k);
      if (hit) {
        e.preventDefault();
        navigate(hit[1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const root = parts[0] ?? '';
  const cats = (data?.categories ?? []).filter((c) => c.slug !== 'my');
  const profileTab = new URLSearchParams(location.search).get('tab') === 'resume' ? 'resume' : 'jds';
  const catNameOf = (slug: string) =>
    slug === 'my' ? myCategory.name : data?.categories.find((c) => c.slug === slug)?.name;
  const isSubPage = parts.length >= 2;
  const subPageName = parts[1] === 'quiz' ? '学习' : '题目列表';

  // 状态栏计数
  const totalQuestions = data?.questions.length ?? 0;
  const todoCounts = useMemo(() => {
    if (!data) return { due: 0, unseen: 0 };
    let due = 0;
    let unseen = 0;
    for (const c of data.categories) {
      const s = getStats(c.slug, data.questions.filter((q) => q.category === c.slug).map((q) => q.id));
      due += s.dueToday;
      unseen += s.remaining;
    }
    return { due, unseen };
  }, [data]);

  const sidebar = (
    <aside className="flex w-52 shrink-0 flex-col bg-sidebar px-2 pb-2">
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="pt-2">
          <NavItem to="/" icon={LayoutDashboard} label="总览" active={root === ''} shortcut="1" />
        </div>

        <SectionLabel>题库</SectionLabel>
        {cats.map((c, i) => (
          <NavItem
            key={c.slug}
            to={`/${c.slug}`}
            icon={c.slug === 'fe' ? Code2 : c.slug === 'agent' ? Bot : LibraryBig}
            label={c.name}
            active={root === c.slug}
            count={c.count}
            shortcut={String(i + 2)}
          />
        ))}
        <NavItem
          to="/my"
          icon={LibraryBig}
          label="我的题库"
          active={root === 'my'}
          count={myCategory.count}
          shortcut="4"
        />

        <SectionLabel>求职</SectionLabel>
        <NavItem to="/profile" icon={Target} label="JD 管理" active={root === 'profile' && profileTab === 'jds'} shortcut="5" />
        <NavItem to="/profile?tab=resume" icon={FileText} label="简历管理" active={root === 'profile' && profileTab === 'resume'} shortcut="6" />

        <div className="min-h-4 flex-1" />
        <NavItem to="/drafts" icon={Inbox} label="待审核" active={root === 'drafts'} badge={pendingCount} shortcut="7" />
        <NavItem to="/settings" icon={Settings} label="设置" active={root === 'settings'} shortcut="8" />
      </nav>
    </aside>
  );

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        {!immersive && sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {!immersive && (
            <div data-app-nav className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-background px-2">
              {/* 工具栏:历史导航 + 子页面包屑 + 命令面板;data-app-nav 供沉浸断言 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label="后退"
                    disabled={!canBack}
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>后退(Cmd+←)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    aria-label="前进"
                    disabled={!canForward}
                    onClick={() => navigate(1)}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>前进(Cmd+→)</TooltipContent>
              </Tooltip>
              {isSubPage && (
                <span data-breadcrumb className="ml-1.5 truncate text-[13px] text-muted-foreground">
                  {catNameOf(parts[0] ?? '') ?? parts[0]} <span className="text-border">/</span> {subPageName}
                </span>
              )}
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                  onClick={() => setPaletteOpen(true)}
                >
                  <Search className="size-3.5" aria-hidden />
                  前往
                  <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[10px] leading-4">⌘K</kbd>
                </Button>
              </div>
            </div>
          )}
          <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-6 py-6">{children}</div>
          </main>
        </div>
      </div>
      {!immersive && (
        <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-background px-3 text-[11px] text-muted-foreground">
          {/* 状态栏:全局计数 + 本地存储提示 */}
          <span className="tabular-nums">
            题库 {totalQuestions} · 待复习 {todoCounts.due} · 待学习 {todoCounts.unseen} · 待审核 {pendingCount}
          </span>
          <span>本地优先 · 数据不上传</span>
        </footer>
      )}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
