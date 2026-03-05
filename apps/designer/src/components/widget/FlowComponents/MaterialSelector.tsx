"use client";

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MaterialOption {
  value: string;
  label: string;
  image?: string;
  category?: string;
}

interface MaterialSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  options: MaterialOption[];
  source?: 'inventory' | 'preset' | 'both';
  category?: string;
}

export function MaterialSelector({
  value,
  onChange,
  label,
  options,
  source = 'preset',
  category,
}: MaterialSelectorProps) {
  // Filter by category if provided
  const filteredOptions = category
    ? options.filter((opt) => opt.category === category)
    : options;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a material..." />
        </SelectTrigger>
        <SelectContent>
          {filteredOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                {option.image && (
                  <img
                    src={option.image}
                    alt={option.label}
                    className="w-6 h-6 object-cover rounded"
                  />
                )}
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
