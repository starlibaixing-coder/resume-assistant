import { type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 双栏工作台脚手架(v11 全窗化):父级须为 h-full flex-col。
//   ≥lg:左列列表(内部滚动)+ 右侧详情列(内部滚动),一切查看/编辑/动作在详情列就地完成;
//   <lg:详情以全屏覆盖层呈现(带"返回列表")。
// 题库浏览与审核共用同一语法。

export function TwoPane({ list, detail, mobileOpen, onCloseMobile, listTestId }: {
  list: ReactNode;
  detail: ReactNode;
  /** <lg 覆盖层是否展开(行选中时置 true) */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  listTestId?: string;
}) {
  return (
    <>
      <div className="flex min-h-0 flex-1 gap-4 px-5 pb-5">
        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-card"
          data-workbench-list={listTestId}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </div>
        <div
          className="hidden w-96 shrink-0 overflow-y-auto lg:block"
          data-workbench-detail
        >
          {detail}
        </div>
      </div>

      {/* <lg:详情覆盖层(带返回列表出口) */}
      <div
        className={cn('fixed inset-0 z-40 flex flex-col bg-background lg:hidden', mobileOpen ? 'block' : 'hidden')}
        role="dialog"
        aria-modal="true"
        aria-label="题目详情"
      >
        <div className="flex h-12 shrink-0 items-center px-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onCloseMobile}>
            <ArrowLeft className="size-4" aria-hidden />
            返回列表
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          {detail}
        </div>
      </div>
    </>
  );
}
