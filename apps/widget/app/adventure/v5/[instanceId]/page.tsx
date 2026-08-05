import { notFound } from "next/navigation";

import { AdventureV5Experience } from "@/components/adventure/v5";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
}

export default async function AdventureV5Page({ params }: Props) {
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
