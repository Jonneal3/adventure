"use client";

// Segmented Choice Control - Single select
import React from "react";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { cn } from "@/lib/utils";
import { useLayoutDensity } from "../ui-layout/layout-density";

function hexToRgba(hex: string, alpha: number): string | null {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function withAlpha(color: string | undefined, alpha: number): string {
  const c = String(color || "").trim();
  const a = Math.max(0, Math.min(1, alpha));
  if (!c) return `rgba(15, 23, 42, ${a})`;
  const rgba = c.startsWith("#") ? hexToRgba(c, a) : null;
  if (rgba) return rgba;
  const pct = Math.round(a * 100);
  return `color-mix(in srgb, ${c} ${pct}%, transparent)`;
}

interface SegmentedChoiceProps {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value?: string; description?: string; icon?: string }>;
  className?: string;
}

export function SegmentedChoice({ value, onChange, options, className }: SegmentedChoiceProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const primary = theme.primaryColor || "var(--form-primary-color)";
  const secondary = theme.secondaryColor || theme.primaryColor || "var(--form-secondary-color)";
  const unpickedBg = withAlpha(secondary, 0.12);
  const unpickedHoverBg = withAlpha(secondary, 0.18);
  const unpickedBorder = withAlpha(primary, 0.26);

  return (
    <div className={cn("grid", isCompact ? "gap-2" : "gap-3", className)}>
      {options.map((opt) => {
        const key = opt.value || opt.label;
        const picked = value === key;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              "relative w-full text-left rounded-xl transition-all duration-200 border shadow-sm hover:shadow",
              isCompact ? "p-3" : "p-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              picked
                ? "bg-primary text-white"
                : "text-[color:var(--form-text-color)]"
            )}
            style={{
              fontFamily: theme.fontFamily,
              borderRadius: `${theme.borderRadius}px`,
              backgroundColor: picked ? primary : unpickedBg,
              color: picked ? "#ffffff" : (theme.textColor || "var(--form-text-color)"),
              borderColor: picked ? primary : unpickedBorder,
            }}
            onMouseEnter={(e) => {
              if (picked) return;
              try {
                (e.currentTarget as any).style.backgroundColor = unpickedHoverBg;
              } catch {}
            }}
            onMouseLeave={(e) => {
              if (picked) return;
              try {
                (e.currentTarget as any).style.backgroundColor = unpickedBg;
              } catch {}
            }}
          >
            <div className={cn("font-medium", isCompact ? "text-[13px] sm:text-sm" : null)}>
              {opt.label}
            </div>
            {opt.description && (
              <div className={cn("mt-1 opacity-80", isCompact ? "text-[11px]" : "text-xs")}>
                {opt.description}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
