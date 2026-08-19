import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

// shadcn 官方 Tooltip(Radix 行为 + token 样式),供行内 icon 按钮的 hover 说明用。
const TooltipProvider = TooltipPrimitive.Provider

// 自带 Provider(delay 0):调用方直接 <Tooltip> 即用,不必逐处包 Provider
const Tooltip = ({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) => (
  <TooltipProvider delayDuration={0}>
    <TooltipPrimitive.Root {...props} />
  </TooltipProvider>
)

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-fit rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipProvider, TooltipContent }
