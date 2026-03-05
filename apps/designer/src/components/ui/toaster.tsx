"use client"

import { useToast } from "@/hooks"
import { Copy } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "./toast"

export function Toaster() {
  const { toasts } = useToast()

  const copyToClipboard = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).catch(console.error)
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const copyText = [title, description]
          .flatMap((v) => (typeof v === "string" || typeof v === "number" ? [String(v)] : []))
          .join("\n\n")
          .trim()

        const showCopy = variant === "destructive" && Boolean(copyText)
        return (
          <Toast key={id} {...props} variant={variant}>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              {title && <ToastTitle className="truncate">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="break-words">{description}</ToastDescription>
              )}
            </div>

            <div className="flex shrink-0 items-start gap-1">
              {showCopy ? (
                <ToastAction
                  altText="Copy error message"
                  onClick={() => copyToClipboard(copyText)}
                  className="h-7 w-7 rounded-md p-0"
                  title="Copy error"
                >
                  <Copy className="h-3.5 w-3.5" />
                </ToastAction>
              ) : null}
              {action}
              <ToastClose />
            </div>
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
