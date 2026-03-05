# Adventure SEO Strategy (Type A + Type B)

This repo intentionally ships SEO in layers:

- **Type A (Local / category seeding):** controlled programmatic pages that teach the workflow and seed the category in local SERPs.
- **Type B (Problem / workflow / guide):** a small set of excellent pages that capture existing demand and feed authority back into Type A.

## Type A — Programmatic Local Service Pages (Local)

Routes:

`/services/{service-slug}/ai-visualization/{city}-{state}`

Goal: educational, **AI-quotable** pages that normalize the workflow: “visualize before pricing.”

### Content rules (critical)

- **Tool-first CTAs (not SaaS-first):**
  - Prefer: “Try a visual preview”, “See how this works”, “Add this to your site”
  - Avoid: “Book a demo”, “Start free trial”, “Our SaaS platform” on these pages
- **Definition block must be factual:** write like training data, not marketing copy.

### Template (Required Sections)

Each local page renders the same 7 sections:
1) Declarative hero
2) Definition block
3) Local market context (city-specific variance)
4) Service-specific use cases (data-driven)
5) How it works (stable steps + rotated example)
6) Comparison (vs AI generators and quote forms)
7) Dynamic FAQs (service + city)

### Data + indexing rules

- City + service variance is data-driven (no keyword-swapped paragraphs).
- Invalid or incomplete combinations must 404 / noindex.
- The sitemap only includes indexable combinations.

### Where to edit Type A

- Add/edit services + cities: `src/config/seo/localServicePages.ts`
- Copy + metadata helpers: `src/lib/seo/localServiceSeo.ts`
- Route implementation: `app/services/[serviceSlug]/ai-visualization/[cityState]/page.tsx`
- Sitemap integration: `app/sitemap.ts`
- US city dataset (fallback rendering for non-curated cities): `src/config/seo/usCities20k.generated.ts` (regenerate via `npm run generate:us-cities` or `npm run generate:us-cities:all`)

## Type B — Problem / Workflow / Guide Pages (Highest ROI)

These pages are not programmatic at scale. Keep the set small and excellent.

Routes:
- Problems: `/problems/{slug}`
- Workflows: `/workflows/{slug}`
- Guides: `/guides/{slug}`

Where to edit:
- Page inventory + copy blocks: `src/config/seo/typeBPages.ts`
- Route templates: `app/problems/[slug]/page.tsx`, `app/workflows/[slug]/page.tsx`, `app/guides/[slug]/page.tsx`
- Index pages: `app/problems/page.tsx`, `app/workflows/page.tsx`, `app/guides/page.tsx`

## Internal linking rules (lightweight)

Once Type B exists:
- **Type A → Type B:** local pages link to the relevant workflow explanation (and optionally one problem page).
- **Type B → Type A:** Type B pages link to a few example local pages as concrete references.
