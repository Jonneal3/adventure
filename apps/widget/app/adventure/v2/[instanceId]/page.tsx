import { notFound } from "next/navigation";

import { AdventureV2Experience } from "@/components/adventure/v2";
import { prefetchWidgetInstance } from "@/lib/server/widget-prefetch";

export const dynamic = "force-dynamic";

interface Props {
  params: { instanceId: string };
}

export default async function AdventureV2Page({ params }: Props) {
  const prefetched = await prefetchWidgetInstance(params.instanceId);
  if (!prefetched?.instance) notFound();

  return (
    <AdventureV2Experience
      instanceId={params.instanceId}
      initialInstanceData={prefetched.instance}
      initialDesignConfig={prefetched.designConfig}
    />
  );
}
