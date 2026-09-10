// 底部状态栏:五档关键计数(可点击直达)+ 连续天数 | 右侧:官方库同步状态 + 主题切换。
// 计数调用 deriveStatus 唯一口径(hooks.useStatusCounts)。

import { useLocation, useNavigate } from 'react-router';
import { FlameIcon, MoonIcon, SunIcon } from 'lucide-react';
import { toast } from 'sonner';

import { requestNavigation } from '@/lib/guard';
import { useActivityList, useStatusCounts, useThemeValue } from '@/lib/hooks';
import { currentStreak } from '@/lib/activity';
import { lastSyncAt } from '@/lib/sync';
import { setTheme } from '@/lib/theme';
import { cn, formatDateTime } from '@/lib/utils';

export function StatusBar() {
  const counts = useStatusCounts();
  const activity = useActivityList();
  const theme = useThemeValue();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const streakN = currentStreak(activity, Date.now());
  const sync = lastSyncAt();

  const go = (path: string) => requestNavigation(() => navigate(path));

  return (
    <footer data-chrome className="flex h-8 shrink-0 items-center gap-4 bg-card/50 px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <StatusChip label="待学习" n={counts.new} active={pathname === '/library'} onClick={() => go('/library?status=new')} />
        <StatusChip label="待复习" n={counts.due} active={false} onClick={() => go('/library?status=due')} />
        <StatusChip label="待审核" n={counts.pending} active={pathname === '/review'} onClick={() => go('/review')} />
      </div>
      <span className={cn('flex items-center gap-1', streakN > 0 && 'text-success')}>
        <FlameIcon className="size-3.5" strokeWidth={1.75} />
        连续 {streakN} 天
      </span>

      <div className="flex-1" />

      <button
        type="button"
        className="cursor-pointer transition-colors duration-150 hover:text-foreground"
        onClick={() =>
          toast.info(sync ? `官方库上次同步:${formatDateTime(sync)}` : '官方库尚未同步', {
            description: '可在设置页手动同步',
          })
        }
      >
        {sync ? `已同步 ${formatDateTime(sync)}` : '官方库未同步'}
      </button>
      <button
        type="button"
        aria-label={theme === 'dark' ? '切换为暖纸' : '切换为夜读'}
        className="cursor-pointer rounded-sm p-1 transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <SunIcon className="size-3.5" strokeWidth={1.75} /> : <MoonIcon className="size-3.5" strokeWidth={1.75} />}
      </button>
    </footer>
  );
}

function StatusChip({ label, n, active, onClick }: { label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 transition-colors duration-150 hover:text-foreground',
        active && 'text-primary',
        n === 0 && 'opacity-55',
      )}
    >
      <span>{label}</span>
      <span className="font-medium tabular-nums">{n}</span>
    </button>
  );
}
