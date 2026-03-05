"use client";

// Confirmation Control - Pure UI for review + Schedule appointment / Book a call
import React from 'react';
import { useFormTheme } from '../../demo/FormThemeProvider';
import { CheckCircle2, Calendar } from 'lucide-react';

interface ConfirmationProps {
  className?: string;
  /** URL for "Schedule appointment" / "Book a call". Defaults to placeholder. */
  scheduleUrl?: string;
}

export function Confirmation({ className, scheduleUrl }: ConfirmationProps) {
  const { theme } = useFormTheme();
  const url = scheduleUrl || "https://calendly.com/demo";

  return (
    <div className={className}>
      <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black">All Set!</h3>
          <p className="text-muted-foreground max-w-sm mx-auto font-medium">
            We've gathered all the info we need to create your perfect design. Ready to see the results?
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          style={{
            backgroundColor: theme?.primaryColor ? `${theme.primaryColor}20` : "hsl(var(--primary) / 0.2)",
            color: theme?.primaryColor || "hsl(var(--primary))",
          }}
        >
          <Calendar className="w-4 h-4" />
          Schedule appointment
        </a>
      </div>
    </div>
  );
}
