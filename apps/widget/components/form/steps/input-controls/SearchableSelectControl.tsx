"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { useLayoutDensity } from "../ui-layout/layout-density";

export interface SearchableSelectOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

interface SearchableSelectProps {
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  options: SearchableSelectOption[];
  multiple?: boolean;
  searchPlaceholder?: string;
  maxSelections?: number;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options = [],
  multiple = false,
  searchPlaceholder = "Search options...",
  maxSelections,
  className,
}: SearchableSelectProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const [searchQuery, setSearchQuery] = useState("");
  
  const selectedArray = Array.isArray(value) ? value : (value ? [value] : []);

  const filteredOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (val: string) => {
    if (multiple) {
      if (selectedArray.includes(val)) {
        onChange(selectedArray.filter((v) => v !== val));
      } else {
        if (maxSelections && selectedArray.length >= maxSelections) return;
        onChange([...selectedArray, val]);
      }
    } else {
      onChange(val);
    }
  };

  return (
    <div className={cn(isCompact ? "space-y-3" : "space-y-4", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "pl-10 bg-white/70 backdrop-blur-md border-black/5 focus-visible:ring-primary/30",
            isCompact ? "h-10 text-sm" : "h-12"
          )}
          style={{ borderRadius: `${theme.borderRadius}px` }}
        />
      </div>

      <div
        className={cn(
          "overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-black/20 scrollbar-track-transparent",
          isCompact ? "max-h-[260px]" : "max-h-[320px]"
        )}
      >
        {filteredOptions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No matches found</div>
        ) : (
          (() => {
            const optionsCount = filteredOptions.length;
            // Smart grid: adapt based on number of options - ALWAYS responsive
            let gridCols = "grid-cols-2";
            if (optionsCount === 1) gridCols = "grid-cols-1";
            else if (optionsCount === 2) gridCols = "grid-cols-2";
            else if (optionsCount <= 4) gridCols = "grid-cols-2";
            else if (optionsCount <= 6) gridCols = "grid-cols-2 sm:grid-cols-3";
            else gridCols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
            
            return (
              <div className={cn("grid", isCompact ? "gap-2" : "gap-3", gridCols)}>
                {filteredOptions.map((option) => {
                  const isSelected = selectedArray.includes(option.value);
                  
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        "relative w-full text-center rounded-lg transition-all duration-200",
                        isCompact ? "p-2.5" : "p-3",
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-white border border-gray-200 hover:border-primary/50 hover:bg-gray-50"
                      )}
                      style={{
                        fontFamily: theme.fontFamily,
                        borderRadius: `${theme.borderRadius}px`,
                        backgroundColor: isSelected ? theme.primaryColor : undefined,
                        color: isSelected ? '#ffffff' : theme.textColor,
                        borderColor: isSelected ? theme.primaryColor : undefined,
                      }}
                    >
                      <div className={cn("font-medium", isCompact ? "text-[13px] sm:text-sm" : "text-sm")}>
                        {option.label}
                      </div>
                      {option.description && (
                        <div className={cn("mt-1 opacity-80", isCompact ? "text-[11px]" : "text-xs")}>
                          {option.description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
