from __future__ import annotations

import dspy


class SubcategoryScopeSuggesterSignature(dspy.Signature):
    """
    Propose early-step "scope" checklist items: concrete parts of the job a customer
    might want (select all that apply), specific to the industry and service.
    """

    scope_context_json: str = dspy.InputField(
        desc=(
            "JSON with industry/category name, service name, service summary, optional company summary, "
            "and refinement components (visual parts of the offering). Use these to infer realistic scope splits."
        )
    )
    min_scope_count: int = dspy.InputField(desc="Minimum number of scope items (typically 3).")
    max_scope_count: int = dspy.InputField(desc="Maximum number of scope items (typically 8).")

    scope_options_json: str = dspy.OutputField(
        desc='A single JSON object: {"scopes": ["Short label 1", "..."]} — short phrase per line, no markdown.'
    )


SCOPE_SUGGESTER_INSTRUCTIONS = """
You generate a SELECT-ALL-THAT-APPLY parts checklist for a home-services intake Focus step.

Rules:
- Output ONLY valid JSON: an object with a single key "scopes" whose value is an array of strings.
- Between min_scope_count and max_scope_count items (inclusive). Prefer 12–18 when allowed.
- Each string is a concrete PROJECT ELEMENT / PART the customer might include (2–5 words).
- Examples: "Outdoor grill", "Patio / terrace", "Vanity", "Floor tile", "Fire pit", "Lighting" —
  NOT coarse buckets like "Full remodel", "Backyard only", or "Cosmetic refresh".
- Must be realistic for the given industry and service; use refinement components as decomposition hints.
- No duplicates; no "Other", "Full renovation", "Not sure", or administrative options.
- No pricing, timelines, or questions — only includable parts of the job.
"""


SubcategoryScopeSuggesterSignature.__doc__ = SCOPE_SUGGESTER_INSTRUCTIONS

__all__ = ["SubcategoryScopeSuggesterSignature", "SCOPE_SUGGESTER_INSTRUCTIONS"]
