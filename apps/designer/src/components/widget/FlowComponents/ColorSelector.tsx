"use client";

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  showAlpha?: boolean;
  presetColors?: string[];
}

export function ColorSelector({ 
  value, 
  onChange, 
  label,
  showAlpha = false,
  presetColors = []
}: ColorSelectorProps) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      
      <div className="flex gap-2">
        <Input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 cursor-pointer"
        />
        <Input
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1"
        />
      </div>

      {presetColors.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {presetColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className="w-8 h-8 rounded border-2 border-border hover:border-primary transition-colors"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
