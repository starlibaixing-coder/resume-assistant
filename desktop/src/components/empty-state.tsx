import type { ComponentType, ReactNode } from 'react';

// 统一空态 v2「纸面编辑部」:虚线细线框 + 图标 + 标题 + 一句解释 + 动作。
// 动作 = 该语境下的最高频下一步;没有自然动作时可省略。
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border px-6 py-16 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted" aria-hidden>
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {description != null && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action != null && <div className="pt-1">{action}</div>}
    </div>
  );
}
