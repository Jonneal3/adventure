"use client";

import React from "react";
import { Button } from "../ui/button";
import { Sparkles, ImageIcon, ArrowRight } from "lucide-react";
import { hexToRgba } from "@/types/design";

interface SubcategoryPlaceholderProps {
  subcategoryName: string;
  categoryName: string;
  onGenerateGallery?: () => void;
  config?: any;
}

export function SubcategoryPlaceholder({
  subcategoryName,
  categoryName,
  onGenerateGallery,
  config
}: SubcategoryPlaceholderProps) {
  const hasGenerateAction = !!onGenerateGallery;
  const accent = (config?.primary_color && typeof config.primary_color === "string") ? config.primary_color : "#111827";
  const radius = typeof config?.border_radius === "number" ? config.border_radius : 16;
  const textColor = (config?.prompt_text_color && typeof config.prompt_text_color === "string")
    ? config.prompt_text_color
    : "#0f172a";
  const mutedTextColor = (config?.uploader_text_color && typeof config.uploader_text_color === "string")
    ? config.uploader_text_color
    : "#475569";
  const surface = (config?.prompt_background_color && typeof config.prompt_background_color === "string")
    ? config.prompt_background_color
    : hexToRgba(accent, 0.06);
  const border = (config?.prompt_border_color && typeof config.prompt_border_color === "string")
    ? config.prompt_border_color
    : hexToRgba(accent, 0.22);

  return (
    <div
      className="col-span-full aspect-[2/1] flex flex-col items-center justify-center border border-dashed relative overflow-hidden"
      style={{
        borderRadius: `${radius}px`,
        borderColor: border,
        backgroundColor: surface,
      }}
    >
      <div className="relative z-10 text-center px-6 max-w-xl">
        <div
          className="w-14 h-14 mb-5 rounded-2xl flex items-center justify-center mx-auto shadow-sm"
          style={{
            backgroundColor: hexToRgba(accent, 0.14),
            color: accent,
          }}
        >
          <Sparkles className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-semibold mb-2" style={{ color: textColor }}>
          {subcategoryName}
        </h3>

        <p className="text-sm mb-4" style={{ color: mutedTextColor }}>
          {categoryName} • Gallery
        </p>

        <p className="text-sm mb-6" style={{ color: mutedTextColor }}>
          No placeholder images yet. Generate a small, on-brand gallery to showcase this category.
        </p>

        {hasGenerateAction ? (
          <Button
            onClick={onGenerateGallery}
            className="px-6 py-2 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md hover:bg-[var(--btn-hover)] active:scale-[0.99]"
            style={{
              backgroundColor: config?.submit_button_background_color || accent,
              ["--btn-hover" as any]: config?.submit_button_hover_background_color || config?.submit_button_background_color || accent,
              color: config?.submit_button_text_color || "#ffffff",
              borderRadius: `${config?.submit_button_border_radius ?? 12}px`,
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Gallery
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: mutedTextColor }}>
            <ImageIcon className="w-4 h-4" />
            <span>Gallery coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
} 
