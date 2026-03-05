"use client";

// Yes/No Control - Binary choice
import React, { useEffect, useState } from "react";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { cn } from "@/lib/utils";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface YesNoProps {
  value?: "yes" | "no";
  onChange: (value: "yes" | "no") => void;
  yesLabel?: string;
  noLabel?: string;
  className?: string;
}

export function YesNo({ value, onChange, yesLabel = "Yes", noLabel = "No", className }: YesNoProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";

  return (
    <div className={className}>
      <div className={cn("grid grid-cols-2", isCompact ? "gap-2" : "gap-3")}>
        {(["yes", "no"] as const).map((v) => {
          const picked = value === v;
          const label = v === "yes" ? yesLabel : noLabel;
          return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "relative w-full text-center rounded-lg transition-all duration-200 font-medium",
              isCompact ? "p-2 text-sm" : "p-3",
              picked
                ? "bg-primary text-white"
                : "bg-white border border-gray-200 hover:border-primary/50 hover:bg-gray-50"
            )}
            style={{
              fontFamily: theme.fontFamily,
              borderRadius: `${theme.borderRadius}px`,
              backgroundColor: picked ? theme.primaryColor : undefined,
              color: picked ? '#ffffff' : theme.textColor,
              borderColor: picked ? theme.primaryColor : undefined,
            }}
          >
            {label}
          </button>
          );
        })}
      </div>
    </div>
  );
}
