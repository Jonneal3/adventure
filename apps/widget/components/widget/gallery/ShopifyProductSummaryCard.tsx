"use client";

import React, { useMemo, useState } from "react";
import { DesignSettings } from "../../../types";
import { SquareImage } from "./SquareImage";

interface ShopifyProductSummaryCardProps {
	images: string[];
	title?: string;
	description?: string;
	priceMin?: string | null;
	priceMax?: string | null;
	currency?: string | null;
	config: DesignSettings;
}

function normalizeImageUrl(input: string): string | null {
	if (typeof input !== "string" || input.length === 0) return null;
	let url = input.trim();
	if (url.startsWith("//")) url = `https:${url}`;
	try {
		const u = new URL(url);
		return `${u.origin}${u.pathname}${u.search}`;
	} catch {
		let out = url.split("#")[0];
		if (out.startsWith("//")) out = `https:${out}`;
		if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
		return out;
	}
}

export function ShopifyProductSummaryCard({
	images,
	title,
	description,
	priceMin,
	priceMax,
	currency,
	config
}: ShopifyProductSummaryCardProps) {
	const dedupImages = useMemo(() => {
		const normalized = images
			.map(normalizeImageUrl)
			.filter((u): u is string => !!u);
		return Array.from(new Set(normalized));
	}, [images]);

	const [hover, setHover] = useState(false);
	const [hoveredSrc, setHoveredSrc] = useState<string | null>(null);

	const preview = dedupImages.slice(0, 3);

	const priceText = useMemo(() => {
		if (!priceMin && !priceMax) return null;
		const c = currency || '';
		if (priceMin && priceMax && priceMin !== priceMax) return `${c}${priceMin} - ${c}${priceMax}`;
		return `${c}${priceMin || priceMax}`;
	}, [priceMin, priceMax, currency]);

	const shortDescription = useMemo(() => {
		if (!description) return null;
		try {
			// Remove HTML tags if any (admin body_html)
			const tmp = description.replace(/<[^>]+>/g, '');
			return tmp.length > 140 ? `${tmp.slice(0, 140)}…` : tmp;
		} catch {
			return description;
		}
	}, [description]);

	return (
		<div
			className="pointer-events-none"
			style={{
				position: "absolute",
				bottom: 12,
				right: 12,
				zIndex: 60,
				width: "auto",
				height: "auto"
			}}
		>
			<div
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				className="pointer-events-auto"
				style={{
					position: "relative",
					display: "inline-block",
					// Compact floating pill
					background: "rgba(255,255,255,0.92)",
					color: "#111827",
					border: "1px solid rgba(0,0,0,0.08)",
					borderRadius: 12,
					padding: 10,
					// No shadow (non-intrusive)
					boxShadow: "none",
					backdropFilter: "blur(3px)",
					maxWidth: 520,
					willChange: "transform, box-shadow",
					transition: "opacity 160ms ease",
					transform: "none",
					transformOrigin: "bottom right"
				}}
			>
			{/* Header: Title left, Price right */}
				<div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
				<div style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
					<div
						style={{
							fontWeight: 700,
								fontSize: 14,
							letterSpacing: 0.2,
							lineHeight: 1.2,
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis"
						}}
						title={title}
					>
						{title || "Shopify Product"}
					</div>
				</div>
				{priceText && (
					<span
						style={{
							flexShrink: 0,
							display: "inline-block",
							marginTop: 0,
								fontSize: 12,
							fontWeight: 800,
							color: "#065f46",
								background: "rgba(16,185,129,0.14)",
								border: "1px solid rgba(16,185,129,0.22)",
								padding: "2px 10px",
								borderRadius: 999,
								lineHeight: 1
						}}
					>
						{priceText}
					</span>
				)}
			</div>
				
			{hover && shortDescription && (
				<div
					style={{
							marginTop: 6,
							fontSize: 12,
						opacity: 0.85,
						lineHeight: 1.4,
						maxHeight: 36,
						overflow: "hidden"
					}}
					title={shortDescription}
				>
					{shortDescription}
				</div>
			)}

				<div style={{ height: 10 }} />
			{!hover ? (
					<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					{preview.map((src, i) => (
						<div
							key={`${src}-${i}`}
							style={{
									width: 46,
									height: 46,
								borderRadius: 8,
								overflow: "hidden",
								background: "rgba(0,0,0,0.04)",
								border: "1px solid rgba(0,0,0,0.08)",
								transition: "transform 180ms ease, box-shadow 180ms ease",
								boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
							}}
							onMouseEnter={(e) => {
								setHoveredSrc(src);
									(e.currentTarget as HTMLDivElement).style.transform = "scale(1.20)";
								(e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 16px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.08)";
								(e.currentTarget as HTMLDivElement).style.zIndex = "2";
							}}
							onMouseLeave={(e) => {
								setHoveredSrc(null);
								(e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
								(e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
								(e.currentTarget as HTMLDivElement).style.zIndex = "1";
							}}
						>
							<SquareImage
								src={src}
								alt={`thumb-${i + 1}`}
								sizePercent={100}
								borderRadius={8}
								border={"2px solid transparent"}
								backgroundColor={"transparent"}
								objectFit={"cover"}
								onClick={() => {}}
							/>
						</div>
					))}
					{dedupImages.length > preview.length && (
						<div style={{ fontSize: 11, opacity: 0.75 }}>
							+{dedupImages.length - preview.length} more
						</div>
					)}
				</div>
			) : null}

				{hover && dedupImages.length > 0 && (
				<div
					style={{
						marginTop: 10,
						transition: "opacity 220ms ease, transform 220ms ease",
						opacity: hover ? 1 : 0,
						transform: hover ? "translateY(0)" : "translateY(4px)"
					}}
				>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
								gap: 18,
							maxHeight: 220,
							overflowY: "auto",
							paddingTop: 2,
							paddingBottom: 2
						}}
					>
						{dedupImages.map((src, i) => (
							<div
								key={`all-${src}-${i}`}
								style={{
										width: 80,
										height: 80,
										borderRadius: 12,
									overflow: "hidden",
									background: "rgba(0,0,0,0.04)",
									border: "1px solid rgba(0,0,0,0.10)",
									boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
										transition: "transform 140ms ease, box-shadow 200ms ease",
										transform: "scale(1)"
								}}
								onMouseEnter={(e) => {
									setHoveredSrc(src);
										(e.currentTarget as HTMLDivElement).style.transform = "scale(1.06)";
										(e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 24px rgba(0,0,0,0.18)";
								}}
								onMouseLeave={(e) => {
									setHoveredSrc(null);
										(e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
										(e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)";
								}}
							>
								<SquareImage
									src={src}
									alt={`image-${i + 1}`}
									sizePercent={100}
									borderRadius={12}
									border={"2px solid transparent"}
									backgroundColor={"transparent"}
									objectFit={"cover"}
									onClick={() => {}}
								/>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Large preview on hover */}
			{hover && hoveredSrc && (
				<div
					style={{
						position: "absolute",
							right: 0,
						bottom: "100%",
						marginBottom: 10,
							width: 220,
						aspectRatio: "1 / 1",
						borderRadius: 14,
						overflow: "hidden",
						background: "rgba(0,0,0,0.04)",
						border: "1px solid rgba(0,0,0,0.10)",
						boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
							transition: "opacity 160ms ease, transform 160ms ease",
						opacity: 1,
							transform: "translateY(0)"
					}}
				>
					<SquareImage
						src={hoveredSrc}
						alt="preview"
						sizePercent={100}
						borderRadius={14}
						border={"2px solid transparent"}
						backgroundColor={"transparent"}
						objectFit={"cover"}
						onClick={() => {}}
					/>
				</div>
			)}
			</div>
		</div>
	);
}


