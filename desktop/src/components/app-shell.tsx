import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft, ArrowRight, FileText, Inbox, LayoutDashboard, LibraryBig, Play,
  Search, Settings, Target, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { useImmersive } from '@/lib/immersive';
import { firstBlocked } from '@/lib/nav-guard';
import { keysBlocked } from '@/lib/use-page-keys';
import { CommandPalette } from '@/components/command-palette';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 桌面壳 v11「全窗工作台」:
//   左 56px 图标栏(计数角标 + 朱砂当前指示)取代文字侧栏;顶部工具条只留 历史‹›+⌘K;
//   状态栏取消(计数上移到今日 hero 与图标栏角标);**居中页面容器取消**——
//   内容区不做统一 max-w/内边距,每个视图自己定义框架(工作台视图吃满全窗高度,
//   表单类视图自居中)。练习路由 = 全窗接管:壳不渲染,由练习页自绘最小 chrome。
// v10 保留:guardedNavigate(dirty 全局守卫)、Cmd+1..7、Cmd+←/→、⌘K 面板。

interface RailItem {
  to: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number;
  shortcut: string;
}

function historyIdx(): number {
  return (window.history.state as { idx?: number } | null)?.idx ?? 0;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const root = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const isReviewTab = new URLSearchParams(location.search).get('tab') === 'review';
  const { immersive } = useImmersive();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const maxIdxRef = useRef(0);
  const idx = historyIdx();
  if (idx > maxIdxRef.current) maxIdxRef.current = idx;
  const canBack = idx > 0;
  const canForward = idx < maxIdxRef.current;

  const pendingCount = getPendingCount();
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);

  const guardedNavigate = (to: string) => {
    if (firstBlocked()) {
      setLeaveTo(to);
      return;
    }
    navigate(to);
  };
  const confirmLeave = () => {
    const target = leaveTo;
    firstBlocked()?.release();
    setLeaveTo(null);
    if (target != null) navigate(target);
  };

  useEffect(() => {
    const titles: Record<string, string> = {
      '': '今日',
      session: '练习',
      library: isReviewTab ? '审核' : '题库',
      add: '添加题目',
      profile: new URLSearchParams(location.search).get('tab') === 'resume' ? '简历管理' : 'JD 管理',
      settings: '设置',
    };
    document.title = `${titles[root] ?? '今日'} · CommitCareer`;
  }, [location.pathname, location.search, root, isReviewTab]);

  // 快捷键:Cmd/Ctrl+1..7 切空间;Cmd+K 面板;Cmd+←/→ 历史(输入控件/弹层/确认时让键)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (keysBlocked()) return;
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const targets: Array<[string, string]> = [
        ['1', '/'], ['2', '/session'], ['3', '/library'],
        ['4', '/library?tab=review'], ['5', '/profile'], ['6', '/profile?tab=resume'],
        ['7', '/settings'],
      ];
      const hit = targets.find(([k]) => e.key === k);
      if (hit) {
        e.preventDefault();
        guardedNavigate(hit[1]);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (canBack) navigate(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (canForward) navigate(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, canBack, canForward, leaveTo]);

  const profileTab = new URLSearchParams(location.search).get('tab') === 'resume';
  const rail: RailItem[] = [
    { to: '/', icon: LayoutDashboard, label: '今日', active: root === '', shortcut: '1' },
    { to: '/session', icon: Play, label: '练习', active: root === 'session', shortcut: '2' },
    { to: '/library', icon: LibraryBig, label: '题库', active: (root === 'library' && !isReviewTab) || root === 'add', shortcut: '3' },
    { to: '/library?tab=review', icon: Inbox, label: '审核', active: root === 'library' && isReviewTab, count: pendingCount, shortcut: '4' },
    { to: '/profile', icon: Target, label: 'JD 管理', active: root === 'profile' && !profileTab, shortcut: '5' },
    { to: '/profile?tab=resume', icon: FileText, label: '简历管理', active: root === 'profile' && profileTab, shortcut: '6' },
    { to: '/settings', icon: Settings, label: '设置', active: root === 'settings', shortcut: '7' },
  ];

  // 练习路由 = 全窗接管:壳只留内容,练习页自绘最小 chrome(含 data-app-nav)
  if (root === 'session') {
    return (
      <div className="flex h-svh w-full flex-col overflow-hidden bg-background text-foreground">
        <main className="min-h-0 flex-1">{children}</main>
        <AlertDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)}>
          <LeaveDialogBody onConfirm={confirmLeave} />
        </AlertDialog>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={guardedNavigate} />
      </div>
    );
  }

  const railEl = !immersive && (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 bg-sidebar py-3">
      {rail.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <Link
              to={item.to}
              aria-label={item.label}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                item.active
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground',
              )}
            >
              {item.active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
              )}
              <item.icon className="size-[18px]" aria-hidden />
              {item.count != null && item.count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold leading-none text-warning-foreground tabular-nums">
                  {item.count}
                </span>
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}  ⌘{item.shortcut}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground">
      {railEl}
      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && (
          <div data-app-nav className="flex h-12 shrink-0 items-center gap-1 px-3">
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
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 rounded-lg px-3 text-xs text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
              >
                <Search className="size-3.5" aria-hidden />
                前往
                <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[10px] leading-4">⌘K</kbd>
              </Button>
            </div>
          </div>
        )}
        {/* 内容区不做统一容器:工作台视图吃满全窗,表单类视图自行居中 */}
        <main className="min-h-0 flex-1">{children}</main>
      </div>

      <AlertDialog open={!!leaveTo} onOpenChange={(o) => !o && setLeaveTo(null)}>
        <LeaveDialogBody onConfirm={confirmLeave} />
      </AlertDialog>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={guardedNavigate} />
    </div>
  );
}

function LeaveDialogBody({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>有未保存的修改</AlertDialogTitle>
        <AlertDialogDescription>离开后这些修改不会保存。要先保存再离开吗?</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>留在本页</AlertDialogCancel>
        <Button variant="secondary" onClick={onConfirm}>
          不保存,离开
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
