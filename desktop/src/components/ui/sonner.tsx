import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// shadcn 官方 sonner 封装:表面色映射到 popover/border token,
// 随 .dark 类自动跟随主题,不引入 sonner 内置配色。
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
