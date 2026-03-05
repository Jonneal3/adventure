"use client";

import { useEffect, useRef, useState } from "react";
import { useDemoTheme } from "./DemoThemeContext";
import { DEMO_THEME_PRESETS } from "@/lib/demo-themes";

interface Props {}

const THEME_KEYS = [
  "green","charcoal","pink","amber","cyan","orange","slate","violet","teal","neutral","forest","ocean","rose","sand","lemon","indigo","black","white"
];

export function DemoThemeSwitcher({}: Props) {
  const { themeKey, setThemeKey } = useDemoTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentColor = (() => {
    const key = (themeKey || '').toLowerCase();
    const preset = (DEMO_THEME_PRESETS as any)[key];
    return preset?.primary_color || '#64748b';
  })();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePick = (key: string) => {
    setThemeKey(key);
    setOpen(false);
  };

  return (
    <div ref={rootRef} style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => setOpen(v => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
            backdropFilter: 'blur(6px)'
          }}
        >
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: currentColor,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.25)'
            }}
          />
          <span style={{ fontSize: 12, opacity: 0.9 }}>
            {themeKey ? themeKey : 'Theme'}
          </span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.85 }}>
            <path d="M5 7l5 6 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Select theme"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            background: 'rgba(17,17,17,0.95)',
            color: '#fff',
            padding: 10,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            width: 260,
            boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 8,
            maxHeight: 240,
            overflowY: 'auto'
          }}>
            {THEME_KEYS.map(key => {
              const preset = (DEMO_THEME_PRESETS as any)[key];
              const color = preset?.primary_color || '#94a3b8';
              const isActive = (themeKey || '').toLowerCase() === key;
              return (
                <button
                  key={key}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => handlePick(key)}
                  title={key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: 10,
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: color,
                    boxShadow: isActive ? '0 0 0 3px rgba(255,255,255,0.35)' : '0 0 0 1px rgba(255,255,255,0.2)'
                  }} />
                  <span style={{ fontSize: 11, opacity: 0.9, textTransform: 'capitalize' }}>{key}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


