"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useFormTheme } from "./demo/FormThemeProvider";
import { cn } from "@/lib/utils";

export interface FormLoaderProps {
  /** Primary message shown below the spinner */
  message: string;
  /** Optional secondary line (e.g. rotating status) */
  subMessage?: string;
  /** Layout: centered (full) or pill (compact overlay) */
  variant?: "centered" | "pill";
  /** Spinner size */
  size?: "sm" | "md";
  /** Optional extra content (e.g. countdown badge) */
  children?: React.ReactNode;
  className?: string;
}

export function FormLoader({
  message,
  subMessage,
  variant = "centered",
  size = "md",
  children,
  className,
}: FormLoaderProps) {
  const { theme } = useFormTheme();
  const primaryColor = theme.primaryColor || "#3b82f6";
  const textColor = theme.textColor;

  const iconSize = size === "sm" ? "h-4 w-4" : "h-8 w-8";

  if (variant === "pill") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 shadow-sm ring-1 ring-black/5",
          className
        )}
      >
        <Loader2
          className={cn(iconSize, "animate-spin shrink-0")}
          style={{ color: primaryColor }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="text-xs font-medium truncate"
            style={{ fontFamily: theme.fontFamily, color: textColor || "#111827" }}
          >
            {message}
          </span>
          {subMessage ? (
            <span
              className="text-[10px] opacity-75 truncate"
              style={{ fontFamily: theme.fontFamily, color: textColor }}
            >
              {subMessage}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-10 min-h-[280px]",
        className
      )}
    >
      <Loader2
        className={cn(iconSize, "animate-spin")}
        style={{ color: primaryColor }}
      />
      <div className="text-center space-y-1 max-w-[260px]">
        <p
          className="text-sm font-medium tracking-tight opacity-90"
          style={{ color: textColor }}
        >
          {message}
        </p>
        {subMessage ? (
          <p className="text-xs opacity-60" style={{ color: textColor }}>
            {subMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
