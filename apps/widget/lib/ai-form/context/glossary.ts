// Deterministic glossary + “typical ranges” used to make questions layman-friendly.
// This is intentionally small to start; you can expand it over time and/or store per-subcategory in DB.

export type GlossaryEntry = {
  key: string;
  terms: string[];
  definition: string;
  examples?: string[];
  typical?: { min?: number; max?: number; unit?: string; note?: string };
};

export function buildGlossaryText(params: { subcategoryName?: string | null; categoryName?: string | null }) {
  const entries: GlossaryEntry[] = [];

  // Generic guidance (safe for any service).
  entries.push({
    key: "not_sure",
    terms: ["not sure", "typical"],
    definition:
      "If you’re not sure, it’s okay—pick your best guess. We’ll use defaults and refine based on what you like/dislike.",
  });

  const lines: string[] = [];
  lines.push("Copywriting style rules:");
  lines.push("- Assume the buyer does not know industry norms.");
  lines.push("- Never ask for a number without giving a typical range and 1–2 examples.");
  lines.push("- Avoid jargon; if unavoidable, define it in plain English.");
  lines.push("- Provide a “Not sure” escape hatch when possible.");
  lines.push("");
  lines.push("Glossary:");
  for (const e of entries) {
    lines.push(`- ${e.terms.join(", ")}: ${e.definition}`);
    if (e.typical && (e.typical.min !== undefined || e.typical.max !== undefined)) {
      lines.push(
        `  Typical: ${e.typical.min ?? "?"}–${e.typical.max ?? "?"}${e.typical.unit ? " " + e.typical.unit : ""}${
          e.typical.note ? ` (${e.typical.note})` : ""
        }`
      );
    }
    if (e.examples && e.examples.length > 0) {
      for (const ex of e.examples.slice(0, 3)) lines.push(`  Example: ${ex}`);
    }
  }
  return { entries, text: lines.join("\n") };
}

export function findGlossaryEntryForQuestion(params: {
  question: string;
  subcategoryName?: string | null;
  categoryName?: string | null;
}): GlossaryEntry | null {
  const q = String(params.question || "").toLowerCase();
  const { entries } = buildGlossaryText({ subcategoryName: params.subcategoryName, categoryName: params.categoryName });
  for (const e of entries) {
    if (e.terms.some((t) => q.includes(t))) return e;
  }
  return null;
}


