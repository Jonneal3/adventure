import { notFound } from "next/navigation";

import { AdventureV3Experience } from "@/components/adventure/v3";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
}

export default async function AdventureV3Page({ params }: Props) {
  const prefetched = await prefetchWidgetInstance(params.instanceId);
  if (!prefetched?.instance) notFound();

  return (
    <AdventureV3Experience
      instanceId={params.instanceId}
      initialInstanceData={prefetched.instance}
      initialDesignConfig={prefetched.designConfig}
    />
  );
}
