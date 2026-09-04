import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

// 统一页面头 v2「纸面编辑部」:超大标题(印刷刊物式)+ 可选导语 + 右侧 actions 槽 +
// 可选 back 槽。全站页面第一块:5 秒内知道"这是哪、能干什么、主操作在哪"。
interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {back && (
        <Link
          to={back.to}
          title={back.label}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {description != null && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions != null && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
      </div>
    </div>
  );
}
