import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor },
];

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };

// 侧栏底部的主题控件:
// - 宽侧栏:三段式(Sun/Moon/Monitor),当前项高亮
// - 图标栏(<lg):单按钮循环切换,图标 = 当前主题
export function ThemeControl() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* 宽侧栏:分段选择 */}
      <div className="hidden items-center justify-between lg:flex">
        <span className="px-2.5 text-[11px] font-mono text-muted-foreground/60">主题</span>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              title={o.label}
              onClick={() => setTheme(o.value)}
              className={`flex h-6 w-6 items-center justify-center rounded-sm cursor-pointer transition-colors ${
                theme === o.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground/70 hover:text-foreground'
              }`}
            >
              <o.icon className="h-3.5 w-3.5" />
              <span className="sr-only">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 图标栏:循环切换 */}
      <div className="flex justify-center lg:hidden">
        <button
          title={`主题:${OPTIONS.find((o) => o.value === theme)?.label ?? theme}(点击切换)`}
          onClick={() => setTheme(NEXT[theme])}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground cursor-pointer transition-colors hover:bg-accent hover:text-foreground"
        >
          {(() => {
            const Icon = OPTIONS.find((o) => o.value === theme)?.icon ?? Sun;
            return <Icon className="h-4 w-4" />;
          })()}
          <span className="sr-only">切换主题</span>
        </button>
      </div>
    </>
  );
}
