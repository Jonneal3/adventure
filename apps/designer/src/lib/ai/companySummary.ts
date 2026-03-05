import OpenAI from "openai";

export type CompanySummaryProvider = "openai" | "groq";

export type CompanySummaryResult = {
  normalizedUrl: string;
  title: string | null;
  metaDescription: string | null;
  summary: string;
  provider: CompanySummaryProvider;
  model: string;
};

function normalizeUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) throw new Error("URL is required");

  // Allow users to paste "example.com" (assume https).
  const withScheme = raw.match(/^https?:\/\//i) ? raw : `https://${raw}`;
  const url = new URL(withScheme);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http/https URLs are supported");
  }
  return url.toString();
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const text = withoutScripts
    .replace(/<\/(p|div|br|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = m?.[1]?.replace(/\s+/g, " ").trim();
  return title && title.length > 0 ? title.slice(0, 200) : null;
}

function extractMetaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
  const desc = m?.[1]?.replace(/\s+/g, " ").trim();
  return desc && desc.length > 0 ? desc.slice(0, 400) : null;
}

async function fetchWebsiteSnapshot(url: string): Promise<{
  normalizedUrl: string;
  html: string;
  title: string | null;
  metaDescription: string | null;
  text: string;
}> {
  const normalizedUrl = normalizeUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SIFDesignerBot/1.0; +https://sif.ai)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (HTTP ${res.status})`);
    }

    const html = await res.text();
    const title = extractTitle(html);
    const metaDescription = extractMetaDescription(html);
    const text = stripHtmlToText(html).slice(0, 20_000); // cap context

    return { normalizedUrl, html, title, metaDescription, text };
  } finally {
    clearTimeout(timeout);
  }
}

function getProviderAndClient(
  providerOverride?: CompanySummaryProvider
): { provider: CompanySummaryProvider; model: string; client: OpenAI } {
  const provider =
    providerOverride ||
    (process.env.COMPANY_SUMMARY_PROVIDER as CompanySummaryProvider | undefined) ||
    "openai";

  const model =
    process.env.COMPANY_SUMMARY_MODEL ||
    (provider === "groq" ? "llama-3.1-8b-instant" : "gpt-3.5-turbo");

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return { provider, model, client: new OpenAI({ apiKey }) };
  }

  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
    return {
      provider,
      model,
      client: new OpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

export async function generateCompanySummaryFromUrl(input: {
  url: string;
  provider?: CompanySummaryProvider;
}): Promise<CompanySummaryResult> {
  const { normalizedUrl, title, metaDescription, text } = await fetchWebsiteSnapshot(
    input.url
  );
  const { provider, model, client } = getProviderAndClient(input.provider);

  const system = [
    "You summarize a company's website for internal CRM enrichment.",
    "Return a concise company summary (2-4 sentences).",
    "If the page is not a company homepage, infer the company from the text if possible.",
    "Do not include disclaimers. Do not mention that you used a website or HTML.",
  ].join(" ");

  const user = [
    `URL: ${normalizedUrl}`,
    title ? `Title: ${title}` : "",
    metaDescription ? `Meta description: ${metaDescription}` : "",
    "",
    "Website text snapshot:",
    text || "(no text extracted)",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: 220,
  });

  const summary = completion.choices?.[0]?.message?.content?.trim() || "";
  if (!summary) {
    throw new Error("Failed to generate company summary");
  }

  return {
    normalizedUrl,
    title,
    metaDescription,
    summary: summary.slice(0, 1200),
    provider,
    model,
  };
}

