const IMAGE_KEY_HINTS = [
  "image",
  "upload",
  "photo",
  "reference",
  "inspiration",
  "scene",
  "product",
  "selected",
  "preview",
  "gallery",
];

type NormalizeOptions = {
  allowData?: boolean;
  max?: number;
};

export function isImageRefLike(value: unknown, allowData = true): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) return true;
  if (allowData && /^data:image\//i.test(v)) return true;
  return false;
}

export function normalizeReferenceImages(value: unknown, options: NormalizeOptions = {}): string[] {
  const allowData = options.allowData !== false;
  const max = Number.isFinite(options.max) ? Math.max(1, Number(options.max)) : 6;
  const raw = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isImageRefLike(item, allowData)) continue;
    const normalized = String(item).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (out.length >= max) break;
  }
  return out;
}

function pushIfImageRefLike(out: string[], seen: Set<string>, value: unknown, max: number) {
  if (!isImageRefLike(value, true)) return;
  const str = String(value).trim();
  if (!str || seen.has(str)) return;
  seen.add(str);
  out.push(str);
  return out.length >= max;
}

export function collectReferenceImagesFromStepData(stepData: Record<string, any>, max = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, path: string) => {
    if (out.length >= max || node === null || node === undefined) return;

    if (typeof node === "string") {
      const keyLooksImageLike = IMAGE_KEY_HINTS.some((hint) => path.toLowerCase().includes(hint));
      if (keyLooksImageLike || isImageRefLike(node, true)) {
        pushIfImageRefLike(out, seen, node, max);
      }
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], `${path}[${i}]`);
        if (out.length >= max) return;
      }
      return;
    }

    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
        if (out.length >= max) return;
      }
    }
  };

  walk(stepData || {}, "stepDataSoFar");
  return out;
}

export function referenceImageSchemeCounts(images: string[]): Record<string, number> {
  const counts: Record<string, number> = { http: 0, https: 0, data: 0, other: 0 };
  for (const img of images) {
    const s = String(img || "");
    if (/^https:\/\//i.test(s)) counts.https += 1;
    else if (/^http:\/\//i.test(s)) counts.http += 1;
    else if (/^data:image\//i.test(s)) counts.data += 1;
    else counts.other += 1;
  }
  return counts;
}
