"use client";

import { DesignSettings } from "@mage/types";

interface BrandHeaderProps {
  config: DesignSettings;
  containerWidth?: number;
  hideInMobile?: boolean; // New prop to control mobile/iframe visibility
}

export function BrandHeader({ config, containerWidth = 1024, hideInMobile = false }: BrandHeaderProps) {
  // Check if header is enabled and if we have any visible branding elements
  const hasLogo = config.logo_enabled && config.logo_url;
  const hasBrandName = config.brand_name_enabled && config.brand_name;
  
  // Hide header if disabled, no branding elements, or explicitly hidden in mobile
  if (!config.header_enabled || (!hasLogo && !hasBrandName) || hideInMobile) {
    return null;
  }

  const headerAlignment = config.header_alignment || 'center'; // left, center, right
  
  const alignmentClasses = {
  center: 'justify-center text-center',
  left: 'justify-start text-left',
  right: 'justify-end text-right'
};

  // Use minimal spacing that respects the configured padding
  const itemGap = Math.max(6, Math.min(16, containerWidth * 0.01));

  return (
    <div 
      className={`sticky top-0 z-20 flex-shrink-0 flex ${alignmentClasses[headerAlignment as keyof typeof alignmentClasses]} w-full`}
      style={{
        backgroundColor: config.background_color || '#ffffff',
        padding: `${Math.max(8, 12)}px ${Math.max(12, 16)}px`
      }}
    >
      <div 
        className="flex items-center"
        style={{ gap: `${itemGap}px` }}
      >
        {/* Logo - Always left of brand name */}
        {hasLogo && (
          <img 
            src={config.logo_url} 
            alt={config.brand_name || "Logo"} 
            className="object-contain flex-shrink-0"
            style={{
              height: `${config.logo_height || 48}px`,
              maxWidth: `${(config.logo_height || 48) * 2}px`, // Maintain aspect ratio
              border: `${config.logo_border_width || 0}px solid ${config.logo_border_color || '#e5e7eb'}`,
              borderRadius: `${config.logo_border_radius || 4}px`
            }}
          />
        )}
        
        {/* Brand Name - Right of logo */}
        {hasBrandName && (
          <h1 
            className="font-semibold leading-tight"
            style={{ 
              color: config.brand_name_color || '#000000',
              fontFamily: config.brand_name_font_family || 'inherit',
              fontSize: `${config.brand_name_font_size || 32}px`,
            }}
          >
            {config.brand_name}
          </h1>
        )}
      </div>
    </div>
  );
} 