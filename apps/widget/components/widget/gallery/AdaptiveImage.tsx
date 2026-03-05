"use client";

import React, { CSSProperties, useMemo, useState } from "react";
import Image from "next/image";

interface AdaptiveImageProps {
  src: string;
  alt: string;
  borderRadius?: number;
  border?: string;
  backgroundColor?: string;
  fit?: "cover" | "contain";
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  expectedAspect?: number; // width / height fallback before load
  fillContainer?: boolean; // when true, fill parent and use objectFit, ignoring aspect box
  lockAspect?: boolean; // when true, do NOT replace expectedAspect with intrinsic aspect on load
}

export function AdaptiveImage({
  src,
  alt,
  borderRadius = 8,
  border,
  backgroundColor = "transparent",
  fit = "contain",
  className,
  style,
  onClick,
  expectedAspect,
  fillContainer = false,
  lockAspect = false
}: AdaptiveImageProps) {
  const [aspect, setAspect] = useState<number | null>(expectedAspect ?? null);

  const wrapperStyles = useMemo(() => {
    const base: CSSProperties = {
      position: "relative",
      overflow: "hidden",
      borderRadius,
      border,
      backgroundColor,
      maxWidth: "100%",
      boxSizing: "border-box",
    };

    if (fillContainer) {
      // Fill the parent container (parent must size itself)
      return {
        ...base,
        width: "100%",
        height: "100%",
      } as CSSProperties;
    }

    // Aspect-ratio driven height from width
    const ar = aspect && aspect > 0 ? aspect : 1; // default square until we know better
    return {
      ...base,
      width: "100%",
      aspectRatio: `${ar} / 1`, // width / height => height = width / ar
    } as CSSProperties;
  }, [border, borderRadius, backgroundColor, aspect, fillContainer]);

  const imageStyles = useMemo(() => ({
    objectFit: fit,
    objectPosition: "center",
  }), [fit]);

  return (
    <div className={className} style={{ ...wrapperStyles, ...style }}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        style={imageStyles}
        onClick={onClick}
        onLoadingComplete={(img) => {
          if (lockAspect) return;
          try {
            const w = (img as any).naturalWidth as number;
            const h = (img as any).naturalHeight as number;
            if (w > 0 && h > 0) {
              setAspect(w / h);
            }
          } catch { /* noop */ }
        }}
        className="transition-transform duration-200 cursor-pointer hover:scale-105"
      />
    </div>
  );
}


