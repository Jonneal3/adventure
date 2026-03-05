'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useFormTheme } from '../../../demo/FormThemeProvider';
import { cn } from '@/lib/utils';

export type SelectorType = 'style' | 'color' | 'slider' | 'toggle' | 'choice';

export interface SelectorConfig {
  id: string;
  type: SelectorType;
  label: string;
  description?: string;
  // For choice/style selectors
  options?: Array<{ label: string; value: string; icon?: string; imageUrl?: string }>;
  // For slider selectors
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  // For toggle selectors
  trueLabel?: string;
  falseLabel?: string;
  // Current value
  value?: any;
  // Default value
  defaultValue?: any;
}

interface ImageSelectorsProps {
  selectors: SelectorConfig[];
  onChange: (selectorId: string, value: any) => void;
  onRegenerate?: () => void;
  debounceMs?: number;
  className?: string;
}

export function ImageSelectors({
  selectors,
  onChange,
  onRegenerate,
  debounceMs = 500,
  className,
}: ImageSelectorsProps) {
  const { theme } = useFormTheme();
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [regenerateTimer, setRegenerateTimer] = useState<NodeJS.Timeout | null>(null);

  // Initialize local values from selectors
  useEffect(() => {
    const initial: Record<string, any> = {};
    for (const selector of selectors) {
      initial[selector.id] = selector.value ?? selector.defaultValue ?? 
        (selector.type === 'slider' ? (selector.min || 0) : 
         selector.type === 'toggle' ? false : 
         selector.type === 'choice' ? (selector.options?.[0]?.value || '') : '');
    }
    setLocalValues(initial);
  }, [selectors]);

  const handleChange = useCallback((selectorId: string, value: any) => {
    setLocalValues((prev) => ({ ...prev, [selectorId]: value }));
    onChange(selectorId, value);

    // Debounce regeneration
    if (onRegenerate) {
      if (regenerateTimer) {
        clearTimeout(regenerateTimer);
      }
      const timer = setTimeout(() => {
        onRegenerate();
      }, debounceMs);
      setRegenerateTimer(timer);
    }
  }, [onChange, onRegenerate, debounceMs, regenerateTimer]);

  useEffect(() => {
    return () => {
      if (regenerateTimer) {
        clearTimeout(regenerateTimer);
      }
    };
  }, [regenerateTimer]);

  return (
    <div className={cn("space-y-4 sm:space-y-6", className)}>
      {selectors.map((selector) => (
        <div key={selector.id} className="space-y-2">
          <div>
            <label
              className="text-[13px] sm:text-sm font-medium block mb-1"
              style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
            >
              {selector.label}
            </label>
            {selector.description && (
              <p
                className="text-xs opacity-70"
                style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
              >
                {selector.description}
              </p>
            )}
          </div>

          {selector.type === 'choice' || selector.type === 'style' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {selector.options?.map((option) => {
                const isSelected = localValues[selector.id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleChange(selector.id, option.value)}
                    className={cn(
                      "p-2.5 sm:p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    )}
                    style={{
                      fontFamily: theme.fontFamily,
                      borderRadius: `${theme.borderRadius}px`,
                    }}
                  >
                    {option.imageUrl && (
                      <img
                        src={option.imageUrl}
                        alt={option.label}
                        className="w-full h-16 sm:h-20 object-cover rounded mb-2"
                      />
                    )}
                    <div className="text-[13px] sm:text-sm font-medium" style={{ color: theme.textColor }}>
                      {option.label}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : selector.type === 'color' ? (
            <div className="flex flex-wrap gap-2">
              {selector.options?.map((option) => {
                const isSelected = localValues[selector.id] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleChange(selector.id, option.value)}
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 transition-all",
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-200 scale-110"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                    style={{
                      backgroundColor: option.value,
                    }}
                    title={option.label}
                  />
                );
              })}
            </div>
          ) : selector.type === 'slider' ? (
            <div className="space-y-2">
              <Slider
                value={[localValues[selector.id] ?? selector.min ?? 0]}
                onValueChange={(values) => handleChange(selector.id, values[0])}
                min={selector.min ?? 0}
                max={selector.max ?? 100}
                step={selector.step ?? 1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{selector.min ?? 0}{selector.unit}</span>
                <span className="font-medium" style={{ color: theme.primaryColor }}>
                  {localValues[selector.id] ?? selector.min ?? 0}{selector.unit}
                </span>
                <span>{selector.max ?? 100}{selector.unit}</span>
              </div>
            </div>
          ) : selector.type === 'toggle' ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleChange(selector.id, false)}
                className={cn(
                  "px-3 py-2 sm:px-4 rounded-lg border transition-all text-[13px] sm:text-sm",
                  localValues[selector.id] === false
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                )}
                style={{
                  fontFamily: theme.fontFamily,
                  borderRadius: `${theme.borderRadius}px`,
                }}
              >
                {selector.falseLabel || 'No'}
              </button>
              <button
                onClick={() => handleChange(selector.id, true)}
                className={cn(
                  "px-3 py-2 sm:px-4 rounded-lg border transition-all text-[13px] sm:text-sm",
                  localValues[selector.id] === true
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                )}
                style={{
                  fontFamily: theme.fontFamily,
                  borderRadius: `${theme.borderRadius}px`,
                }}
              >
                {selector.trueLabel || 'Yes'}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
