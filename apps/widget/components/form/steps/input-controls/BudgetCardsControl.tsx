"use client";

// Budget Cards Control
import React from "react";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface BudgetCardsProps {
  value?: any;
  onChange: (value: any) => void;
  options: Array<{ label: string; min: number; max?: number | null }>;
  className?: string;
}

export function BudgetCards({ value, onChange, options, className }: BudgetCardsProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";

  return (
    <div className={cn("grid grid-cols-1", isCompact ? "gap-2" : "gap-3", className)}>
      {options.map((opt, index) => {
        const picked = value?.label === opt.label;

        return (
          <motion.button
            key={opt.label}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onChange(opt)}
            className={cn(
              "w-full text-left rounded-xl border transition-all flex items-center justify-between",
              isCompact ? "p-4" : "p-6",
              picked ? "border-primary bg-primary/5" : "border-muted/30 hover:bg-muted/5 bg-white"
            )}
            style={{ borderRadius: `${theme.borderRadius}px` }}
          >
            <div>
              <div
                className={cn(isCompact ? "text-lg sm:text-xl" : "text-xl", "font-black")}
                style={{ color: picked ? theme.primaryColor : theme.textColor }}
              >
                {opt.label}
              </div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-bold mt-1">
                {opt.max ? `Up to ${opt.max}` : `${opt.min}+`}
              </div>
            </div>
            {picked && <div className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4", "rounded-full bg-primary")} />}
          </motion.button>
        );
      })}
    </div>
  );
}
