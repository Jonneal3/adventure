"use client";

import React, { CSSProperties, useMemo } from "react";
import Image from "next/image";

interface SquareImageProps {
  src: string;
  alt: string;
  sizePercent?: number; // 0-100, width of the parent container
  borderRadius?: number;
  border?: string;
  backgroundColor?: string;
  objectFit?: "cover" | "contain";
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  debugLabel?: string; // optional dimension/debug label
}

export function SquareImage({
  src,
  alt,
  sizePercent = 100,
  borderRadius = 8,
  border,
  backgroundColor = "transparent",
  objectFit = "cover",
  onClick,
  className,
  style,
  debugLabel
}: SquareImageProps) {
  const wrapperStyles = useMemo(() => ({
    width: `${Math.max(0, Math.min(100, sizePercent))}%`,
    aspectRatio: "1 / 1",
    position: "relative" as const,
    overflow: "hidden" as const,
    borderRadius,
    border,
    backgroundColor,
    maxWidth: "100%",
    maxHeight: "100%",
    boxSizing: "border-box" as const,
  }), [sizePercent, borderRadius, border, backgroundColor]);

  const imageStyles = useMemo(() => ({
    objectFit: objectFit,
    objectPosition: "center",
  }), [objectFit]);

  return (
    <div className={className} style={{ ...wrapperStyles, ...style }}>
      {/* debugLabel overlay removed */}

      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        style={imageStyles}
        onClick={onClick}
        className="transition-transform duration-200 cursor-pointer hover:scale-105"
      />
    </div>
  );
}


