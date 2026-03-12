# Pricing examples

Pricing few-shot examples live in the parent directory:

- **[../pricing_examples.json](../pricing_examples.json)** — Single consolidated JSON array of ~20 examples (industry-agnostic). Used by the VLM in `replicate_vlm.py` for few-shot prompting. Each item has `context` (service_summary, industry, service), `image_price_range`, and `service_price_range` (intentionally wide ranges, e.g. $5k–$150k).

The old per-file examples (example_01_*.json through example_05_*.json) were removed in favor of that single file.

## API output shape (frontend contract)

The pricing API response includes:

- `rangeLow` / `rangeHigh` — integers, whole dollars (image/design estimate).
- `servicePriceRange` — optional `{ low, high }` for the full typical range for the service type.
- `currency`, `confidence`, `requestId`, etc.
