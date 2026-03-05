"use client";

import * as React from "react";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className ?? "mb-8"}`}>
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground truncate">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  );
}

