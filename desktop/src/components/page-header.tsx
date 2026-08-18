import type { ReactNode } from 'react';

// 统一页面头:标题 + 可选副标题。全站页面的第一块,替代散落的 h1 写法
// (含此前各页不一致的"●"装饰前缀——已废弃)。
export function PageHeader({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle != null && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
