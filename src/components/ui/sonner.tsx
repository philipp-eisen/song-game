import { useTheme } from "next-themes"
import { Toaster as Sonner  } from "sonner"
import { CheckCircleIcon, InfoIcon, SpinnerIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react"
import type {ToasterProps} from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon weight="duotone" className="size-4" />
        ),
        info: (
          <InfoIcon weight="duotone" className="size-4" />
        ),
        warning: (
          <WarningIcon weight="duotone" className="size-4" />
        ),
        error: (
          <XCircleIcon weight="duotone" className="size-4" />
        ),
        loading: (
          <SpinnerIcon weight="duotone" className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
