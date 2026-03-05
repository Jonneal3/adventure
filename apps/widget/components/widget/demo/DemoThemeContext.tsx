"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";

type DemoThemeContextValue = {
  themeKey: string | null;
  setThemeKey: (key: string | null) => void;
};

const DemoThemeContext = createContext<DemoThemeContextValue | undefined>(undefined);

export function DemoThemeProvider({ children, initialThemeKey }: { children: ReactNode; initialThemeKey?: string | null; }) {
  const [themeKey, setThemeKey] = useState<string | null>(initialThemeKey || null);
  const value = useMemo(() => ({ themeKey, setThemeKey }), [themeKey]);
  return <DemoThemeContext.Provider value={value}>{children}</DemoThemeContext.Provider>;
}

export function useDemoTheme() {
  const ctx = useContext(DemoThemeContext);
  if (!ctx) {
    return { themeKey: null, setThemeKey: () => {} };
  }
  return ctx;
}


