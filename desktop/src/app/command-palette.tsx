// ⌘K 命令面板(§6.2):动作(storage 计数)/ 前往(路由表)/ 题目(全库模糊)。
// 「开始复习 / 开始学习 N 题」与今日页按钮同名同义(§4.2)。

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { startSession } from '@/lib/session';
import { useOfficialQuestions, useMyQuestions, useStatusCounts, useJdList } from '@/lib/hooks';
import { getMeta, getReviewStates } from '@/lib/storage';
import { ROUTES } from '@/lib/hotkeys';
import type { Question } from '@/lib/types';

export function CommandPalette({
  open,
  onOpenChange,
  navigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (to: string) => void;
}) {
  const [query, setQuery] = useState('');
  const counts = useStatusCounts();
  const official = useOfficialQuestions();
  const my = useMyQuestions();
  const jds = useJdList();
  const routerNavigate = useNavigate();
  const go = navigate ?? routerNavigate;

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const startReview = useCallback(() => {
    startSession({ type: 'review', questions: allApproved(official, my), cards: getReviewStates(), batchSize: 'all' });
    onOpenChange(false);
    go('/session');
  }, [official, my, go, onOpenChange]);

  const batchMeta = getMeta('batch_size');
  const batch = (batchMeta === '20' || batchMeta === '50' || batchMeta === 'all' ? batchMeta : '50') as '20' | '50' | 'all';
  const batchN = batch === 'all' ? counts.new : Math.min(counts.new, Number(batch));

  const startStudy = useCallback(() => {
    startSession({ type: 'study', questions: allApproved(official, my), cards: getReviewStates(), batchSize: batch === 'all' ? 'all' : Number(batch) });
    onOpenChange(false);
    go('/session');
  }, [official, my, batch, go, onOpenChange]);

  const startAgain = useCallback(() => {
    startSession({ type: 'again', questions: allApproved(official, my), cards: getReviewStates(), batchSize: 'all' });
    onOpenChange(false);
    go('/session');
  }, [official, my, go, onOpenChange]);

  const all = useMemo<Question[]>(() => [...official, ...my], [official, my]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput value={query} onValueChange={setQuery} placeholder="搜索动作或题目…" />
      <CommandList>
        <CommandEmpty>没有匹配的结果</CommandEmpty>
        <CommandGroup heading="动作">
          <CommandItem value="开始复习" onSelect={startReview}>
            开始复习<CommandShortcut>到期 {counts.due} 题</CommandShortcut>
          </CommandItem>
          {counts.new > 0 && (
            <CommandItem value="开始学习" onSelect={startStudy}>
              开始学习 {batchN} 题<CommandShortcut>待学习 {counts.new}</CommandShortcut>
            </CommandItem>
          )}
          <CommandItem value="再过一遍" onSelect={startAgain}>
            再过一遍<CommandShortcut>全库 {official.length + my.filter((q) => q.status === 'approved').length} 题</CommandShortcut>
          </CommandItem>
          {counts.pending > 0 && (
            <CommandItem value="去审核" onSelect={() => { onOpenChange(false); go('/review'); }}>
              去审核<CommandShortcut>待审核 {counts.pending}</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="前往">
          {ROUTES.map((r, i) => (
            <CommandItem key={r.path} value={`前往 ${r.title}`} onSelect={() => { onOpenChange(false); go(r.path); }}>
              前往 {r.title}
              <CommandShortcut>⌘{i + 1}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        {jds.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="JD">
              {jds.slice(0, 5).map((j) => (
                <CommandItem key={j.id} value={`按 JD 生成 ${j.title} ${j.company}`} onSelect={() => { onOpenChange(false); go(`/add?jd=${j.id}`); }}>
                  按 JD 生成:{j.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="题目">
          {searchQuestions(all, getReviewStates(), query).map((q) => (
            <CommandItem
              key={q.id}
              value={`题目 ${q.title} ${q.moduleName} ${q.tags.join(' ')}`}
              onSelect={() => {
                onOpenChange(false);
                go(`/library?cat=${q.category}&qid=${encodeURIComponent(q.id)}`);
              }}
            >
              <span className="truncate">{q.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{q.moduleName}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function allApproved(official: Question[], my: Question[]): Question[] {
  return [...official, ...my.filter((q) => q.status === 'approved')];
}

/** cmdk 只过滤 value;题目组手动做包含过滤(题干/focus/模块/标签),限制条数 */
function searchQuestions(list: Question[], cards: Map<string, { dueAt: number }>, query: string): Question[] {
  void cards;
  const kw = query.trim().toLowerCase();
  const pool = kw ? list.filter((q) => `${q.title} ${q.focus} ${q.moduleName} ${q.tags.join(' ')}`.toLowerCase().includes(kw)) : list;
  return pool.slice(0, 8);
}
