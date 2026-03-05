"use client";

// Lead Capture Control - Pure UI for collecting contact info
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { useLayoutDensity } from "../ui-layout/layout-density";
import { cn } from "@/lib/utils";

interface LeadCaptureProps {
  value?: any;
  onChange: (data: any) => void;
  requiredInputs?: string[];
  requireTerms?: boolean;
  className?: string;
}

export function LeadCapture({
  value,
  onChange,
  requiredInputs = ['email'],
  requireTerms = false,
  className
}: LeadCaptureProps) {
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const [email, setEmail] = useState(value?.email || '');
  const [phone, setPhone] = useState(value?.phone || '');
  const [name, setName] = useState(value?.name || '');

  useEffect(() => {
    onChange({ email, phone, name });
  }, [email, phone, name]);

  return (
    <div className={className}>
      <div className={cn(isCompact ? "space-y-3" : "space-y-4")}>
        {requiredInputs.includes('name') && (
          <div className="space-y-1">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Full Name</label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="John Doe"
              className={cn(isCompact ? "h-10 text-sm" : "h-12", "border-2")}
            />
          </div>
        )}
        
        <div className="space-y-1">
          <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
          <Input 
            type="email"
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="john@example.com"
            className={cn(isCompact ? "h-10 text-sm" : "h-12", "border-2")}
          />
        </div>

        {requiredInputs.includes('phone') && (
          <div className="space-y-1">
            <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Phone Number</label>
            <Input 
              type="tel"
              value={phone} 
              onChange={(e) => setPhone(e.target.value)} 
              placeholder="(555) 000-0000"
              className={cn(isCompact ? "h-10 text-sm" : "h-12", "border-2")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
