import { VisualPriceExplorer } from "@/components/visual-pricing/VisualPriceExplorer";

export default function HomePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const surface = Array.isArray(searchParams?.surface)
    ? searchParams?.surface[0]
    : searchParams?.surface;

  return <VisualPriceExplorer compact={surface === "embed" || surface === "iframe"} />;
}
