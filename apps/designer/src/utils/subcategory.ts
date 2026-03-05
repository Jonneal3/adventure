export function stripInstanceTypeSuffix(label: string): string {
  return String(label || "")
    .replace(/\s*\((service|e-?commerce)\)\s*$/i, "")
    .trim();
}

export function formatSubcategoryLabel(
  label: string,
  opts?: {
    stripGeneralPrefix?: boolean;
  },
): string {
  let out = stripInstanceTypeSuffix(label);
  if (opts?.stripGeneralPrefix ?? true) {
    out = out.replace(/^general\s+/i, "");
  }
  return out.trim();
}

export function stripTypeSuffixFromServiceSlug(slug: string): string {
  return String(slug || "").replace(/-(service|ecomm|e-commerce)$/i, "");
}

