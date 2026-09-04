import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// 共享小节标题(2026-09-04 收敛总览与 /add 的两套实现,诊断 #13):
// 图标章 + 标题 + 延伸 hairline,可选右槽与说明行。
export function SectionHead({
  icon: Icon,
  title,
  description,
  right,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-6 flex-none items-center justify-center rounded-md bg-primary/10 text-primary"
          aria-hidden
        >
          <Icon className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="h-px flex-1 bg-border/70" aria-hidden />
        {right}
      </div>
      {description != null && (
        <p className="mt-1 pl-8.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
