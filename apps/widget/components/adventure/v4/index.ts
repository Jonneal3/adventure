import { createElement, type ComponentProps } from "react";

import { AdventureV3VisualPricingExperience } from "../v3/AdventureV3VisualPricingExperience";

type Props = ComponentProps<typeof AdventureV3VisualPricingExperience>;

export function AdventureV4Experience(props: Omit<Props, "routeVersion">) {
  return createElement(AdventureV3VisualPricingExperience, { ...props, routeVersion: "v4" });
}
