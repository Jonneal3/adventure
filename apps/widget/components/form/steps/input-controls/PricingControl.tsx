"use client";

// Pricing Control - Pure UI for showing pricing breakdown
import React from 'react';
import { useFormTheme } from '../../demo/FormThemeProvider';
import { formatCurrency } from '@/lib/ai-form/utils/currency';
import { useLayoutDensity } from "../ui-layout/layout-density";
import { cn } from "@/lib/utils";

interface PricingProps {
  pricing?: any;
  className?: string;
}

export function Pricing({ pricing, className }: PricingProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  if (!pricing) return null;

  return (
    <div className={className}>
      <div
        className={cn(
          "space-y-4 bg-muted/10 rounded-2xl border-2 border-dashed border-muted",
          isCompact ? "p-4" : "p-6"
        )}
      >
        {pricing.items?.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="font-medium text-muted-foreground">{item.label}</span>
            <span className="font-bold">{formatCurrency(item.amount, pricing.currency)}</span>
          </div>
        ))}
        <div className={cn("border-t-2 border-muted flex justify-between items-center", isCompact ? "pt-3" : "pt-4")}>
          <span className="text-lg font-black uppercase tracking-wider">Estimated Total</span>
          <span className={cn(isCompact ? "text-xl" : "text-2xl", "font-black")} style={{ color: theme.primaryColor }}>
            {formatCurrency(pricing.total, pricing.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
