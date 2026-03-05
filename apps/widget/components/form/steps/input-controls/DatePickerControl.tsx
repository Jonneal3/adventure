"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { useLayoutDensity } from "../ui-layout/layout-density";

interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  className,
}: DatePickerProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | null>(value ? new Date(value) : null);

  useEffect(() => {
    if (value) setDate(new Date(value));
  }, [value]);

  const handleSelect = (d: Date | undefined) => {
    const next = d || null;
    setDate(next);
    if (next) onChange(next.toISOString());
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn("relative", className)}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-semibold border-2 transition-all",
              isCompact ? "h-11 text-base" : "h-14 text-lg",
              !date ? "text-muted-foreground border-muted/60" : "border-primary/20"
            )}
            style={{ borderRadius: `${theme.borderRadius}px` }}
          >
            <CalendarIcon className="mr-3 h-5 w-5 text-primary/60" strokeWidth={2.5} />
            {date ? format(date, "PPP") : <span>Select a date...</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-2xl border-none" align="start">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <input
              type="date"
              value={date ? format(date, "yyyy-MM-dd") : ""}
              onChange={(e) => {
                if (e.target.value) {
                  handleSelect(new Date(e.target.value));
                  setOpen(false);
                }
              }}
              className="p-4 bg-background rounded-lg border-none focus:ring-2 focus:ring-primary/50 outline-none font-medium"
            />
          </motion.div>
        </PopoverContent>
      </Popover>
    </motion.div>
  );
}
