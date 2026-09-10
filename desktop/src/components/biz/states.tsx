// 统一空态 / 错误态 / 页头(全站唯一空态实现,§6.3)。

import type { ReactNode } from 'react';
import { AlertTriangleIcon, RotateCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-14 text-center', className)}>
      {icon && <div className="text-muted-foreground/50">{icon}</div>}
      <div>
        <div className="font-display text-lg text-foreground">{title}</div>
        {description && <div className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <AlertTriangleIcon className="size-8 text-warning" strokeWidth={1.75} />
      <div>
        <div className="font-display text-lg">{title}</div>
        {description && <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</div>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCwIcon /> 重试
        </Button>
      )}
    </div>
  );
}

/** 页头:宋体标题 + 说明 + 右侧动作区(每页统一) */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-lg font-semibold">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
