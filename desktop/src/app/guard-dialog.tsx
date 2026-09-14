// GuardDialog:守卫拦截到导航请求时弹确认(§6.2)。
// Esc = 取消(继续编辑)且初始焦点在取消钮(D20),由 AlertDialog 默认行为保证。

import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { discardChanges, getDirtyGuard, subscribeGuard, takePendingNavigation } from '@/lib/guard';

export function GuardDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeGuard(() => setOpen(!!getDirtyGuard()));
  }, []);

  const discard = () => {
    const perform = takePendingNavigation();
    discardChanges();
    setOpen(false);
    perform?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>有未保存的更改</AlertDialogTitle>
          <AlertDialogDescription>离开当前页面,未保存的修改会丢失。确定放弃并离开吗?</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              discard();
            }}
          >
            放弃更改
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
