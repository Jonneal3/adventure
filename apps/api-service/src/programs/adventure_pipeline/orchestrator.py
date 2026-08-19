"""
Adventure V7 pipeline — thin orchestration over existing image + pricing programs.

Does NOT replace form_pipeline / image_generator / pricing. It decides:
- when to use ontology vs inference
- how to build a GenerationSpec
- how to call generate_image / estimate_pricing with a clean V7 contract
"""

from __future__ import annotations

import hashlib
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from programs.adventure_pipeline.budget_bands import propose_budget_bands
from programs.adventure_pipeline.consult import consult
from programs.adventure_pipeline.curation import curation_bundle
from programs.adventure_pipeline.discovery import discovery_page
from programs.adventure_pipeline.intent_router import plan_for_mode
from programs.adventure_pipeline.interpret import interpret_instruction
from programs.adventure_pipeline.library import fetch_library_candidates
from programs.adventure_pipeline.model_router import choose_model
from programs.adventure_pipeline.ontology import (
    attribute_pool,
    savings_levers,
    upgrade_levers,
)
from programs.adventure_pipeline.retrieval import (
    normalize_library_candidates,
    rank_library,
    retrieval_mix,
)
from programs.adventure_pipeline.schemas import (
    DesignState,
    GenerationSpec,
    Modification,
    TasteProfile,
    TasteTag,
    design_from_project,
    project_from_payload,
)
from programs.adventure_pipeline.step_contracts import can_advance, contracts_overview
from programs.adventure_pipeline.taxonomy import translate_services
from programs.adventure_pipeline.vision import analyze_photo, analyze_taste
from programs.image_generator.orchestrator import generate_image
from programs.pricing.orchestrator import estimate_pricing


def _hash_seed(value: str) -> int:
    return int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:8], 16)


def _normalize_urls(raw: Any) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            url = str(item.get("url") or item.get("src") or "").strip()
            if url:
                out.append(url)
    return out


def parse_design_state(payload: Dict[str, Any]) -> DesignState:
    """Parse legacy flat or nested ProjectState payloads into DesignState."""
    body = payload if isinstance(payload, dict) else {}
    design_raw = body.get("design") if isinstance(body.get("design"), dict) else body
    # Merge top-level favorites/overrides that older clients send beside design.
    merged = dict(design_raw)
    if body.get("favoriteUrls") and not merged.get("favoriteUrls"):
        merged["favoriteUrls"] = body.get("favoriteUrls")
    if body.get("instanceId") and not merged.get("instanceId"):
        merged["instanceId"] = body.get("instanceId")
    project = project_from_payload(merged)
    # Prefer explicit favoriteUrls list when provided (inspiration ids may be empty).
    favorites = _normalize_urls(
        merged.get("favoriteUrls") or merged.get("favorite_urls") or body.get("favoriteUrls")
    )
    if favorites:
        project.selection.inspiration_ids = favorites
    design = design_from_project(project)
    design.favorite_urls = favorites or list(design.favorite_urls)
    return design


def parse_project_state(payload: Dict[str, Any]):
    design = parse_design_state(payload)
    return design.to_project_state()


def _ontology_tags(design: DesignState) -> List[TasteTag]:
    """Deterministic fallback ranking when vision is unavailable."""
    pool = attribute_pool(design.service_label or design.service_id, design.scope)
    seed = "|".join(design.favorite_urls) or f"{design.service_id}:{design.scope}"
    start = _hash_seed(seed) % max(len(pool), 1)
    rotated = pool[start:] + pool[:start]
    picks = rotated[: min(8, max(6, len(rotated)))]
    favorites = design.favorite_urls or ([design.photo_url] if design.photo_url else [])

    tags: List[TasteTag] = []
    for i, (path, label) in enumerate(picks):
        src = favorites[i % len(favorites)] if favorites else ""
        focal = _hash_seed(f"{seed}:{path}")
        tags.append(
            TasteTag(
                id=f"taste-{i + 1}",
                label=label,
                attributePath=path,
                imageUrl=src or "",
                focalX=20 + (focal % 60),
                focalY=20 + ((focal >> 3) % 60),
                selected=i < 5,
            )
        )
    return tags


def infer_taste(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Read the customer's favorites with a vision model and report the attributes it
    sees, inside the ontology's closed vocabulary. The customer edits the result —
    they never classify images from scratch. Falls back to ontology ranking.
    """
    design = parse_design_state(payload)
    service = design.service_label or design.service_id
    pool = attribute_pool(service, design.scope)
    favorites = list(design.favorite_urls)
    if design.photo_url:
        favorites = [*favorites, design.photo_url]

    observations = analyze_taste(
        image_urls=favorites,
        service_label=service,
        scope=design.scope,
        vocabulary=pool,
    )

    if observations:
        tags = [
            TasteTag(
                id=f"taste-{i + 1}",
                label=str(obs["label"]),
                attributePath=str(obs["attributePath"]),
                imageUrl=str(obs.get("imageUrl") or ""),
                focalX=float(obs.get("focalX") or 50),
                focalY=float(obs.get("focalY") or 50),
                # Pre-check what the model is confident about; the rest are offered, not asserted.
                selected=float(obs.get("confidence") or 0) >= 0.6,
            )
            for i, obs in enumerate(observations)
        ]
        # Observations arrive ranked. Pre-checking all of them turns confirmation into a
        # rubber stamp, so cap it and leave the tail as genuine choices.
        confident = [t for t in tags if t.selected]
        if not confident:
            for t in tags[: min(5, len(tags))]:
                t.selected = True
        elif len(confident) > 5:
            for t in confident[5:]:
                t.selected = False
        source = "vision"
    else:
        tags = _ontology_tags(design)
        source = "ontology"

    profile = TasteProfile(
        tags=tags,
        confirmedIds=[t.id for t in tags if t.selected],
        source=source,  # type: ignore[arg-type]
    )
    design.taste = profile
    return {
        "ok": True,
        "taste": profile.model_dump(by_alias=True),
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def build_generation_spec(
    design: DesignState,
    *,
    mode: str,
    instruction: str = "",
    num_outputs: int = 8,
    modification: Optional[Modification] = None,
) -> GenerationSpec:
    confirmed = set(design.taste.confirmed_ids or [])
    active_tags = [t for t in design.taste.tags if (not confirmed) or t.id in confirmed]
    if not active_tags:
        active_tags = list(design.taste.tags)

    visual_style = [t.label for t in active_tags if t.attribute_path.startswith("style.") or t.attribute_path.startswith("palette.")]
    materials = [t.label for t in active_tags if t.attribute_path.startswith("materials.") or t.attribute_path.startswith("planting.")]
    features = [t.label for t in active_tags if t.attribute_path.startswith("features.") or t.attribute_path.startswith("lighting.") or t.attribute_path.startswith("fixtures.")]

    instr = (instruction or design.refine_note or "").strip()
    avoid = list(design.avoid)
    must = list(design.must_include) + features

    if instr:
        mod = modification or interpret_instruction(design, instr)
        must = must + [m for m in mod.must_include if m not in must]
        avoid = avoid + [a for a in mod.avoid if a not in avoid]
        if mod.keep:
            must = must + [f"keep {k}" for k in mod.keep[:2]]

    service_name = design.customer_service_label or design.service_label or "Project"
    scope_text = design.scope or ", ".join(design.scopes) or ""
    project = f"{service_name}"
    if scope_text:
        project = f"{project} — {scope_text}"

    # Scope parts are the visual brief — vanity + flooring must show up, not a generic room.
    for part in list(design.scopes or []):
        label = str(part or "").strip()
        if not label or re.match(r"^(full |whole |complete )", label, re.I) or re.match(r"^other$", label, re.I):
            continue
        if label not in must:
            must.append(label)

    mode_norm = mode if mode in ("inspiration", "ideas", "refine", "final") else "ideas"
    refs = list(design.favorite_urls)
    # For the ideas restyle, the photo is the scene — keep favorites as style references only.
    if design.photo_url and mode_norm != "ideas":
        refs = [design.photo_url, *refs]

    # Photo analysis constraints become hard must/avoid guidance when present.
    if isinstance(design.photo_analysis, dict):
        for c in design.photo_analysis.get("constraints") or []:
            note = str(c).strip()
            if note and note not in must:
                must.append(f"respect: {note}")
        for m in design.photo_analysis.get("materials") or []:
            mat = str(m).strip()
            if mat and mat not in materials:
                materials.append(mat)

    return GenerationSpec(
        projectContext=project,
        visualStyle=visual_style[:6] or ["clean contemporary"],
        materials=materials[:6],
        composition="cohesive residential design, photoreal, square crop friendly",
        constraints=[
            f"Stay realistic for about ${int(design.budget or 0)}",
            "No text, logos, or watermarks",
        ],
        budgetTarget=float(design.budget or 0),
        mustInclude=must[:10],
        avoid=avoid[:10] or ["clutter", "text overlays"],
        instruction=instr,
        mode=mode_norm,  # type: ignore[arg-type]
        numOutputs=num_outputs,
        referenceImages=refs[:4],
    )


def _one_url(item: Any) -> str:
    if isinstance(item, str) and item.strip():
        return item.strip()
    if isinstance(item, dict):
        return str(item.get("url") or item.get("image") or item.get("src") or "").strip()
    url = getattr(item, "url", None)
    if callable(url):
        try:
            return str(url() or "").strip()
        except Exception:
            return ""
    if isinstance(url, str):
        return url.strip()
    return ""


def _extract_image_urls(provider_resp: Dict[str, Any]) -> List[str]:
    raw: List[Any] = []
    out = provider_resp.get("output")
    if isinstance(out, list):
        raw.extend(out)
    elif out:
        raw.append(out)
    images = provider_resp.get("images")
    if isinstance(images, list):
        raw.extend(images)
    seen: set[str] = set()
    deduped: List[str] = []
    for item in raw:
        url = _one_url(item)
        if url and url not in seen:
            seen.add(url)
            deduped.append(url)
    return deduped


def _library_images(payload: Dict[str, Any], *, limit: int) -> List[Dict[str, Any]]:
    """Backward-compatible unwrap — prefer rank_library via generate_from_design. """
    return normalize_library_candidates(payload.get("libraryImages") or payload.get("library_images"))[:limit]


# Deterministic variation axes for the idea grid. The taste profile decides *what*
# the images contain; these decide how the set differs so the grid isn't nine near-duplicates.
_VARIATION_AXES: List[str] = [
    "wide establishing view, bright daylight",
    "closer three-quarter view, warm light",
    "cooler daylight, calmer palette",
    "evening light, layered lighting emphasis",
    "texture-forward composition",
    "simpler surfaces, more restraint",
    "more open composition with negative space",
    "material-forward composition",
    "softer diffuse light, relaxed styling",
]


def _generation_variants(design: DesignState, spec: GenerationSpec, count: int) -> List[Dict[str, Any]]:
    """Rotate emphasis across the confirmed taste so each tile is a distinct proposal."""
    confirmed = set(design.taste.confirmed_ids or [])
    labels = [t.label for t in design.taste.tags if (not confirmed) or t.id in confirmed]
    variants: List[Dict[str, Any]] = []
    for i in range(count):
        axis = _VARIATION_AXES[i % len(_VARIATION_AXES)]
        emphasis = labels[i % len(labels)] if labels else ""
        payload = spec.to_image_payload(instance_id=design.instance_id, design=design)
        payload["numOutputs"] = 1
        notes = str(payload.get("refinementNotes") or "").strip()
        extra = f"Variation {i + 1}: {axis}."
        if emphasis:
            extra = f"{extra} Emphasize {emphasis}."
        payload["refinementNotes"] = f"{notes} {extra}".strip()
        variants.append(payload)
    return variants


def _fanout_generate(design: DesignState, spec: GenerationSpec, count: int, overrides: Dict[str, Any]) -> List[str]:
    """
    One provider call per tile, in parallel. The scene models return a single image
    per request, so a grid is N concurrent requests rather than one batch.
    Default concurrency is 8 so an 8-up grid finishes in one wave.
    """
    variants = _generation_variants(design, spec, count)
    for payload in variants:
        payload.update(overrides)

    workers = max(1, min(len(variants), int(os.getenv("ADVENTURE_GEN_MAX_CONCURRENCY", "8") or 8)))
    results: List[Optional[str]] = [None] * len(variants)

    def _run(index: int) -> None:
        try:
            resp = generate_image(variants[index])
        except Exception:
            return
        urls = _extract_image_urls(resp) if isinstance(resp, dict) else []
        if urls:
            results[index] = urls[0]

    with ThreadPoolExecutor(max_workers=workers) as executor:
        list(executor.map(_run, range(len(variants))))

    seen: set[str] = set()
    out: List[str] = []
    for url in results:
        if url and url not in seen:
            seen.add(url)
            out.append(url)
    return out


def _budget_biased_design(design: DesignState, bias: str) -> DesignState:
    """Clone design with a temporary budget tilt for retrieval ranking."""
    if bias == "down":
        budget = max(2500.0, float(design.budget or 0) * 0.75)
    elif bias == "up":
        budget = max(2500.0, float(design.budget or 0) * 1.35)
    else:
        return design
    data = design.model_dump(by_alias=True)
    data["budget"] = budget
    return DesignState.model_validate(data)


def generate_from_design(payload: Dict[str, Any], *, mode: str) -> Dict[str, Any]:
    design = parse_design_state(payload)
    instruction = str(payload.get("instruction") or payload.get("refineNote") or "").strip()
    requested = int(payload.get("numOutputs") or (1 if mode in ("refine", "final") else 8))

    force_generate = bool(payload.get("forceGenerate") or payload.get("skipLibrary"))
    candidates = normalize_library_candidates(payload.get("libraryImages") or payload.get("library_images"))
    # Server-side library when the client didn't send enough catalog depth.
    # Skip when the caller wants a generated design (the V8 "here's your project" step).
    if not force_generate and len(candidates) < 4 and (design.service_id or design.instance_id):
        server_lib = fetch_library_candidates(
            service_id=design.service_id,
            instance_id=design.instance_id,
            scope_keys=design.scope_keys or design.scopes,
            limit=80,
        )
        if server_lib:
            merged = normalize_library_candidates([*candidates, *server_lib])
            candidates = merged
    if force_generate:
        candidates = []
    modification = interpret_instruction(design, instruction) if instruction else None
    plan = plan_for_mode(
        mode=mode,
        design=design,
        modification=modification,
        instruction=instruction,
        library_count=len(candidates),
        requested=requested,
    )

    # --- Retrieve path -------------------------------------------------------
    library: List[Dict[str, Any]] = []
    if plan.strategy in ("retrieve", "retrieve_then_generate") and candidates:
        mix = retrieval_mix(mode=mode, requested=requested, library_available=len(candidates))
        retrieve_n = plan.retrieve_limit or mix["library"]
        if mode in ("refine", "adjust") and plan.retrieve_limit:
            retrieve_n = plan.retrieve_limit
        rank_design = _budget_biased_design(design, plan.budget_bias)
        exclude = [design.selected_idea_url] if design.selected_idea_url else []
        library = rank_library(rank_design, candidates, limit=retrieve_n, exclude_urls=exclude)

    # Pure retrieve (e.g. spend-less found a library hit) — skip generation.
    if plan.strategy == "retrieve" and library:
        curation = curation_bundle(design=design, images=library, mode=mode, modification=modification)
        return {
            "ok": True,
            "mode": mode,
            "plan": plan.to_dict(),
            "generationSpec": None,
            "modification": modification.model_dump(by_alias=True) if modification else None,
            "images": library,
            "counts": {"library": len(library), "generated": 0, "requested": requested},
            "model": None,
            "provider": {"ok": True, "strategy": "retrieve"},
            "curation": curation,
            "design": design.model_dump(by_alias=True),
            "project": design.to_project_state().model_dump(by_alias=True),
            "error": None,
            "message": None,
        }

    # For refine retrieve_then_generate: if we got a library hit and strategy prefers it
    # as the answer (budget move / style shift), return it when we only need one tile.
    if (
        mode in ("refine", "adjust")
        and plan.strategy == "retrieve_then_generate"
        and library
        and requested <= 1
        and plan.prefer_library
    ):
        curation = curation_bundle(design=design, images=library, mode=mode, modification=modification)
        return {
            "ok": True,
            "mode": mode,
            "plan": plan.to_dict(),
            "generationSpec": None,
            "modification": modification.model_dump(by_alias=True) if modification else None,
            "images": library[:1],
            "counts": {"library": 1, "generated": 0, "requested": requested},
            "model": None,
            "provider": {"ok": True, "strategy": "retrieve"},
            "curation": curation,
            "design": design.model_dump(by_alias=True),
            "project": design.to_project_state().model_dump(by_alias=True),
            "error": None,
            "message": None,
        }

    if plan.strategy == "none":
        return {
            "ok": True,
            "mode": mode,
            "plan": plan.to_dict(),
            "images": [],
            "counts": {"library": 0, "generated": 0, "requested": 0},
            "design": design.model_dump(by_alias=True),
            "project": design.to_project_state().model_dump(by_alias=True),
            "message": plan.reason,
        }

    # --- Generate / edit path ------------------------------------------------
    num_outputs = max(0, requested - len(library)) if plan.strategy == "retrieve_then_generate" else max(1, requested)
    if mode in ("refine", "adjust", "final"):
        num_outputs = max(1, min(requested, 1 if plan.strategy in ("edit", "generate") else requested))
        library = []  # refine returns a single new version, not a mixed grid

    use_case = plan.use_case
    if plan.strategy == "edit" and design.selected_idea_url:
        use_case = "scene-refinement"
    elif mode == "ideas" and design.photo_url:
        # Restyle the customer's space — this is the "here's what your project could look like" beat.
        use_case = "scene-refinement"

    spec = build_generation_spec(
        design,
        mode=mode if mode != "adjust" else "refine",
        instruction=instruction,
        num_outputs=max(1, num_outputs),
        modification=modification,
    )
    # Force use_case on the payload via mode mapping in to_image_payload;
    # also pass explicit model from the adventure router.
    model = choose_model(
        mode=mode if mode != "adjust" else "refine",
        strategy=plan.strategy,
        use_case=use_case,
        has_reference=bool(spec.reference_images),
        has_scene=bool(design.selected_idea_url or (mode == "ideas" and design.photo_url)),
        explicit_model_id=str(payload.get("modelId") or "") or None,
    )

    overrides: Dict[str, Any] = {"modelId": model.model_id}
    for key in ("variationMode", "routingPolicy"):
        if payload.get(key) is not None:
            overrides[key] = payload.get(key)

    urls: List[str] = []
    result: Dict[str, Any] = {}
    ok = True
    if num_outputs > 1:
        urls = _fanout_generate(design, spec, num_outputs, overrides)
        ok = bool(urls)
        result = {"ok": ok, "fanout": {"requested": num_outputs, "returned": len(urls)}}
    elif num_outputs == 1:
        image_payload = spec.to_image_payload(instance_id=design.instance_id, design=design)
        # Ensure refine use-case sticks even if mode string differs.
        if use_case == "scene-refinement":
            image_payload["useCase"] = "scene-refinement"
            image_payload["sceneImage"] = design.selected_idea_url or design.photo_url
        image_payload.update(overrides)
        raw_result = generate_image(image_payload)
        result = raw_result if isinstance(raw_result, dict) else {"raw": raw_result}
        ok = bool(result.get("ok", True))
        urls = _extract_image_urls(result)

    generated = [
        {"id": f"{mode}-{i + 1}", "url": u, "label": f"Idea {i + 1}", "source": "generated"}
        for i, u in enumerate(urls)
    ]
    images = [*library, *generated]
    ok = bool(generated) or (
        ok
        and (
            bool(images)
            or str(result.get("status") or "").lower() in {"starting", "processing", "succeeded"}
        )
    )
    curation = curation_bundle(
        design=design,
        images=images,
        mode=mode,
        spec=spec,
        modification=modification,
        model_id=model.model_id,
    )

    return {
        "ok": ok,
        "mode": mode,
        "plan": plan.to_dict(),
        "generationSpec": spec.model_dump(by_alias=True),
        "modification": modification.model_dump(by_alias=True) if modification else None,
        "images": images,
        "counts": {"library": len(library), "generated": len(generated), "requested": requested},
        "model": model.to_dict(),
        "provider": result,
        "curation": curation,
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
        "error": None if ok else result.get("error") or "generation_failed",
        "message": None if ok else result.get("message") or "Generation failed",
    }


def _pricing_payload(design: DesignState) -> Dict[str, Any]:
    service = design.customer_service_label or design.service_label or design.service_id
    scope_text = design.scope or ", ".join(design.scopes) or "General"
    return {
        "instanceId": design.instance_id,
        "session": {"instanceId": design.instance_id},
        "industry": design.industry or service,
        "service": service,
        "serviceSummary": design.service_summary or f"{service} — {scope_text}".strip(" —"),
        "stepDataSoFar": {
            "service": service,
            "scope": scope_text,
            "scopes": design.scopes,
            "scopeKeys": design.scope_keys,
            "budget": design.budget,
            "taste": [t.label for t in design.taste.tags if t.id in (design.taste.confirmed_ids or [])],
            "refineNote": design.refine_note,
            "priceImpact": design.price_impact,
        },
        "answeredQA": [
            {"question": "Service", "answer": service},
            {"question": "Scope", "answer": scope_text},
            {"question": "Budget", "answer": str(int(design.budget or 0))},
        ],
        "previewImageUrl": design.selected_idea_url or (design.favorite_urls[0] if design.favorite_urls else None),
    }


def _normalized_estimate(design: DesignState) -> Dict[str, Any]:
    """Pricing engine owns the number; refinements shift it by the interpreted impact."""
    result = estimate_pricing(_pricing_payload(design))
    ok = bool(result.get("ok", True)) if isinstance(result, dict) else False
    low = float(result.get("rangeLow") or 0) if isinstance(result, dict) else 0.0
    high = float(result.get("rangeHigh") or 0) if isinstance(result, dict) else 0.0

    if not ok or low <= 0 or high <= 0:
        base = max(2500.0, float(design.budget or 0))
        spread = max(2000.0, base * 0.16)
        low, high = base - spread / 2, base + spread / 2
        ok = False

    impact = 1 + max(-0.28, min(0.4, float(design.price_impact or 0)))
    low, high = low * impact, high * impact
    step = 500 if high < 20000 else 1000

    def _round(value: float) -> int:
        return max(step, int(round(value / step) * step))

    range_low, range_high = _round(low), _round(high)
    # Levers are sized against what this design actually costs, not the budget slider —
    # otherwise "save ~$300" shows up next to a $15,000 estimate.
    basis = (range_low + range_high) / 2
    service = design.service_label or design.service_id
    return {
        "ok": True,
        "source": "pricing_engine" if ok else "budget_fallback",
        "currency": (result.get("currency") if isinstance(result, dict) else None) or "USD",
        "rangeLow": range_low,
        "rangeHigh": range_high,
        "servicePriceRange": result.get("servicePriceRange") if isinstance(result, dict) else None,
        "priceImpact": float(design.price_impact or 0),
        "savingsLevers": savings_levers(service, design.scope, basis),
        "upgradeLevers": upgrade_levers(service, design.scope, basis),
        "raw": result if isinstance(result, dict) else None,
    }


def estimate_from_design(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    estimate = _normalized_estimate(design)
    return {
        "ok": True,
        "estimate": estimate,
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def consult_on_design(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    question = str(payload.get("question") or payload.get("message") or payload.get("instruction") or "").strip()
    estimate: Optional[Dict[str, Any]] = None
    if re.search(r"price|cost|budget|afford|save|cheap|under|quote|expensive", question, re.I):
        estimate = _normalized_estimate(design)
    answer = consult(design=design, question=question, estimate=estimate)
    return {
        "ok": True,
        "reply": answer.get("reply"),
        "action": answer.get("action"),
        "instruction": answer.get("instruction"),
        "levers": answer.get("levers"),
        "source": answer.get("source"),
        "estimate": estimate,
        "savingsLevers": answer.get("savingsLevers"),
        "upgradeLevers": answer.get("upgradeLevers"),
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def interpret_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    instruction = str(payload.get("instruction") or payload.get("refineNote") or "").strip()
    mod = interpret_instruction(design, instruction)
    return {
        "ok": True,
        "modification": mod.model_dump(by_alias=True),
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def budget_bands_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    scopes = design.scopes or ([design.scope] if design.scope else [])
    bands = propose_budget_bands(
        service_label=design.service_label or design.customer_service_label,
        industry=design.industry,
        service_summary=design.service_summary,
        scopes=scopes,
    )
    return {
        **bands,
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def taxonomy_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    services = payload.get("services") if isinstance(payload.get("services"), list) else []
    if not services:
        design = parse_design_state(payload)
        services = [
            {
                "id": design.service_id,
                "businessLabel": design.service_label,
                "customerLabel": design.customer_service_label,
                "serviceSummary": design.service_summary,
            }
        ]
    translated = translate_services(services)
    return {"ok": True, "services": translated, "persist": True}


def analyze_photo_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    url = str(payload.get("photoUrl") or design.photo_url or "").strip()
    analysis = analyze_photo(
        image_url=url,
        service_label=design.customer_service_label or design.service_label,
        scope=design.scope or ", ".join(design.scopes),
    )
    if analysis:
        design.photo_analysis = analysis
        if design.project and design.project.start.photo:
            from programs.adventure_pipeline.schemas import ProjectPhotoAnalysis

            try:
                design.project.start.photo.analysis = ProjectPhotoAnalysis.model_validate(analysis)
            except Exception:
                pass
    return {
        "ok": True,
        "analysis": analysis,
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def handoff_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Business connection package — full ProjectState, not a bare lead tip."""
    design = parse_design_state(payload)
    project = design.to_project_state()
    estimate = _normalized_estimate(design)
    package = {
        "project": project.model_dump(by_alias=True),
        "estimate": estimate,
        "summary": {
            "service": project.display_service_label(),
            "businessService": project.service.business_label,
            "scopes": project.scope.labels(),
            "budget": project.budget.amount,
            "startPath": project.start.path,
            "hasPhoto": bool(project.start.photo and project.start.photo.url),
            "taste": [
                t.label
                for t in project.taste.tags
                if t.id in (project.taste.confirmed_ids or [t.id for t in project.taste.tags])
            ],
            "selectedDesignUrl": project.selection.idea_url,
            "lead": project.lead.model_dump(by_alias=True),
            "priceImpact": project.price_impact,
            "refineNote": project.refine_note,
        },
    }
    return {"ok": True, "handoff": package, "design": design.model_dump(by_alias=True), "project": package["project"]}


def library_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    design = parse_design_state(payload)
    scope_keys = design.scope_keys or design.scopes
    client = normalize_library_candidates(payload.get("libraryImages") or payload.get("library_images"))
    candidates = list(client)
    fetch_limit = int(payload.get("limit") or 80)
    if (design.service_id or design.instance_id) and (len(candidates) < 12 or not candidates):
        server_lib = fetch_library_candidates(
            service_id=design.service_id,
            instance_id=design.instance_id,
            scope_keys=scope_keys,
            limit=max(fetch_limit, 80),
        )
        if server_lib:
            candidates = normalize_library_candidates([*candidates, *server_lib])
    ranked = rank_library(design, candidates, limit=int(payload.get("limit") or 54))
    return {
        "ok": True,
        "images": ranked,
        "counts": {"fetched": len(candidates), "ranked": len(ranked)},
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def discovery_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Library-only Pinterest feed. Hard scope + finish-tier filter, no AI fill."""
    design = parse_design_state(payload)
    finish_tier = str(
        payload.get("finishTier")
        or payload.get("finish_tier")
        or payload.get("budgetBandId")
        or design.budget_band_id
        or ""
    ).strip() or None
    page = discovery_page(
        design,
        finish_tier=finish_tier,
        offset=int(payload.get("offset") or 0),
        limit=int(payload.get("limit") or 24),
    )
    return {
        **page,
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def intake_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Groq-authored service/scope questions for the V8 two-step intake."""
    from programs.adventure_pipeline.intake import plan_intake

    try:
        return plan_intake(payload)
    except Exception as exc:
        return {
            "ok": False,
            "error": "intake_exception",
            "message": str(exc)[:240],
        }


def visual_directions_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Groq visual directions for the no-photo Explore → Narrow gallery."""
    from programs.adventure_pipeline.visual_directions import plan_visual_directions

    try:
        return plan_visual_directions(payload)
    except Exception as exc:
        return {
            "ok": False,
            "error": "visual_directions_exception",
            "message": str(exc)[:240],
        }


def suggest_scopes_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Text-model scope ideas for Focus step when stored taxonomy is thin.
    Uses subcategory_scope_suggester (DSPY_SUBCATEGORY_SCOPE_SUGGESTER).
    """
    from programs.subcategory_scope_suggester.orchestrator import suggest_subcategory_scope

    design = parse_design_state(payload)
    existing_raw = payload.get("existingScopes") or design.scopes or []
    existing = [
        str(s).strip()
        for s in (existing_raw if isinstance(existing_raw, list) else [])
        if str(s).strip() and str(s).strip().lower() != "other"
    ]
    try:
        result = suggest_subcategory_scope(
            {
                "category_name": design.industry,
                "subcategory_name": design.customer_service_label or design.service_label,
                "service_summary": design.service_summary,
                "components": payload.get("components")
                or payload.get("subcategoryComponents")
                or [],
                "min_scope_count": int(payload.get("minScopeCount") or 12),
                "max_scope_count": int(payload.get("maxScopeCount") or 18),
            }
        )
    except Exception as exc:
        result = {
            "ok": False,
            "scopes": [],
            "error": "suggest_scopes_exception",
            "message": str(exc)[:240],
        }
    suggested = [
        str(s).strip()
        for s in (result.get("scopes") or [])
        if str(s).strip() and str(s).strip().lower() != "other"
    ]
    # Prefer stored labels (they may already have cover images), then fill with AI ideas.
    seen = {s.lower() for s in existing}
    merged = list(existing)
    for label in suggested:
        if label.lower() in seen:
            continue
        seen.add(label.lower())
        merged.append(label)
        if len(merged) >= 10:
            break
    if not any(s.lower() == "other" for s in merged):
        merged.append("Other")
    return {
        "ok": bool(result.get("ok") or existing),
        "scopes": merged,
        "suggested": suggested,
        "source": result.get("source") or ("stored" if existing else "none"),
        "model": "DSPY_SUBCATEGORY_SCOPE_SUGGESTER",
        "error": result.get("error"),
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def scope_covers_action(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate cover images for Focus part chips that lack a stored v2_scope_starter.
    Uses the adventure fast image model (Flux Schnell by default).
    """
    design = parse_design_state(payload)
    missing_raw = payload.get("missingScopes") or payload.get("scopes") or []
    missing = [
        str(s).strip()
        for s in (missing_raw if isinstance(missing_raw, list) else [])
        if str(s).strip() and str(s).strip().lower() != "other"
    ][:8]
    if not missing:
        return {"ok": True, "covers": {}, "generated": 0, "model": None}

    model = choose_model(
        mode="inspiration",
        strategy="generate",
        use_case="scope-starter",
        explicit_model_id=str(payload.get("modelId") or "") or None,
    )
    service = design.customer_service_label or design.service_label or "Project"
    covers: Dict[str, Dict[str, str]] = {}
    for scope_label in missing:
        try:
            scoped = design.model_copy(
                update={
                    "scope": scope_label,
                    "scopes": [scope_label],
                    "scope_keys": [scope_label],
                }
            )
            # Element-focused hero — the chip label is the subject, not a vague scene.
            instruction = (
                f"Photoreal close/hero photo featuring exactly this {service.lower()} element: "
                f'"{scope_label}". Make that element the clear subject of the frame. '
                "Residential project context, natural light, inviting, square-crop friendly. "
                "No people faces, no text, logos, or watermarks."
            )
            spec = build_generation_spec(
                scoped,
                mode="inspiration",
                instruction=instruction,
                num_outputs=1,
            )
            image_payload = spec.to_image_payload(instance_id=design.instance_id, design=scoped)
            image_payload["modelId"] = model.model_id
            image_payload["useCase"] = "scene"
            raw_result = generate_image(image_payload)
            result = raw_result if isinstance(raw_result, dict) else {"raw": raw_result}
            urls = _extract_image_urls(result)
            if urls:
                covers[scope_label] = {
                    "imageUrl": urls[0],
                    "scopeKey": scope_label,
                    "source": "generated",
                }
        except Exception:
            continue

    return {
        "ok": True,
        "covers": covers,
        "generated": len(covers),
        "model": model.to_dict(),
        "design": design.model_dump(by_alias=True),
        "project": design.to_project_state().model_dump(by_alias=True),
    }


def run_adventure_action(action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    key = str(action or "").strip().lower()
    if key in ("taste", "infer_taste", "infer-taste"):
        return infer_taste(payload)
    if key in ("inspiration", "ideas", "explore"):
        mode = "inspiration" if key == "inspiration" else "ideas"
        return generate_from_design(payload, mode=mode)
    if key in ("refine", "adjust"):
        return generate_from_design(payload, mode="refine")
    if key in ("final", "polish"):
        return generate_from_design(payload, mode="final")
    if key in ("estimate", "pricing", "price"):
        return estimate_from_design(payload)
    if key in ("consult", "ask", "chat"):
        return consult_on_design(payload)
    if key in ("interpret", "instruction"):
        return interpret_action(payload)
    if key in ("budget_bands", "budget-bands", "bands"):
        return budget_bands_action(payload)
    if key in ("taxonomy", "translate_services", "customer_labels"):
        return taxonomy_action(payload)
    if key in ("analyze_photo", "analyze-photo", "photo"):
        return analyze_photo_action(payload)
    if key in ("handoff", "connect_package", "lead_package"):
        return handoff_action(payload)
    if key in ("library", "catalog"):
        return library_action(payload)
    if key in ("discovery", "discover_gallery", "gallery"):
        return discovery_action(payload)
    if key in ("intake", "intent", "intake_question"):
        return intake_action(payload)
    if key in ("visual_directions", "visual-directions", "directions", "discover"):
        return visual_directions_action(payload)
    if key in ("suggest_scopes", "suggest-scopes", "scope_suggest", "scopes"):
        return suggest_scopes_action(payload)
    if key in ("scope_covers", "scope-covers", "generate_scope_covers"):
        return scope_covers_action(payload)
    if key in ("contracts", "step_contracts"):
        design = parse_design_state(payload)
        step = str(payload.get("step") or "service")
        return {
            "ok": True,
            "contracts": contracts_overview(),
            "canAdvance": can_advance(design.to_project_state(), step),
            "project": design.to_project_state().model_dump(by_alias=True),
        }
    if key in ("spec", "generation_spec", "generation-spec"):
        design = parse_design_state(payload)
        mode = str(payload.get("mode") or "ideas")
        spec = build_generation_spec(design, mode=mode, instruction=str(payload.get("instruction") or ""))
        return {
            "ok": True,
            "generationSpec": spec.model_dump(by_alias=True),
            "design": design.model_dump(by_alias=True),
            "project": design.to_project_state().model_dump(by_alias=True),
        }
    return {"ok": False, "error": "unknown_action", "message": f"Unknown adventure action: {action}"}
