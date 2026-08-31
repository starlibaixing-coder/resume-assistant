import { cn } from "@/lib/utils"

// shadcn 官方 Skeleton 源码(纯 div + animate-pulse,零依赖)

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
