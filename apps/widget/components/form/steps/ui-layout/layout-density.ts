"use client";

import * as React from "react";

export type LayoutDensity = "comfortable" | "compact";

export function useLayoutDensity(): LayoutDensity {
  const [density, setDensity] = React.useState<LayoutDensity>("comfortable");

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateDensity = () => {
      setDensity(mediaQuery.matches ? "compact" : "comfortable");
    };

    updateDensity();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDensity);
      return () => mediaQuery.removeEventListener("change", updateDensity);
    }

    // Safari < 14 fallback.
    // eslint-disable-next-line deprecation/deprecation
    mediaQuery.addListener(updateDensity);
    // eslint-disable-next-line deprecation/deprecation
    return () => mediaQuery.removeListener(updateDensity);
  }, []);

  return density;
}
