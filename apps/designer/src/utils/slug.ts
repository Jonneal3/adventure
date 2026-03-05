export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining diacritical marks (broad browser support)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toSubcategorySlug(value: string): string {
  const cleaned = String(value || "")
    .replace(/\s*\((service|e-?commerce)\)\s*$/i, "")
    .trim();
  return toSlug(cleaned);
}

export function fromSlug(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

