"use client";

export type ServiceCatalogItem = {
  serviceId: string;
  serviceName: string | null;
  industryId: string | null;
  industryName: string | null;
  serviceSummary?: string | null;
};

export type ServiceCatalogSnapshot = {
  v: 1;
  byServiceId: Record<string, ServiceCatalogItem>;
};

function storageKey(sessionId: string) {
  return `serviceCatalog:${sessionId}`;
}

export function loadServiceCatalog(sessionId: string): ServiceCatalogSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as any).v !== 1) return null;
    if (!(parsed as any).byServiceId || typeof (parsed as any).byServiceId !== "object") return null;
    return parsed as ServiceCatalogSnapshot;
  } catch {
    return null;
  }
}

export function saveServiceCatalog(sessionId: string, items: ServiceCatalogItem[] | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      window.localStorage.removeItem(storageKey(sessionId));
      return;
    }
    const byServiceId: Record<string, ServiceCatalogItem> = {};
    for (const item of items) {
      const serviceId = typeof item?.serviceId === "string" ? item.serviceId : "";
      if (!serviceId) continue;
      byServiceId[serviceId] = {
        serviceId,
        serviceName: typeof item?.serviceName === "string" ? item.serviceName : null,
        industryId: typeof item?.industryId === "string" ? item.industryId : null,
        industryName: typeof item?.industryName === "string" ? item.industryName : null,
        serviceSummary: typeof (item as any)?.serviceSummary === "string" ? String((item as any).serviceSummary).trim() || null : null,
      };
    }
    const snapshot: ServiceCatalogSnapshot = { v: 1, byServiceId };
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(snapshot));
  } catch {}
}

export function clearServiceCatalog(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {}
}
