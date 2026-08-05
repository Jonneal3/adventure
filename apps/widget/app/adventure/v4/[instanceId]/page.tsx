import { notFound } from "next/navigation";

import { AdventureV4Experience } from "@/components/adventure/v4";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
}

export default async function AdventureV4Page({ params }: Props) {
  const prefetched = await prefetchWidgetInstance(params.instanceId);
  if (!prefetched?.instance) notFound();

  return (
    <AdventureV4Experience
      instanceId={params.instanceId}
      initialInstanceData={prefetched.instance}
      initialDesignConfig={prefetched.designConfig}
    />
  );
}
