"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
  colors?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  "#000000", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6", "#FFFFFF",
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E", "#10B981",
  "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1", "#8B5CF6", "#A855F7",
  "#D946EF", "#EC4899", "#F43F5E",
];

export function ColorPicker({
  value,
  onChange,
  colors = DEFAULT_COLORS,
  className,
}: ColorPickerProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  
  return (
    <div className={cn(isCompact ? "space-y-3" : "space-y-4", className)}>
      <div className={cn("grid", isCompact ? "grid-cols-6 gap-1.5 sm:grid-cols-8 sm:gap-2" : "grid-cols-6 gap-2 sm:grid-cols-8")}>
        {colors.map((color) => {
          const isSelected = value === color;
          return (
            <motion.button
              key={color}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onChange(color)}
              className={cn(
                "aspect-square rounded-md border-2 transition-all relative",
                isSelected ? "border-primary ring-2 ring-primary ring-offset-2" : "border-muted-foreground/20"
              )}
              style={{ backgroundColor: color, borderRadius: `${theme.borderRadius}px` }}
              aria-label={`Select color ${color}`}
            >
              {isSelected && (
                <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-lg" />
              )}
            </motion.button>
          );
        })}
      </div>
      {value && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Selected: <span className="font-mono font-bold" style={{ color: theme.primaryColor }}>{value}</span>
        </div>
      )}
    </div>
  );
}
