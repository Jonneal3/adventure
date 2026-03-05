export function normalizeOptionalString(value: any): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "object") {
    const raw = (value as any).value ?? (value as any).id ?? (value as any).key;
    if (typeof raw === "string") return raw.trim() || null;
    if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : null;
  }
  return null;
}

export function joinSummaries(...parts: Array<string | null | undefined>): string | null {
  const out: string[] = [];
  for (const p of parts) {
    const s = typeof p === "string" ? p.trim() : "";
    if (!s) continue;
    if (out.includes(s)) continue;
    out.push(s);
  }
  return out.length > 0 ? out.join("\n\n") : null;
}

export function mergeUniqueStrings(existing: string[], next: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const item of existing) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    merged.push(item);
  }
  for (const item of next) {
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    merged.push(item);
  }
  return merged;
}

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function fnv1a32(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
