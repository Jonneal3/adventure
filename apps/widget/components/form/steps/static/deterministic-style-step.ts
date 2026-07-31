import type { UIStep } from "@/types/ai-form";

export function buildDeterministicStyleStep(serviceOption: any): UIStep | null {
  const styleOptions = Array.isArray(serviceOption?.styleOptions) ? serviceOption.styleOptions : [];
  if (styleOptions.length === 0) return null;

  const rankedStyleOptions = styleOptions
    .map((option: any, index: number) => ({ option, index }))
    .sort((a: any, b: any) => {
      const aRank = Number.isFinite(Number(a.option?.featuredRank)) ? Number(a.option.featuredRank) : Number.POSITIVE_INFINITY;
      const bRank = Number.isFinite(Number(b.option?.featuredRank)) ? Number(b.option.featuredRank) : Number.POSITIVE_INFINITY;
      return aRank - bRank || a.index - b.index;
    })
    .slice(0, 20)
    .map(({ option }: any) => option);

  return {
    id: "step-style-direction",
    type: "image_choice_grid",
    question: "Choose the closest starting point.",
    options: rankedStyleOptions
      .map((opt: any) => ({
        label: String(opt?.label || ""),
        value: String(opt?.value || opt?.label || ""),
        imageUrl: typeof opt?.imageUrl === "string" ? opt.imageUrl : "",
        ...(typeof opt?.description === "string" && opt.description ? { description: opt.description } : {}),
        ...(typeof opt?.priceTier === "string" && opt.priceTier ? { priceTier: opt.priceTier } : {}),
        ...(opt?.priceRange && Number.isFinite(Number(opt.priceRange.low)) && Number.isFinite(Number(opt.priceRange.high))
          ? {
              priceRange: {
                low: Number(opt.priceRange.low),
                high: Number(opt.priceRange.high),
                currency: typeof opt.priceRange.currency === "string" ? opt.priceRange.currency : "USD",
              },
            }
          : {}),
        ...(Number.isFinite(Number(opt?.featuredRank)) && Number(opt.featuredRank) > 0
          ? { featuredRank: Math.floor(Number(opt.featuredRank)) }
          : {}),
      }))
      .filter((opt: any) => opt.label && opt.value && opt.imageUrl),
    multi_select: false,
    columns: rankedStyleOptions.length >= 7 ? 4 : 3,
    metricGain: 0.12,
    humanism: "Pick whichever feels closest. You can adjust the style, materials, and details next.",
    blueprint: { presentation: { auto_advance: false, continue_label: "See similar concepts" } },
  } as UIStep;
}
