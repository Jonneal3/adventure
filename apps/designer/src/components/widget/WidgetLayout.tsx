"use client";

import { ReactNode, useEffect, useState } from "react";
import { DesignSettings } from "@mage/types";
import { motion } from "framer-motion";

interface WidgetLayoutProps {
  config: DesignSettings;
  promptSection?: ReactNode;
  imagesSection?: ReactNode;
  className?: string;
  children?: ReactNode;
  fullPage?: boolean;
  deployment?: boolean;
}

// Simple layout switcher with clean minimal styling
const getLayoutStructure = (layoutMode: string, promptSection: ReactNode, imagesSection: ReactNode, config: DesignSettings, fullPage: boolean = false) => {
  const promptBorderWidth = fullPage ? 0 : (config.prompt_border_width ?? 0);
  const promptBorderStyle = config.prompt_border_style || "none";
  const promptBorderColor = config.prompt_border_color || "#e5e7eb";
  const promptBorder =
    promptBorderWidth > 0 && promptBorderStyle !== "none"
      ? `${promptBorderWidth}px ${promptBorderStyle} ${promptBorderColor}`
      : "none";

  const sectionVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  } as const;

  switch (layoutMode) {
    case "left-right":
      return (
        <div className="h-full flex flex-1 min-h-0 overflow-hidden">
          {/* Left: Prompt Section */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex flex-col overflow-hidden"
            style={{
              width: `${config.prompt_section_width || 40}%`,
              backgroundColor: config.prompt_background_color || 'transparent',
              borderRadius: fullPage ? 0 : `${config.prompt_border_radius || 8}px`,
              border: promptBorder,
            }}
          >
            {promptSection}
          </motion.div>
          
          {/* Right: Images Section */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
            style={{
              marginLeft: `${config.prompt_gallery_spacing || 24}px`,
              backgroundColor: config.gallery_background_color || 'transparent',
              borderRadius: fullPage ? 0 : `${config.gallery_container_border_radius || 12}px`,
              border: !fullPage && config.gallery_container_border_enabled ? 
                `${config.gallery_container_border_width}px ${config.gallery_container_border_style} ${config.gallery_container_border_color}` : 
                'none'
            }}
          >
            {imagesSection}
          </motion.div>
        </div>
      );

    case "prompt-top":
      return (
        <div className="h-full flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Top: Compact Prompt */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex-shrink-0 w-full overflow-hidden"
            style={{
              backgroundColor: config.prompt_background_color || 'transparent'
            }}
          >
            {promptSection}
          </motion.div>
          
          {/* Bottom: Images Area */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex-1 min-h-0 w-full overflow-hidden"
            style={{
              marginTop: `${config.prompt_gallery_spacing || 24}px`,
              backgroundColor: config.gallery_background_color || 'transparent',
              borderRadius: fullPage ? 0 : `${config.gallery_container_border_radius || 12}px`,
              border: !fullPage && config.gallery_container_border_enabled ? 
                `${config.gallery_container_border_width}px ${config.gallery_container_border_style} ${config.gallery_container_border_color}` : 
                'none'
            }}
          >
            {imagesSection}
          </motion.div>
        </div>
      );

    case "prompt-bottom":
      return (
        <div className="h-full flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Top: Images Area */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex-1 min-h-0 w-full overflow-hidden"
            style={{
              backgroundColor: config.gallery_background_color || 'transparent',
              borderRadius: fullPage ? 0 : `${config.gallery_container_border_radius || 12}px`,
              border: !fullPage && config.gallery_container_border_enabled ? 
                `${config.gallery_container_border_width}px ${config.gallery_container_border_style} ${config.gallery_container_border_color}` : 
                'none'
            }}
          >
            {imagesSection}
          </motion.div>
          
          {/* Bottom: Input Bar */}
          <motion.div
            variants={sectionVariants}
            layout
            className="flex-shrink-0 w-full overflow-hidden"
            style={{
              marginTop: `${config.prompt_gallery_spacing || 24}px`,
              backgroundColor: config.prompt_background_color || 'transparent'
            }}
          >
            {promptSection}
          </motion.div>
        </div>
      );

    default:
      return (
        <div className="h-full flex flex-col flex-1 min-h-0 overflow-hidden">
          {promptSection}
          {imagesSection}
        </div>
      );
  }
};

export function WidgetLayout({
  config,
  promptSection,
  imagesSection,
  className = "",
  children,
  fullPage = false,
  deployment = false,
}: WidgetLayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const containerStyles = {
    backgroundColor: (fullPage || deployment) ? 'transparent' : (config.background_color || '#ffffff'),
    borderRadius: (fullPage || deployment) ? 0 : `${config.border_radius || 0}px`,
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    boxSizing: 'border-box' as const,
    minHeight: 0,
    boxShadow: (fullPage || deployment) ? 'none' : (
      config.shadow_style === 'subtle' ? '0 1px 3px rgba(0,0,0,0.1)' :
      config.shadow_style === 'medium' ? '0 4px 6px rgba(0,0,0,0.1)' :
      config.shadow_style === 'large' ? '0 10px 15px rgba(0,0,0,0.1)' :
      config.shadow_style === 'glow' ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
    )
  };

  if (!isClient) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.25, ease: "easeOut", staggerChildren: 0.06 } },
  } as const;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      layout
      className={`relative h-full w-full flex flex-col min-h-0 overflow-hidden ${className}`}
      style={{
        ...containerStyles,
        maxHeight: '100%',
        maxWidth: '100%'
      }}
    >
      {children || getLayoutStructure('prompt-bottom', promptSection, imagesSection, config, fullPage)}
    </motion.div>
  );
} 
