import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// 统一错误态(状态可感知原则):标题 + 原因 + 重试。
// message 保留底层原因原文(排障需要),视觉上弱化为说明文字。
export function ErrorState({
  title = '加载失败',
  message,
  onRetry,
}: {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10" aria-hidden>
          <TriangleAlert className="size-5 text-destructive" />
        </div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {message != null && (
          <p className="max-w-md break-all text-sm text-muted-foreground">{message}</p>
        )}
        {onRetry && (
          <div className="pt-1">
            <Button size="sm" variant="outline" onClick={onRetry}>
              重试
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
