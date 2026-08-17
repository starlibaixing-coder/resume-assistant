import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Sparkles, Inbox, Settings, Bot, Code2, LibraryBig, BookOpen, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { ModeToggle } from '@/components/mode-toggle';

// 桌面壳:常驻侧栏导航 + 独立滚动内容区。
// 桌面端与 web 站已分家(ADR-6),不再用"网页式"窄栏 + 返回链接;
// 窄窗口(<lg)侧栏收成图标栏,功能不丢。

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  agent: Bot,
  fe: Code2,
  my: LibraryBig,
};

function parseHashRoot(): string {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split(/[/?]/)[0] || '';
}

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number; // 右侧灰字计数(分类题数)
  badge?: number; // 警示角标(草稿待审)
}

function NavItem({ href, icon: Icon, label, active, count, badge }: NavItemProps) {
  return (
    <a
      href={href}
      title={label}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm cursor-pointer transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate lg:inline">{label}</span>
      {badge != null && badge > 0 && (
        <span className="hidden rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-mono leading-none text-warning-foreground lg:inline">
          {badge}
        </span>
      )}
      {count != null && (
        <span className="hidden font-mono text-xs text-muted-foreground/70 lg:inline">{count}</span>
      )}
    </a>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const [root, setRoot] = useState(parseHashRoot());
  const { data } = useQuestions();

  // 草稿角标/我的题库计数跟随 mylib 变化
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  // 路由切换:高亮对应侧栏项 + 内容区滚回顶部
  useEffect(() => {
    const onChange = () => {
      setRoot(parseHashRoot());
      mainRef.current?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const cats = (data?.categories ?? []).filter((c) => c.slug !== 'my');

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="flex h-full w-14 shrink-0 flex-col border-r border-border bg-card lg:w-56">
        {/* 品牌 */}
        <a href="#/" className="flex items-center gap-2.5 px-2.5 py-4 lg:px-3.5" title="刷题 Agent">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span className="hidden text-sm font-semibold tracking-tight lg:inline">刷题 Agent</span>
        </a>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
          <NavItem href="#/" icon={LayoutDashboard} label="总览" active={root === ''} />
          <NavItem href="#/generate" icon={Sparkles} label="AI 生题" active={root === 'generate'} />
          <NavItem href="#/drafts" icon={Inbox} label="草稿区" active={root === 'drafts'} badge={pendingCount} />

          <div className="hidden px-2.5 pb-1 pt-4 text-[11px] font-mono uppercase tracking-wider text-muted-foreground/60 lg:block">
            题库分类
          </div>
          {cats.map((c) => (
            <NavItem
              key={c.slug}
              href={`#/${c.slug}`}
              icon={CATEGORY_ICONS[c.slug] ?? BookOpen}
              label={c.name}
              active={root === c.slug}
              count={c.count}
            />
          ))}
          <NavItem
            href="#/my/browse"
            icon={LibraryBig}
            label="我的题库"
            active={root === 'my'}
            count={myCategory.count}
          />
        </nav>

        {/* 底部:设置 + 主题 */}
        <div className="space-y-1 border-t border-border p-2">
          <NavItem href="#/settings" icon={Settings} label="设置" active={root === 'settings'} />
          <div className="flex justify-center pt-1 lg:justify-end">
            <ModeToggle />
          </div>
        </div>
      </aside>

      <main ref={mainRef} className="h-full min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
