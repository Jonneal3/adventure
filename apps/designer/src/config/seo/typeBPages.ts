export type TypeBKind = "guide" | "problem" | "workflow";

export type TypeBSection = {
  body: string[];
  heading: string;
};

export type TypeBPage = {
  description: string;
  kind: TypeBKind;
  lede: string;
  related?: { href: string; label: string }[];
  sections: TypeBSection[];
  slug: string;
  title: string;
};

export const TYPE_B_PAGES: TypeBPage[] = [
  {
    description:
      "Why service customers hesitate when they can’t see the outcome, and a simple workflow to create alignment before pricing.",
    kind: "problem",
    lede:
      "Most “no response after the estimate” isn’t price — it’s uncertainty. If a buyer can’t picture the finished result, they delay, comparison-shop, or ask for endless revisions.",
    related: [{ href: "/workflows/visual-pre-selling-before-pricing", label: "Workflow: visual pre-selling before pricing" }],
    sections: [
      {
        body: [
          "Leads ask for a quote without clear direction, then go silent when you follow up.",
          "Buyers request multiple options because they can’t compare outcomes in their own space.",
          "Install or project teams inherit mismatched expectations from sales conversations.",
        ],
        heading: "What this problem looks like",
      },
      {
        body: [
          "Text and measurements don’t translate into a mental picture for most buyers.",
          "A quote request is a commitment, and buyers avoid committing when the outcome is fuzzy.",
          "Photos and examples help, but they often don’t match the buyer’s actual site.",
        ],
        heading: "Why it happens",
      },
      {
        body: [
          "Give the buyer a realistic preview in their own photo before you price the job.",
          "Capture the key choices you price against (style, layout, scope) alongside the preview.",
          "Use the preview as the shared reference for sales, estimating, and delivery.",
        ],
        heading: "The fix: preview → choices → pricing",
      },
    ],
    slug: "customers-cant-visualize-before-quote",
    title: "Customers can’t visualize before the quote",
  },
  {
    description:
      "Quote forms collect contact info, not alignment. This page explains what’s missing and how to reduce buyer friction.",
    kind: "problem",
    lede:
      "Forms are good at collecting fields. They are bad at creating clarity. If the customer can’t confirm the look, the quote request is often just a low-intent probe.",
    related: [{ href: "/workflows/visual-pre-selling-before-pricing", label: "Workflow: visual pre-selling before pricing" }],
    sections: [
      {
        body: [
          "They don’t help the buyer choose between real options (style, finish, layout).",
          "They can’t show tradeoffs like scale, placement, or coverage.",
          "They produce vague scope, which leads to delays, mismatched expectations, and ghosting.",
        ],
        heading: "What quote forms miss",
      },
      {
        body: [
          "A short preview experience that lets the buyer see a likely outcome in their own photo.",
          "A small set of choices that map to pricing and delivery (not open-ended prompts).",
          "A captured preview you can reference in follow-ups and onsite visits.",
        ],
        heading: "What converts better",
      },
    ],
    slug: "why-get-a-quote-forms-dont-convert",
    title: "Why “Get a Quote” forms don’t convert",
  },
  {
    description:
      "A simple, repeatable flow contractors can use to align customers on the outcome before pricing: photo → options → preview → lead.",
    kind: "workflow",
    lede:
      "This workflow is designed to reduce indecision and speed up approvals. It focuses on alignment and scope clarity — not “AI art.”",
    related: [
      { href: "/problems/customers-cant-visualize-before-quote", label: "Problem: customers can’t visualize before the quote" },
      { href: "/guides/reducing-design-revisions-in-services", label: "Guide: reducing design revisions" },
    ],
    sections: [
      {
        body: [
          "Use the customer’s site photo so the preview is anchored to the real environment.",
          "This increases trust and reduces “looks different in my space” objections.",
        ],
        heading: "Step 1: start with a real photo",
      },
      {
        body: [
          "Expose the few decisions that change scope and price (style, layout, materials).",
          "Avoid open text prompts — they increase variation but reduce sales alignment.",
        ],
        heading: "Step 2: offer constrained, price-relevant options",
      },
      {
        body: [
          "Treat the output as a shared reference, not a final design.",
          "Save the selected options with the lead so follow-up is specific and fast.",
        ],
        heading: "Step 3: generate the preview and capture the choices",
      },
      {
        body: [
          "Send the preview back to the buyer, then price against the chosen direction.",
          "This reduces ghosting and cuts down “can you quote 3 more options?” loops.",
        ],
        heading: "Step 4: use the preview in follow-up",
      },
    ],
    slug: "visual-pre-selling-before-pricing",
    title: "Workflow: visual pre-selling before pricing",
  },
  {
    description:
      "How to cut back-and-forth revisions by creating early alignment on the outcome, scope, and constraints using customer photos and option sets.",
    kind: "guide",
    lede:
      "Revisions aren’t just a design problem — they’re a scope clarity problem. The goal is to agree on direction early, then price and deliver against that shared reference.",
    related: [{ href: "/workflows/visual-pre-selling-before-pricing", label: "Workflow: visual pre-selling before pricing" }],
    sections: [
      {
        body: [
          "Customers choose too late because they haven’t seen realistic outcomes.",
          "Sales teams capture intent in text, but delivery teams need visual references.",
          "Option overload creates decision fatigue, which looks like “can we see one more version?”",
        ],
        heading: "Why revisions happen",
      },
      {
        body: [
          "Start with a customer photo and show a preview tied to that photo.",
          "Constrain options to the choices you can actually price and deliver consistently.",
          "Use the preview as the reference in your quote, contract, and kickoff notes.",
        ],
        heading: "How to reduce revisions",
      },
      {
        body: [
          "Before pricing: qualify direction and reduce low-intent quote requests.",
          "After pricing: confirm expectations and reduce change orders.",
          "Before install or project start: align teams on what the buyer approved.",
        ],
        heading: "Where the preview fits",
      },
    ],
    slug: "reducing-design-revisions-in-services",
    title: "Guide: reducing design revisions in service businesses",
  },
];

export function getTypeBPage(kind: TypeBKind, slug: string) {
  const normalized = String(slug || "").trim();
  return TYPE_B_PAGES.find((p) => p.kind === kind && p.slug === normalized) || null;
}

export function getTypeBPaths() {
  return TYPE_B_PAGES.map((p) => {
    const base = p.kind === "problem" ? "/problems" : p.kind === "workflow" ? "/workflows" : "/guides";
    return `${base}/${p.slug}`;
  });
}

