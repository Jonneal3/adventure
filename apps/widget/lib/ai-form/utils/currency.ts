export type CurrencyDetectOptions = {
  locale?: string;
  currencyOverride?: string | null;
};

// Very small, explicit region->currency mapping for MVP.
// We can expand as needed, and add geo-IP override later.
const REGION_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  IE: "EUR",
  FR: "EUR",
  DE: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  FI: "EUR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  CH: "CHF",
  AU: "AUD",
  NZ: "NZD",
  JP: "JPY",
  IN: "INR",
  BR: "BRL",
  MX: "MXN",
  SG: "SGD",
  HK: "HKD",
};

function regionFromLocale(locale?: string): string | null {
  if (!locale) return null;
  // Examples:
  // - en-US -> US
  // - en_US -> US
  // - fr -> (no region)
  const m = /[-_](?<region>[A-Za-z]{2})\b/.exec(locale);
  const region = m?.groups?.region?.toUpperCase();
  return region || null;
}

export function detectCurrencyFromLocale(locale?: string, opts?: { currencyOverride?: string | null }): string {
  const override = opts?.currencyOverride;
  if (override && typeof override === "string") return override.toUpperCase();

  const region = regionFromLocale(locale);
  if (region && REGION_TO_CURRENCY[region]) return REGION_TO_CURRENCY[region];

  // As a safe global default, USD.
  return "USD";
}

export function formatCurrency(
  amount: number,
  opts?: { locale?: string; currency?: string; currencyOverride?: string | null }
): string {
  const locale = opts?.locale;
  const currency = (opts?.currency || detectCurrencyFromLocale(locale, { currencyOverride: opts?.currencyOverride }))
    .toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    // Fallback: basic formatting
    const rounded = Math.round(amount);
    return `${currency} ${rounded.toLocaleString()}`;
  }
}


