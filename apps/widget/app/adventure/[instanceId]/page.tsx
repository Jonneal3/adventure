import { AdventureV9Experience } from "@/components/adventure/v9";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
}

export default async function AdventurePage({ params }: Props) {
  const prefetched = await prefetchWidgetInstance(params.instanceId);
  if (!prefetched?.instance) notFound();

  return (
    <AdventureV9Experience
      instanceId={params.instanceId}
      initialInstanceData={prefetched.instance}
      initialDesignConfig={prefetched.designConfig}
    />
  );
}
