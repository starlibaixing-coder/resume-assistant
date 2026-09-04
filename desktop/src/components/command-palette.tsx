import { useNavigate } from 'react-router';
import {
  FileText, LayoutDashboard, LibraryBig, Plus, Settings, Target, BookOpen,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getPendingCount } from '@/lib/mylib';
import { loadProgress } from '@/lib/storage';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

// ⌘K 命令面板(桌面标配):分区直达 + 高频动作。Cmd/Ctrl+K 开关在 app-shell。

interface PaletteEntry {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  shortcut?: string;
}

export function CommandPalette({ open, onOpenChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { data } = useQuestions();
  const pendingCount = getPendingCount();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const navEntries: PaletteEntry[] = [
    { label: '今日', icon: LayoutDashboard, to: '/', shortcut: '⌘1' },
    { label: '练习(全库混排)', icon: BookOpen, to: '/session', shortcut: '⌘2' },
    { label: pendingCount > 0 ? `题库(${pendingCount} 题待审核)` : '题库', icon: LibraryBig, to: '/library', shortcut: '⌘3' },
    { label: 'JD 管理', icon: Target, to: '/profile', shortcut: '⌘4' },
    { label: '简历管理', icon: FileText, to: '/profile?tab=resume', shortcut: '⌘5' },
    { label: '设置', icon: Settings, to: '/settings', shortcut: '⌘6' },
  ];

  // 高频动作:挑最近学过的分类作为复习/学习目标(与总览快捷行动同逻辑)
  const cats = data?.categories ?? [];
  const lastActiveOf = (slug: string) =>
    Math.max(0, ...Object.values(loadProgress(slug)).map((c) => c.lastReview ?? 0));
  const dueCat = cats
    .filter((c) => getStats(c.slug, data?.questions.filter((q) => q.category === c.slug).map((q) => q.id) ?? []).dueToday > 0)
    .sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];
  const newCat = cats
    .filter((c) => getStats(c.slug, data?.questions.filter((q) => q.category === c.slug).map((q) => q.id) ?? []).remaining > 0)
    .sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="前往页面或执行动作…" />
      <CommandList>
        <CommandEmpty>没有匹配的条目</CommandEmpty>
        <CommandGroup heading="动作">
          {dueCat && (
            <CommandItem onSelect={() => go('/session?focus=due')}>
              <BookOpen className="text-muted-foreground" aria-hidden />
              开始复习
            </CommandItem>
          )}
          {newCat && (
            <CommandItem onSelect={() => go('/session?focus=new')}>
              <BookOpen className="text-muted-foreground" aria-hidden />
              开始学习
            </CommandItem>
          )}
          <CommandItem onSelect={() => go('/add')}>
            <Plus className="text-muted-foreground" aria-hidden />
            添加题目
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="前往">
          {navEntries.map((e) => (
            <CommandItem key={e.to + e.label} onSelect={() => go(e.to)}>
              <e.icon className="text-muted-foreground" aria-hidden />
              {e.label}
              {e.shortcut && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">{e.shortcut}</span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
