"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-3">
          {title ? <CardTitle className="text-sm font-medium">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      )}
      <CardContent className={cn("space-y-4", !title && !description && "pt-6", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function SettingsRow({
  title,
  description,
  control,
  className,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-6", className)}>
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      <div className="flex items-center">{control}</div>
    </div>
  );
}

