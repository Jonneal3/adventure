import { z } from "zod";

export const priceRangeSchema = z.object({
  currency: z.literal("USD"),
  minCents: z.number().int().positive(),
  maxCents: z.number().int().positive(),
  source: z.enum(["curated", "owner"]),
}).refine(value => value.maxCents >= value.minCents, "Maximum must be at least minimum");
export type PriceRange = z.infer<typeof priceRangeSchema>;

export const visualJobSchema = z.enum(["none", "scene", "tryon"]);
export type VisualJob = z.infer<typeof visualJobSchema>;

const choiceSchema = z.object({ value: z.string().min(1), label: z.string().min(1) });
export const formElementSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  kind: z.enum(["service", "single_choice", "multi_choice", "text", "number", "measurement", "upload", "visual", "contact", "price", "quote"]),
  label: z.string().trim().min(1).max(180),
  required: z.boolean(),
  serviceIds: z.array(z.string().uuid()).default([]),
  options: z.array(choiceSchema).default([]),
  unit: z.string().max(32).optional(),
  visualJob: visualJobSchema.optional(),
});
export type FormElement = z.infer<typeof formElementSchema>;

export const servicePresetSchema = z.object({
  id: z.string().uuid(),
  industryId: z.string().uuid(),
  name: z.string().trim().min(1),
  visualJob: visualJobSchema,
  defaultRange: priceRangeSchema.nullable(),
  elements: z.array(formElementSchema),
});
export type ServicePreset = z.infer<typeof servicePresetSchema>;

export const experienceSchema = z.object({
  schemaVersion: z.literal(1),
  industryId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  elements: z.array(formElementSchema),
  priceRanges: z.record(z.string().uuid(), priceRangeSchema),
  branding: z.object({ heading: z.string().max(180), accent: z.string().max(32), logoAssetId: z.string().uuid().nullable() }),
});
export type Experience = z.infer<typeof experienceSchema>;

const terminal: FormElement[] = [
  { id: "contact", kind: "contact", label: "Your contact details", required: true, serviceIds: [], options: [] },
  { id: "price", kind: "price", label: "Your estimated range", required: true, serviceIds: [], options: [] },
  { id: "quote", kind: "quote", label: "Request a final quote", required: true, serviceIds: [], options: [] },
];

export function composeExperience(industryId: string, presets: ServicePreset[]): Experience {
  if (!presets.length || presets.some(p => p.industryId !== industryId)) throw new Error("Select services from one industry");
  const serviceIds = [...new Set(presets.map(p => p.id))];
  const elements: FormElement[] = [
    { id: "service", kind: "service", label: "What service do you need?", required: true, serviceIds: [], options: presets.map(p => ({ value: p.id, label: p.name })) },
  ];
  for (const preset of presets) {
    for (const element of preset.elements) {
      if (["service", "contact", "price", "quote"].includes(element.kind)) continue;
      elements.push({ ...element, id: `s_${preset.id}_${element.id}`, serviceIds: [preset.id] });
    }
    if (preset.visualJob !== "none" && !preset.elements.some(e => e.kind === "visual")) {
      elements.push({ id: `s_${preset.id}_visual`, kind: "visual", label: "See your project", required: false, serviceIds: [preset.id], options: [], visualJob: preset.visualJob });
    }
  }
  elements.push(...terminal);
  const priceRanges: Record<string, PriceRange> = {};
  for (const preset of presets) if (preset.defaultRange) priceRanges[preset.id] = preset.defaultRange;
  return { schemaVersion: 1, industryId, serviceIds, elements, priceRanges, branding: { heading: "Plan your project", accent: "#2563eb", logoAssetId: null } };
}

export function validateForPublication(input: unknown): Experience {
  const experience = experienceSchema.parse(input);
  if (new Set(experience.serviceIds).size !== experience.serviceIds.length) throw new Error("Duplicate service");
  if (new Set(experience.elements.map(e => e.id)).size !== experience.elements.length) throw new Error("Duplicate element");
  for (const kind of ["service", "contact", "price", "quote"] as const) {
    const matching = experience.elements.filter(e => e.kind === kind);
    if (matching.length !== 1 || !matching[0].required) throw new Error(`One required ${kind} element is needed`);
  }
  if (experience.elements[0]?.kind !== "service") throw new Error("Service selection must be first");
  if (JSON.stringify(experience.elements[0].options.map(option => option.value).sort()) !== JSON.stringify([...experience.serviceIds].sort())) throw new Error("Service choices must match the offered services");
  const contact = experience.elements.findIndex(e => e.kind === "contact");
  const price = experience.elements.findIndex(e => e.kind === "price");
  const quote = experience.elements.findIndex(e => e.kind === "quote");
  if (!(contact < price && price < quote)) throw new Error("Contact, price, and quote must remain in order");
  for (const id of experience.serviceIds) {
    if (!experience.priceRanges[id]) throw new Error(`A range is required for service ${id}`);
  }
  for (const element of experience.elements) {
    if (element.serviceIds.some(id => !experience.serviceIds.includes(id))) throw new Error("Element references an unavailable service");
    if (["single_choice", "multi_choice", "service"].includes(element.kind) && !element.options.length) throw new Error(`Choices are required for ${element.id}`);
    if (element.kind === "visual" && !element.visualJob) throw new Error(`Visual job is required for ${element.id}`);
    if (element.kind === "visual" && (element.visualJob === "none" || element.serviceIds.length !== 1 || element.required)) throw new Error(`Visual step ${element.id} must be optional and belong to one service`);
  }
  return experience;
}

export function elementsForService(experience: Experience, serviceId: string): FormElement[] {
  if (!experience.serviceIds.includes(serviceId)) throw new Error("Service is unavailable");
  return experience.elements.filter(element => !element.serviceIds.length || element.serviceIds.includes(serviceId));
}

export function revealedPrice(experience: Experience, serviceId: string): PriceRange {
  const range = experience.priceRanges[serviceId];
  if (!range || !experience.serviceIds.includes(serviceId)) throw new Error("Service price is unavailable");
  return structuredClone(range);
}
