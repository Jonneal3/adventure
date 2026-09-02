"""Deterministic prompts grounded in a validated priceable manifest."""

from __future__ import annotations

import json
from typing import Any, Mapping

from programs.gallery_enrichment.manifest import validate_manifest
from programs.gallery_enrichment.registry import get_family


def _component_phrase(component: Mapping[str, Any], definition: Any) -> str:
    quantity = component["quantity"]
    details = [
        definition.after_description,
        f"quantity approximately {quantity['likely']:g} {quantity['unit']}",
        f"{component['tier']} tier",
    ]
    if component.get("subtypeKey"):
        details.append(f"subtype {component['subtypeKey'].replace('_', ' ')}")
    if component.get("materialKey"):
        details.append(f"material {component['materialKey'].replace('_', ' ')}")
    if component.get("attributes"):
        details.extend(f"{key.replace('_', ' ')} {value.replace('_', ' ')}" for key, value in component["attributes"].items())
    return "; ".join(details)


def build_after_prompt(manifest: Any, *, concept_description: str = "") -> str:
    validated = validate_manifest(manifest)
    if not validated.valid or not validated.manifest:
        raise ValueError("invalid manifest: " + "; ".join(validated.errors))
    normalized = validated.manifest
    family = get_family(normalized["pricingFamily"])
    if not family:
        raise ValueError("unsupported pricing family")
    component_lines = [
        f"- {_component_phrase(component, family.components[component['componentKey']])}"
        for component in normalized["components"]
    ]
    description = str(concept_description or "").strip()
    return (
        f"Create one photorealistic finished {family.label.lower()} scene. "
        "Show a single coherent photograph, never a collage, split screen, diagram, or labeled image. "
        "Depict every registered scope item below clearly and realistically, and do not add unrelated renovation, "
        "service, furniture, fixture, or decorative scope. Preserve plausible construction, scale, joins, reflections, "
        "hands, text-free surfaces, and real-world geometry.\n"
        + (f"Concept direction: {description}\n" if description else "")
        + "Required registered scope:\n"
        + "\n".join(component_lines)
        + "\nNo text, logos, captions, watermarks, prices, people, duplicated fixtures, or impossible geometry."
    )


def build_before_prompt(manifest: Any, *, failure_reasons: Any = None) -> str:
    validated = validate_manifest(manifest)
    if not validated.valid or not validated.manifest:
        raise ValueError("invalid manifest: " + "; ".join(validated.errors))
    normalized = validated.manifest
    family = get_family(normalized["pricingFamily"])
    if not family:
        raise ValueError("unsupported pricing family")
    strategies = [
        f"- {family.components[component['componentKey']].label}: "
        f"{family.components[component['componentKey']].before_strategy}"
        for component in normalized["components"]
    ]
    failures = [str(value).strip() for value in (failure_reasons or []) if str(value or "").strip()]
    retry = f"\nCorrect these prior verification failures: {'; '.join(failures)}" if failures else ""
    return (
        "Edit the supplied AFTER image into one plausible AI-generated illustrative BEFORE photograph. "
        "Preserve exactly the camera position, crop, perspective, lens feel, lighting direction, architecture, "
        "property boundaries, openings, fixed-object positions, fixture counts, zone counts, and scene identity. "
        "Downgrade or remove only the registered improved components below. The before must look ordinary, clean, "
        "maintained, and believable—not damaged, abandoned, dirty, unsafe, or theatrically ugly. Do not add new work.\n"
        "Registered downgrade strategies:\n"
        + "\n".join(strategies)
        + retry
        + "\nReturn one photorealistic image with no labels, text, arrows, split screen, watermark, or people."
    )


def manifest_prompt_contract(manifest: Mapping[str, Any]) -> str:
    return json.dumps(manifest, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


__all__ = ["build_after_prompt", "build_before_prompt", "manifest_prompt_contract"]
