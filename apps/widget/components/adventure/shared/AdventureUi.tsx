"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AdventureUiVersion = "v8" | "v9";
export type AdventureButtonIntent =
  | "primary"
  | "secondary"
  | "ghost"
  | "utility"
  | "icon"
  | "choice";

const AdventureUiContext = React.createContext<AdventureUiVersion>("v8");

export function AdventureUiProvider({
  version,
  children,
}: {
  version: AdventureUiVersion;
  children: React.ReactNode;
}) {
  return <AdventureUiContext.Provider value={version}>{children}</AdventureUiContext.Provider>;
}

export function useAdventureUiVersion() {
  return React.useContext(AdventureUiContext);
}

export interface AdventureButtonProps extends ButtonProps {
  intent?: AdventureButtonIntent;
  /** Preserve an existing shadcn-rendered V8 control while V9 applies its shared treatment. */
  legacyShadcn?: boolean;
}

export const AdventureButton = React.forwardRef<HTMLButtonElement, AdventureButtonProps>(
  function AdventureButton(
    {
      className,
      intent = "ghost",
      legacyShadcn = false,
      variant,
      size,
      asChild,
      ...props
    },
    ref
  ) {
    const version = useAdventureUiVersion();

    if (version === "v8" && !legacyShadcn) {
      return <button ref={ref} className={className} {...props} />;
    }

    const resolvedVariant: ButtonProps["variant"] = variant || (
      intent === "primary"
        ? "default"
        : intent === "secondary" || intent === "utility" || intent === "choice"
          ? "outline"
          : "ghost"
    );
    const resolvedSize: ButtonProps["size"] = size || (intent === "icon" ? "icon" : "default");

    return (
      <Button
        ref={ref}
        className={cn(version === "v9" && "adventure-v9-button", className)}
        data-adventure-ui="button"
        data-intent={intent}
        variant={resolvedVariant}
        size={resolvedSize}
        asChild={asChild}
        {...props}
      />
    );
  }
);

export interface AdventureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  legacyShadcn?: boolean;
}

export const AdventureInput = React.forwardRef<HTMLInputElement, AdventureInputProps>(
  function AdventureInput({ className, legacyShadcn = false, ...props }, ref) {
    const version = useAdventureUiVersion();
    if (props.hidden || (version === "v8" && !legacyShadcn)) {
      return <input ref={ref} className={className} {...props} />;
    }
    return (
      <Input
        ref={ref}
        className={cn(version === "v9" && "adventure-v9-input", className)}
        data-adventure-ui="input"
        {...props}
      />
    );
  }
);

export function AdventureActionBar({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} data-adventure-ui="action-bar">
      {children}
    </div>
  );
}

export function AdventureStepShell({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} data-adventure-ui="step-shell">
      {children}
    </div>
  );
}

export const AdventureChoiceCard = React.forwardRef<HTMLButtonElement, AdventureButtonProps>(
  function AdventureChoiceCard(props, ref) {
    return <AdventureButton ref={ref} intent="choice" data-adventure-ui="choice-card" {...props} />;
  }
);
