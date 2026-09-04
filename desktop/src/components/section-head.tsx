import type { ReactNode } from 'react';

// 共享小节标题 v2「纸面编辑部」:序号(可选)+ 标题 + 延伸 hairline。
// 去图标化:印刷排版的分节语言,靠留白与细线,不靠图形装饰。
export function SectionHead({
  index,
  title,
  description,
  right,
}: {
  index?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        {index != null && (
          <span className="font-mono text-xs tabular-nums text-primary" aria-hidden>
            {index}
          </span>
        )}
        <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
        {right}
      </div>
      {description != null && (
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
