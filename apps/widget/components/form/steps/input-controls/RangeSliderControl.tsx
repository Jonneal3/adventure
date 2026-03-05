"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface RangeSliderProps {
  value?: [number, number];
  onChange: (range: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  formatValue,
  className,
}: RangeSliderProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const range = value || [min, max];
  const format = formatValue || ((v: number) => `${v}${unit ? ` ${unit}` : ""}`);

  return (
    <div className={cn(isCompact ? "space-y-3" : "space-y-6", className)}>
      <div className={cn(isCompact ? "space-y-2" : "space-y-3")}>
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-muted-foreground">Min: {format(range[0])}</span>
          <span className="text-muted-foreground">Max: {format(range[1])}</span>
        </div>
        <Slider
          value={range}
          onValueChange={(v) => onChange(v as [number, number])}
          min={min}
          max={max}
          step={step}
          className="w-full"
        />
      </div>
      <div className={cn("flex items-center justify-between border-t border-muted/20", isCompact ? "pt-2" : "pt-4")}>
        <div className="text-center">
          <div className={cn(isCompact ? "text-lg" : "text-2xl", "font-bold")} style={{ color: theme.primaryColor }}>
            {format(range[0])}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Minimum</div>
        </div>
        <div className="text-center">
          <div className={cn(isCompact ? "text-lg" : "text-2xl", "font-bold")} style={{ color: theme.primaryColor }}>
            {format(range[1])}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Maximum</div>
        </div>
      </div>
    </div>
  );
}
