import OpenAI from "openai";

export type ServiceSummaryProvider = "openai" | "groq";

export type GenerateServiceSummaryInput = {
  serviceName: string;
  categoryName?: string | null;
  instanceType?: "service" | "ecomm" | "both" | string | null;
  provider?: ServiceSummaryProvider;
};

function getProviderAndClient(
  providerOverride?: ServiceSummaryProvider
): { provider: ServiceSummaryProvider; model: string; client: OpenAI } {
  const provider =
    providerOverride ||
    (process.env.SERVICE_SUMMARY_PROVIDER as ServiceSummaryProvider | undefined) ||
    "openai";

  const model =
    process.env.SERVICE_SUMMARY_MODEL ||
    (provider === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini");

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

export async function generateServiceSummary(
  input: GenerateServiceSummaryInput
): Promise<string> {
  const serviceName = String(input.serviceName || "").trim();
  if (!serviceName) throw new Error("serviceName is required");

  const categoryName = input.categoryName ? String(input.categoryName).trim() : null;
  const instanceType = input.instanceType ? String(input.instanceType).trim() : "service";

  const { client, model } = getProviderAndClient(input.provider);

  const system = [
    "You write concise marketing summaries for a service landing page.",
    "Write 2-4 sentences.",
    "Use plain language and focus on outcomes and value.",
    "Do not mention AI models, policies, or that you are an assistant.",
    "Do not include headings, bullets, or quotes.",
  ].join(" ");

  const user = [
    `Service: ${serviceName}`,
    categoryName ? `Category: ${categoryName}` : "",
    instanceType ? `Type: ${instanceType}` : "",
    "",
    "Return only the summary text.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.3,
    max_tokens: 220,
  });

  const summary = completion.choices?.[0]?.message?.content?.trim() || "";
  if (!summary) throw new Error("Failed to generate service summary");
  return summary.slice(0, 1200);
}

