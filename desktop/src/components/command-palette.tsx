import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText, Inbox, LayoutDashboard, LibraryBig, Plus, Settings, Target, BookOpen,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import { getStats } from '@/lib/schedule';
import { getPendingCount } from '@/lib/mylib';
import { loadProgress } from '@/lib/storage';
import {
  CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';

// ⌘K 命令面板(桌面标配):题目直搜 + 分区直达 + 高频动作。Cmd/Ctrl+K 开关在 app-shell。
// v5 深化:输入即搜全库题干/考察点/标签,选中直接定位到题库详情面板。
// v10:开始复习/学习带上目标分类(此前算了 dueCat/newCat 却只当布尔用,丢了 ?category=);
// 所有跳转经 shell 的 guardedNavigate,简历未保存时先确认再走。

interface PaletteEntry {
  label: string;
  icon: typeof LayoutDashboard;
  to: string;
  shortcut?: string;
}

export function CommandPalette({ open, onOpenChange, onNavigate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 守卫式导航(未保存修改先确认);不传则直接 navigate */
  onNavigate?: (to: string) => void;
}) {
  const navigate = useNavigate();
  const { data } = useQuestions();
  const pendingCount = getPendingCount();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const questionMatches =
    q.length >= 1
      ? (data?.questions ?? [])
          .filter(
            (x) =>
              x.title.toLowerCase().includes(q) ||
              x.focus.toLowerCase().includes(q) ||
              x.tags.some((t) => t.toLowerCase().includes(q)),
          )
          .slice(0, 8)
      : [];

  const go = (to: string) => {
    onOpenChange(false);
    setQuery('');
    (onNavigate ?? navigate)(to);
  };

  const navEntries: PaletteEntry[] = [
    { label: '今日', icon: LayoutDashboard, to: '/', shortcut: '⌘1' },
    { label: '练习(全库混排)', icon: BookOpen, to: '/session', shortcut: '⌘2' },
    { label: '题库', icon: LibraryBig, to: '/library', shortcut: '⌘3' },
    { label: pendingCount > 0 ? `审核(${pendingCount} 题待审核)` : '审核', icon: Inbox, to: '/library?tab=review', shortcut: '⌘4' },
    { label: 'JD 管理', icon: Target, to: '/profile', shortcut: '⌘5' },
    { label: '简历管理', icon: FileText, to: '/profile?tab=resume', shortcut: '⌘6' },
    { label: '设置', icon: Settings, to: '/settings', shortcut: '⌘7' },
  ];

  // 高频动作:挑最近学过、且有存量的分类作为复习/学习目标(带 ?category= 直达该分类的队列)
  const cats = data?.categories ?? [];
  const statsOf = (slug: string) =>
    getStats(slug, data?.questions.filter((x) => x.category === slug).map((x) => x.id) ?? []);
  const lastActiveOf = (slug: string) =>
    Math.max(0, ...Object.values(loadProgress(slug)).map((c) => c.lastReview ?? 0));
  const dueCat = cats
    .filter((c) => statsOf(c.slug).dueToday > 0)
    .sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];
  const newCat = cats
    .filter((c) => statsOf(c.slug).remaining > 0)
    .sort((a, b) => lastActiveOf(b.slug) - lastActiveOf(a.slug))[0];

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldFilter={false}
      onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
    >
      <CommandInput placeholder="搜题干 / 考察点 / 标签,前往页面或执行动作…" />
      <CommandList>

        {q.length >= 1 && questionMatches.length === 0 && (
          <CommandGroup heading="题目">
            <CommandItem disabled>没有匹配的题目</CommandItem>
          </CommandGroup>
        )}
        {questionMatches.length > 0 && (
          <CommandGroup heading={`题目(${questionMatches.length})`}>
            {questionMatches.map((m) => (
              <CommandItem
                key={m.id}
                value={`题目 ${m.title} ${m.focus} ${m.tags.join(' ')}`}
                onSelect={() => go(`/library?category=${m.category}&qid=${encodeURIComponent(m.id)}`)}
              >
                <BookOpen className="text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {m.category} · {m.difficulty}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="动作">
          {dueCat && (
            <CommandItem onSelect={() => go(`/session?focus=due&category=${dueCat.slug}`)}>
              <BookOpen className="text-muted-foreground" aria-hidden />
              开始复习 {dueCat.slug === 'my' ? '(我的题库)' : dueCat.name}
            </CommandItem>
          )}
          {newCat && (
            <CommandItem onSelect={() => go(`/session?focus=new&category=${newCat.slug}`)}>
              <BookOpen className="text-muted-foreground" aria-hidden />
              开始学习 {newCat.slug === 'my' ? '(我的题库)' : newCat.name}
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
