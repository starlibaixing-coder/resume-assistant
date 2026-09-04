import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

// 统一页面头(2026-09-04 UI 重构):标题 + 可选说明 + 右侧 actions 槽 +
// 可选 back 槽(深链语境页用,如 /add;下钻子页的返回条在壳层统一渲染)。
// 全站页面第一块:用户 5 秒内知道"这是哪、能干什么、主操作在哪"。
interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      {back && (
        <Link
          to={back.to}
          title={back.label}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description != null && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
