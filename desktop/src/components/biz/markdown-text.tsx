// 答案要点/追问的 markdown 渲染面(答案列宽 ≤38rem 保阅读行长,§7.4)。

import { useMemo } from 'react';

import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className={cn(
        'max-w-[38rem] text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_strong]:font-semibold',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** 答案要点列表:每条一个要点,序号 + 内容 */
export function AnswerBlock({ points }: { points: string[] }) {
  if (points.length === 0) return <p className="text-sm text-muted-foreground">暂无答案</p>;
  return (
    <ol className="max-w-[38rem] space-y-3">
      {points.map((p, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
            {i + 1}
          </span>
          <MarkdownText text={p} className="flex-1" />
        </li>
      ))}
    </ol>
  );
}

export function FollowupList({ followups }: { followups: string[] }) {
  if (followups.length === 0) return null;
  return (
    <div className="max-w-[38rem] space-y-1.5 rounded-lg bg-muted/60 p-3">
      <div className="text-xs font-medium text-muted-foreground">常见追问</div>
      {followups.map((f, i) => (
        <MarkdownText key={i} text={f} className="[&_p]:my-0.5" />
      ))}
    </div>
  );
}
