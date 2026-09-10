// 侧栏:品牌章 + 两组导航(研习:今日/学习队列/题库/审核/添加题目;求职:JD/简历)+ 底部设置。
// 审核项带待审数徽标;当前项朱砂浅底;全部经守卫式导航(dirty 表单先弹确认)。

import { useLocation, useNavigate } from 'react-router';
import {
  BadgeCheckIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CirclePlayIcon,
  FilePlus2Icon,
  FileUserIcon,
  SettingsIcon,
} from 'lucide-react';

import { requestNavigation } from '@/lib/guard';
import { ROUTES } from '@/lib/hotkeys';
import { useStatusCounts } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const GROUPS: { label: string; items: { path: string; title: string; icon: typeof CalendarDaysIcon }[] }[] = [
  {
    label: '研习',
    items: [
      { path: '/', title: '今日', icon: CalendarDaysIcon },
      { path: '/session', title: '学习队列', icon: CirclePlayIcon },
      { path: '/library', title: '题库', icon: BookOpenIcon },
      { path: '/review', title: '审核', icon: BadgeCheckIcon },
      { path: '/add', title: '添加题目', icon: FilePlus2Icon },
    ],
  },
  {
    label: '求职',
    items: [
      { path: '/jd', title: 'JD', icon: BriefcaseIcon },
      { path: '/resume', title: '简历', icon: FileUserIcon },
    ],
  },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const counts = useStatusCounts();
  const shortcuts = Object.fromEntries(ROUTES.map((r, i) => [r.path, String(i + 1)]));
  const go = (path: string) => requestNavigation(() => navigate(path));

  return (
    <aside data-chrome className="flex w-54 shrink-0 flex-col bg-card/50 px-3 pt-5 pb-3">
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-display text-lg text-primary-foreground shadow-sm">
          C
        </span>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold">CommitCareer</div>
          <div className="text-[11px] text-muted-foreground">求职学习工作台</div>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-5">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="mb-1.5 px-3 text-[11px] font-medium tracking-widest text-muted-foreground/70">{g.label}</div>
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    type="button"
                    data-testid={`nav-${item.path}`}
                    onClick={() => go(item.path)}
                    className={cn(
                      'group flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="flex-1 text-left">{item.title}</span>
                    {item.path === '/review' && counts.pending > 0 && (
                      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] leading-none font-medium text-warning">
                        {counts.pending}
                      </span>
                    )}
                    <span className="text-[10px] tracking-wider text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60">
                      ⌘{shortcuts[item.path]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-border/60 pt-3">
        <button
          type="button"
          data-testid="nav-/settings"
          onClick={() => go('/settings')}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            pathname === '/settings'
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <SettingsIcon className="size-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1 text-left">设置</span>
          <span className="text-[10px] tracking-wider text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/60">
            ⌘,
          </span>
        </button>
      </div>
    </aside>
  );
}
