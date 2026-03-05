"use client";

import React from "react";
import type { DesignSettings } from "../../../types";

type Props = {
  config: DesignSettings;
  referenceImagesCount: number;
  scale?: number;
  fallbackColor?: string;
  className?: string;
};

/**
 * Renders the uploader helper copy (primary + secondary) in a consistent way.
 * This keeps UI/logic out of layout components.
 */
export function UploaderHelperText({
  config,
  referenceImagesCount,
  scale = 1,
  fallbackColor = "#64748b",
  className = "",
}: Props) {
  const primary = (config.uploader_primary_text || "").trim();
  const secondary = (config.uploader_secondary_text || "").trim();

  const shouldShow =
    (config.uploader_enabled !== false) &&
    referenceImagesCount === 0 &&
    Boolean(primary || secondary);

  if (!shouldShow) return null;

  const color = config.uploader_text_color || fallbackColor;
  const fontFamily = config.uploader_font_family || config.prompt_font_family || "inherit";
  const fontSize = config.uploader_font_size ?? 12;
  const fontSizePx = Math.min(Math.max(10, fontSize * scale), 14);

  return (
    <div
      className={className}
      style={{
        color,
        fontFamily,
        fontSize: `${fontSizePx}px`,
        lineHeight: 1.3,
        opacity: 0.92,
      }}
    >
      {primary && <div style={{ fontWeight: 600 }}>{primary}</div>}
      {secondary && <div style={{ opacity: 0.9 }}>{secondary}</div>}
    </div>
  );
}

