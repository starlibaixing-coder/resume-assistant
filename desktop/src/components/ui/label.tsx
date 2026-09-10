// shadcn/ui Label(官方源码;表单 Label + 必填星号由业务层追加)
import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex select-none items-center gap-1.5 text-sm font-medium leading-none',
        'group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
