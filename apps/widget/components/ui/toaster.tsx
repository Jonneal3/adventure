"use client"

import { useToast } from "../../hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastAction,
} from "../ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error)
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} {...props} variant={variant}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {variant === "destructive" && description && (
              <ToastAction 
                altText="Copy error message"
                onClick={() => copyToClipboard(String(description))}
                className="text-xs"
              >
                Copy
              </ToastAction>
            )}
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
