import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Inbox, Settings, Bot, Code2, LibraryBig, BookOpen, Zap, ArrowLeft,
  type LucideIcon,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getMyCategory, getPendingCount, subscribeMyLib } from '@/lib/mylib';
import { loadKey } from '@/lib/llm-config';

// 桌面壳:常驻侧栏导航 + 内容区。
// 后退语义:侧栏直达页(总览/生题/草稿/设置/分类队列)是同级切换,不需要后退;
// 只有下钻子页(刷题/浏览)显示「← 返回{分类名}」,固定回该分类队列页(不依赖历史栈)。
// Cmd/Ctrl/Alt+← 保留为系统级 history.back()(编辑器内不抢键);窄窗(<lg)侧栏收成图标栏。

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  agent: Bot,
  fe: Code2,
  my: LibraryBig,
};

function parseHashParts(): string[] {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split('?')[0].split('/').filter(Boolean);
}

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  count?: number; // 右侧灰字计数(分类题数)
  badge?: number; // 警示角标(草稿待审)
  warn?: boolean; // 警示点(如未配置 LLM key)
}

function NavItem({ href, icon: Icon, label, active, count, badge, warn }: NavItemProps) {
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
      {warn && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />}
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
  const mainRef = useRef<HTMLDivElement>(null);
  const [parts, setParts] = useState<string[]>(parseHashParts());
  const [noKey, setNoKey] = useState(false);
  const { data } = useQuestions();

  // 草稿角标/我的题库计数跟随 mylib 变化
  const [, bump] = useState(0);
  useEffect(() => subscribeMyLib(() => bump((v) => v + 1)), []);
  const myCategory = getMyCategory();
  const pendingCount = getPendingCount();

  useEffect(() => {
    const onChange = () => {
      setParts(parseHashParts());
      mainRef.current?.scrollTo({ top: 0 });
      checkKey();
    };

    // Cmd/Ctrl+← 或 Alt+← 系统级后退;编辑场景(输入框/编辑器)不抢快捷键
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.altKey) && e.key === 'ArrowLeft') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        window.history.back();
      }
    };

    let alive = true;
    const checkKey = () => {
      loadKey()
        .then((k) => {
          if (alive) setNoKey(!k);
        })
        .catch(() => {});
    };
    checkKey();

    window.addEventListener('hashchange', onChange);
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // 下钻子页(刷题/浏览):显示固定返回所属分类队列
  const isSubPage = parts.length >= 2;
  const backCatSlug = isSubPage ? parts[0] : null;
  const backCatName = backCatSlug
    ? (backCatSlug === 'my' ? myCategory.name : data?.categories.find((c) => c.slug === backCatSlug)?.name)
    : null;

  const root = parts[0] ?? '';
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
            href="#/my"
            icon={LibraryBig}
            label="我的题库"
            active={root === 'my'}
            count={myCategory.count}
          />
        </nav>

        {/* 底部:设置(未配 key 亮警示点) */}
        <div className="border-t border-border p-2">
          <NavItem href="#/settings" icon={Settings} label="设置" active={root === 'settings'} warn={noKey} />
        </div>
      </aside>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {isSubPage && backCatSlug && (
          <div className="shrink-0 px-6 pt-4">
            <a
              href={`#/${backCatSlug}`}
              title="回到该分类题库"
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 回到{backCatName ?? backCatSlug}
              {(backCatName ?? '').endsWith('题库') ? '' : '题库'}
            </a>
          </div>
        )}
        <div ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
