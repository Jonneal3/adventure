"use client";

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StyleOption {
  value: string;
  label: string;
  image?: string;
  description?: string;
}

interface StyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  options: StyleOption[];
  displayMode?: 'grid' | 'list' | 'cards';
  showImages?: boolean;
}

export function StyleSelector({
  value,
  onChange,
  label,
  options,
  displayMode = 'list',
  showImages = false,
}: StyleSelectorProps) {
  if (displayMode === 'grid' || displayMode === 'cards') {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <div className="grid grid-cols-2 gap-3">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`p-3 border-2 rounded-lg text-left transition-all ${
                value === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {showImages && option.image && (
                <img
                  src={option.image}
                  alt={option.label}
                  className="w-full h-24 object-cover rounded mb-2"
                />
              )}
              <div className="font-medium">{option.label}</div>
              {option.description && (
                <div className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <RadioGroup value={value} onValueChange={onChange}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={option.value} />
            <Label htmlFor={option.value} className="cursor-pointer">
              {option.label}
              {option.description && (
                <span className="text-xs text-muted-foreground ml-2">
                  {option.description}
                </span>
              )}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
