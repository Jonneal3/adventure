"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Size = { width: number; height: number };

function closestAspectString(width: number, height: number): string {
  const ratio = width / Math.max(1, height);
  const candidates: Record<string, number> = {
    "1:1": 1,
    "16:9": 16 / 9,
    "4:3": 4 / 3,
    "3:2": 3 / 2,
    "21:9": 21 / 9,
    "5:4": 5 / 4,
    "4:5": 4 / 5,
    "3:4": 3 / 4,
    "2:3": 2 / 3,
    "9:16": 9 / 16,
    "9:21": 9 / 21,
  };

  let best = "1:1";
  let minDiff = Math.abs(ratio - 1);

  for (const [key, value] of Object.entries(candidates)) {
    const diff = Math.abs(ratio - value);
    if (diff < minDiff) {
      minDiff = diff;
      best = key;
    }
  }

  return best;
}

interface GalleryViewportProps {
  className?: string;
  style?: React.CSSProperties;
  onMeasuredAspectChange?: (aspect: string) => void;
  children: (size: Size) => React.ReactNode;
}

export function GalleryViewport({
  className,
  style,
  onMeasuredAspectChange,
  children,
}: GalleryViewportProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState<Size>({ width: 0, height: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = { width: el.clientWidth, height: el.clientHeight };
      setSize(next);
      if (onMeasuredAspectChange && next.width > 0 && next.height > 0) {
        onMeasuredAspectChange(closestAspectString(next.width, next.height));
      }
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", update);
    };
  }, [onMeasuredAspectChange]);

  return (
    <div ref={ref} className={cn("h-full w-full", className)} style={style}>
      {children(size)}
    </div>
  );
}

