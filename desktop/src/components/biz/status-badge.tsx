// 五档状态药丸(deriveStatus 唯一口径的展示面)。

import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL } from '@/lib/types';
import type { DerivedStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const VARIANTS: Record<DerivedStatus, 'warning' | 'outline' | 'primary' | 'success' | 'secondary'> = {
  pending: 'warning',
  new: 'outline',
  due: 'primary',
  mastered: 'success',
  scheduled: 'secondary',
};

export function StatusBadge({ status, className }: { status: DerivedStatus; className?: string }) {
  return (
    <Badge variant={VARIANTS[status]} className={cn('tabular-nums', className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: '初' | '中' | '高' }) {
  const map = { 初: 'success', 中: 'warning', 高: 'destructive' } as const;
  const label = { 初: '简单', 中: '中等', 高: '困难' } as const;
  return (
    <Badge variant={map[difficulty]}>
      {label[difficulty]}
    </Badge>
  );
}
