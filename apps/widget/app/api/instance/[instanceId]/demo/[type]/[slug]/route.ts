// Alias for backwards compatibility:
// `/api/widget/:instanceId/demo/...` is the legacy name used for demo instance bootstrap.
// Prefer `/api/instance/:instanceId/demo/...` going forward.
export { dynamic } from "../../../../../widget/[instanceId]/demo/[type]/[slug]/route";
export { GET, POST } from "../../../../../widget/[instanceId]/demo/[type]/[slug]/route";

