import { AdventureV5Experience } from "@/components/adventure/v5";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";
import { notFound } from "next/navigation";
import { ServiceExperience } from "@/components/adventure/ServiceExperience";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
  searchParams?: { preview?: string };
}

export default async function AdventurePage({ params, searchParams }: Props) {
  if (process.env.ADVENTURE_PLATFORM_V2 === "true") {
    const backend = process.env.BACKEND_INTERNAL_URL;
    if (!backend) throw new Error("BACKEND_INTERNAL_URL is required for the new Adventure platform");
    const url = new URL(`/api/adventure/${encodeURIComponent(params.instanceId)}`, backend);
    if (searchParams?.preview) url.searchParams.set('preview', searchParams.preview);
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) notFound();
    if (!response.ok) throw new Error("Adventure experience is unavailable");
    return <ServiceExperience initial={await response.json()} />;
  }
  const prefetched = await prefetchWidgetInstance(params.instanceId);
  if (!prefetched?.instance) notFound();

  return (
    <AdventureV5Experience
      instanceId={params.instanceId}
      initialInstanceData={prefetched.instance}
      initialDesignConfig={prefetched.designConfig}
    />
  );
}
