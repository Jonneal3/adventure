"use client";

// Chips Multi Control - Compact multi-select
import React from "react";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface ChipsMultiProps {
  value?: string[];
  onChange: (value: string[]) => void;
  options: Array<{ label: string; value?: string }>;
  className?: string;
}

export function ChipsMulti({ value = [], onChange, options, className }: ChipsMultiProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  return (
    <div className={cn("flex flex-wrap", isCompact ? "gap-1.5 sm:gap-2" : "gap-2 sm:gap-2.5", className)}>
      {options.map((opt, index) => {
        const key = opt.value || opt.label;
        const picked = value.includes(key);

        return (
          <motion.button
            key={key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => toggle(key)}
            className={cn(
              "rounded-full border-2 transition-all font-medium leading-tight",
              isCompact
                ? "px-3 py-1.5 text-[11px] min-h-8 sm:px-3.5 sm:py-1.5 sm:text-[12px] sm:min-h-9 md:text-[13px]"
                : "px-4 py-2 text-[13px] min-h-10 sm:px-5 sm:py-3 sm:text-sm sm:min-h-11",
              picked ? "bg-primary text-white border-primary" : "bg-muted/20 border-transparent hover:bg-muted/40"
            )}
            style={{ borderRadius: `${theme.borderRadius}px` }}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}
