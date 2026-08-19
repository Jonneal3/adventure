"""
Business service → customer-facing labels (store-once taxonomy helpers).

Does not invent a full industry tree. Given a business subcategory name/summary,
produce a customer-understandable card label and visual eligibility flag.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


# Business jargon → simpler customer phrasing.
_REWRITE_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^hardscaping$", re.I), "Patios, walkways & outdoor structures"),
    (re.compile(r"^landscaping$", re.I), "Yard & garden design"),
    (re.compile(r"^landscape design$", re.I), "Outdoor design"),
    (re.compile(r"^outdoor living$", re.I), "Outdoor living spaces"),
    (re.compile(r"^bathroom remodels?$", re.I), "Bathroom remodel"),
    (re.compile(r"^bathroom remodeling$", re.I), "Bathroom remodel"),
    (re.compile(r"^kitchen remodels?$", re.I), "Kitchen remodel"),
    (re.compile(r"^kitchen remodeling$", re.I), "Kitchen remodel"),
    (re.compile(r"^interior design$", re.I), "Interior design"),
    (re.compile(r"^flooring$", re.I), "New flooring"),
)


_NON_VISUAL_HINTS = re.compile(
    r"consult|inspection|permit|estimate only|maintenance plan|warranty|hoa|financing",
    re.I,
)


def customer_label_for_service(
    *,
    business_label: str,
    service_summary: str = "",
    stored_customer_label: str = "",
) -> Dict[str, Any]:
    stored = str(stored_customer_label or "").strip()
    business = str(business_label or "").strip() or "Project"
    if stored:
        return {
            "businessLabel": business,
            "customerLabel": stored,
            "visualEligible": not bool(_NON_VISUAL_HINTS.search(f"{business} {service_summary}")),
            "source": "stored",
        }

    for pattern, replacement in _REWRITE_RULES:
        if pattern.search(business):
            return {
                "businessLabel": business,
                "customerLabel": replacement,
                "visualEligible": True,
                "source": "ai_rules",
            }

    # Soft cleanup: drop trailing "(service)", collapse "Remodeling" → "Remodel".
    cleaned = re.sub(r"\s*\(service\)\s*$", "", business, flags=re.I).strip()
    cleaned = re.sub(r"\bRemodeling\b", "Remodel", cleaned)
    visual = not bool(_NON_VISUAL_HINTS.search(f"{cleaned} {service_summary}"))
    return {
        "businessLabel": business,
        "customerLabel": cleaned or business,
        "visualEligible": visual,
        "source": "derived",
    }


def translate_services(services: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for raw in services or []:
        if not isinstance(raw, dict):
            continue
        business = str(raw.get("businessLabel") or raw.get("label") or raw.get("name") or "").strip()
        summary = str(raw.get("serviceSummary") or raw.get("summary") or "").strip()
        stored = str(raw.get("customerLabel") or raw.get("customer_label") or "").strip()
        sid = str(raw.get("id") or raw.get("value") or raw.get("serviceId") or "").strip()
        translated = customer_label_for_service(
            business_label=business,
            service_summary=summary,
            stored_customer_label=stored,
        )
        out.append({"id": sid, **translated, "serviceSummary": summary})
    return out


def persist_payload(
    *,
    subcategory_id: str,
    customer_label: str,
    visual_eligible: bool = True,
) -> Dict[str, Any]:
    """Shape for a designer/widget write-back (caller owns the DB update)."""
    return {
        "id": subcategory_id,
        "customer_label": customer_label,
        "visual_eligible": visual_eligible,
    }


__all__ = [
    "customer_label_for_service",
    "translate_services",
    "persist_payload",
]
