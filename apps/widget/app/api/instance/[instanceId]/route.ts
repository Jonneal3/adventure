// Alias for backwards compatibility:
// `/api/widget/:instanceId` is the legacy name used as the "instance bootstrap" endpoint.
// Prefer `/api/instance/:instanceId` going forward.
export { dynamic } from "../../widget/[instanceId]/route";
export { GET } from "../../widget/[instanceId]/route";

