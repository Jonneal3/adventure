from __future__ import annotations

from copy import deepcopy

from programs.gallery_enrichment.manifest import refine_manifest_from_verification, validate_manifest
from programs.gallery_enrichment.launch import build_project_concepts, initial_project_metadata, is_low_performer
from programs.gallery_enrichment.persistence import eligible_generated_gallery_row
from programs.gallery_enrichment.persistence import SupabaseGalleryStore
from programs.gallery_enrichment.pipeline import (
    compatibility_metadata,
    merge_enrichment_metadata,
    process_classified_after,
    process_legacy_after,
    process_planned_manifest,
)
from programs.gallery_enrichment.pricing import price_manifest, pricing_label
from programs.gallery_enrichment.prompts import build_after_prompt, build_before_prompt
from programs.gallery_enrichment.registry import FAMILIES, registry_contract
from programs.gallery_enrichment.service_resolution import resolve_legacy_service
from programs.gallery_enrichment import vision
from programs.subcategory_catalog.orchestrator import _normalize_concepts


def landscaping_manifest(*, source: str = "planned") -> dict:
    return {
        "version": 1,
        "source": source,
        "serviceId": "service-landscaping",
        "serviceKey": "landscaping",
        "pricingFamily": "landscape_design",
        "components": [
            {
                "componentKey": "paver_patio",
                "subtypeKey": "concrete_paver",
                "materialKey": "concrete",
                "tier": "mid",
                "quantity": {"low": 400, "likely": 450, "high": 500, "unit": "sq_ft"},
                "attributes": {},
            },
            {
                "componentKey": "fire_pit",
                "subtypeKey": "built_in_gas",
                "materialKey": "natural_stone",
                "tier": "premium",
                "quantity": {"low": 1, "likely": 1, "high": 1, "unit": "each"},
                "attributes": {},
            },
        ],
        "assumptions": [],
        "normalizationNotes": [],
    }


def passed_verification(manifest: dict) -> dict:
    return {
        "status": "passed",
        "confidence": 0.86,
        "sameScene": True,
        "beforePlausible": True,
        "afterQualityValid": True,
        "manifestCoverage": [row["componentKey"] for row in manifest["components"]],
        "verifiedComponents": deepcopy(manifest["components"]),
        "unsupportedObservations": [],
        "observedDelta": ["Installed paver patio", "Added built-in gas fire pit"],
        "assumptions": [],
        "failureReasons": [],
        "refinedManifest": deepcopy(manifest),
    }


def test_launch_registry_has_all_thirteen_supported_families_and_no_fallback() -> None:
    assert set(FAMILIES) == {
        "bathroom_remodel",
        "kitchen_remodel",
        "general_remodel",
        "landscape_design",
        "deck_patio",
        "pool_build",
        "roofing",
        "flooring",
        "painting",
        "windows_siding",
        "interior_design",
        "furniture",
        "nail_services",
    }
    assert "generic" not in FAMILIES
    for family in FAMILIES.values():
        assert family.components
        for component in family.components.values():
            assert component.before_strategy
            assert component.after_description
            assert component.quantity.unit
            assert component.pricing.material.high + component.pricing.labor.high > 0


def test_manifest_validation_is_closed_and_requires_registered_units() -> None:
    valid = validate_manifest(landscaping_manifest())
    assert valid.valid is True
    unknown = landscaping_manifest()
    unknown["components"][0]["componentKey"] = "spaceship_landing_pad"
    result = validate_manifest(unknown)
    assert result.valid is False
    assert any("not registered" in error for error in result.errors)
    wrong_unit = landscaping_manifest()
    wrong_unit["components"][0]["quantity"]["unit"] = "each"
    result = validate_manifest(wrong_unit)
    assert result.valid is False
    assert any("must be sq_ft" in error for error in result.errors)
    unknown_field = landscaping_manifest()
    unknown_field["components"][0]["unpricedScope"] = "outdoor kitchen"
    result = validate_manifest(unknown_field)
    assert result.valid is False
    assert any("unpricedScope is not allowed" in error for error in result.errors)
    wrong_service = landscaping_manifest()
    wrong_service["serviceKey"] = "mystery_service"
    result = validate_manifest(wrong_service)
    assert result.valid is False
    assert any("serviceKey does not match" in error for error in result.errors)


def test_manifest_infers_missing_paver_subtype_from_registered_material() -> None:
    raw = landscaping_manifest(source="legacy_inferred")
    raw["components"][0].pop("subtypeKey")
    raw["components"][0]["materialKey"] = "natural_stone"
    result = validate_manifest(raw)
    assert result.valid is True
    assert result.manifest["components"][0]["subtypeKey"] == "natural_stone_paver"


def test_deterministic_pricing_totals_equal_displayed_breakdown() -> None:
    result = price_manifest(landscaping_manifest(), city="Austin", state="TX")
    assert result["status"] == "complete"
    assert result["marketFactor"] == 1.08
    for key in ("low", "likely", "high"):
        assert result["baseRange"][key] == sum(item["range"][key] for item in result["breakdown"])
        assert result["localizedRange"][key] == sum(item["localizedRange"][key] for item in result["breakdown"])
    assert pricing_label("high") == "Typical estimated range"
    assert pricing_label("medium") == "Estimated project range"
    assert pricing_label("broad") == "Broad illustrative estimate"


def test_prompts_include_every_manifest_component_and_preservation_rules() -> None:
    manifest = landscaping_manifest()
    after = build_after_prompt(manifest).lower()
    before = build_before_prompt(manifest).lower()
    assert "paver patio" in after
    assert "fire pit" in after
    assert "do not add unrelated" in after
    assert "camera position" in before
    assert "property boundaries" in before
    assert "ordinary, clean" in before
    assert "damaged" in before


def test_verification_refines_quantity_but_cannot_invent_components() -> None:
    manifest = landscaping_manifest()
    verified = deepcopy(manifest["components"])
    verified[0]["quantity"] = {"low": 420, "likely": 460, "high": 500, "unit": "sq_ft"}
    refined = refine_manifest_from_verification(manifest, verified)
    assert refined.valid is True
    assert refined.manifest["components"][0]["quantity"]["likely"] == 460
    verified.append(
        {
            "componentKey": "swimming_pool",
            "tier": "luxury",
            "quantity": {"low": 1, "likely": 1, "high": 1, "unit": "each"},
            "attributes": {},
        }
    )
    rejected = refine_manifest_from_verification(manifest, verified)
    assert rejected.valid is False
    assert any("invented unsupported component" in error for error in rejected.errors)


def test_pair_normalization_fails_unsupported_visible_work(monkeypatch) -> None:
    manifest = landscaping_manifest()
    raw = passed_verification(manifest)
    raw["unsupportedObservations"] = ["large unregistered outdoor kitchen"]
    captured = {}

    def fake_vision(*_args, **kwargs):
        captured.update(kwargs)
        return raw

    monkeypatch.setattr(vision, "vision_json", fake_vision)
    result = vision.verify_pair("https://example.com/before.jpg", "https://example.com/after.jpg", manifest=manifest)
    assert result["status"] == "failed"
    assert "unsupported material visible work" in result["failureReasons"]
    assert "exactly one object for every original manifest component" in captured["user"]


def test_legacy_qa_normalizes_component_map_without_inventing_scope(monkeypatch) -> None:
    raw = {
        "verdict": "keep",
        "reason": "Realistic completed patio",
        "priceableManifest": {
            "paver_patio": {
                "subtypeKey": "concrete_paver",
                "materialKey": "concrete",
                "tier": "mid",
                "quantity": {"low": 400, "likely": 450, "high": 500, "unit": "sq_ft"},
                "attributes": {},
            }
        },
    }
    captured = {}

    def fake_vision(*_args, **kwargs):
        captured.update(kwargs)
        return raw

    monkeypatch.setattr(vision, "vision_json", fake_vision)
    result = vision.qa_and_infer_manifest(
        "https://example.com/after.jpg",
        pricing_family="landscape_design",
        service_id="service-landscaping",
    )
    assert result["verdict"] == "keep"
    assert result["manifestErrors"] == []
    assert [item["componentKey"] for item in result["priceableManifest"]["components"]] == ["paver_patio"]
    assert "quantityBounds are hard inclusive limits" in captured["user"]


def test_legacy_qa_still_rejects_unknown_component_map(monkeypatch) -> None:
    raw = {
        "verdict": "keep",
        "reason": "Looks realistic",
        "priceableManifest": {
            "spaceship_landing_pad": {
                "tier": "mid",
                "quantity": {"low": 1, "likely": 1, "high": 1, "unit": "each"},
            }
        },
    }
    monkeypatch.setattr(vision, "vision_json", lambda *_args, **_kwargs: raw)
    result = vision.qa_and_infer_manifest(
        "https://example.com/after.jpg",
        pricing_family="landscape_design",
        service_id="service-landscaping",
    )
    assert result["verdict"] == "uncertain"
    assert result["priceableManifest"]["components"] == []


def test_legacy_service_resolution_prefers_subcategory_then_metadata_then_vlm() -> None:
    known = resolve_legacy_service(
        {"subcategory_id": "svc-1", "image_url": "https://example.com/a.jpg", "metadata": {}},
        services_by_id={"svc-1": {"subcategory": "Bathroom remodeling"}},
    )
    assert known.pricing_family == "bathroom_remodel"
    assert known.source == "subcategory_id"
    metadata = resolve_legacy_service(
        {"image_url": "https://example.com/b.jpg", "metadata": {"service_name": "Nail salon"}},
        services_by_id={},
    )
    assert metadata.pricing_family == "nail_services"
    classified = resolve_legacy_service(
        {"image_url": "https://example.com/c.jpg", "metadata": {}},
        services_by_id={},
        classifier=lambda _url: {"status": "resolved", "pricingFamily": "roofing", "confidence": .81},
    )
    assert classified.pricing_family == "roofing"
    assert classified.source == "vlm"


def test_legacy_pipeline_retries_before_once_and_publishes_ready() -> None:
    manifest = landscaping_manifest(source="legacy_inferred")
    qa = {"verdict": "keep", "reason": "", "scores": {}, "artifacts": [], "priceableManifest": manifest}
    generated: list[int] = []
    verified: list[int] = []

    def generate_before(**kwargs):
        generated.append(kwargs["attempt"])
        return f"https://example.com/before-{kwargs['attempt']}.jpg"

    def verify(**kwargs):
        verified.append(len(verified) + 1)
        if len(verified) == 1:
            return {"status": "failed", "afterQualityValid": True, "failureReasons": ["camera drift"]}
        return passed_verification(manifest)

    result = process_legacy_after(
        after_url="https://example.com/after.jpg",
        qa=qa,
        model_id="flux-schnell",
        generate_before=generate_before,
        verify=verify,
        persist_before=lambda url, attempt: {"url": "https://cdn.example.com/before.jpg", "imageId": "before-id"},
    )
    assert generated == [1, 2]
    assert result["publish"]["status"] == "ready"
    assert result["before"]["attempts"] == 2
    assert result["verification"]["confidence"] == .86
    assert result["pricing"]["status"] == "complete"


def test_classification_only_publishes_priceable_image_without_before() -> None:
    manifest = landscaping_manifest(source="legacy_inferred")
    qa = {
        "verdict": "keep",
        "reason": "Realistic completed patio",
        "scores": {"realism": .88},
        "artifacts": [],
        "priceableManifest": manifest,
    }
    result = process_classified_after(
        qa=qa,
        model_id="flux-schnell",
        pipeline_source="legacy",
    )
    assert result["publish"]["status"] == "ready"
    assert result["before"]["status"] == "not_available"
    assert result["pair"]["status"] == "unpaired"
    assert result["verification"]["status"] == "not_run"
    assert result["pricing"]["status"] == "complete"
    merged = merge_enrichment_metadata({"keep_me": True}, result)
    assert merged["before_image_url"] is None
    assert merged["project_manifest"]["analysisStatus"] == "verified"
    assert merged["included_items"] == ["Paver patio", "Fire pit"]


def test_planned_pipeline_regenerates_complete_pair_when_after_fails() -> None:
    manifest = landscaping_manifest()
    after_attempts: list[int] = []
    before_attempts: list[int] = []
    verification_calls = 0

    def generate_after(**kwargs):
        after_attempts.append(kwargs["attempt"])
        return f"https://example.com/after-{kwargs['attempt']}.jpg"

    def generate_before(**kwargs):
        before_attempts.append(kwargs["attempt"])
        return f"https://example.com/before-{kwargs['attempt']}.jpg"

    def verify(**_kwargs):
        nonlocal verification_calls
        verification_calls += 1
        if verification_calls == 1:
            return {"status": "failed", "afterQualityValid": False, "failureReasons": ["after omitted fire pit"]}
        return passed_verification(manifest)

    result = process_planned_manifest(
        manifest=manifest,
        concept_description="Paver patio with fire pit",
        generate_after=generate_after,
        generate_before=generate_before,
        verify=verify,
        persist_pair=lambda after, before, attempt: {
            "afterUrl": after,
            "beforeUrl": before,
            "beforeImageId": "before-id",
        },
        initial_after_url="https://example.com/existing-after.jpg",
    )
    assert after_attempts == [2]
    assert before_attempts == [1, 2]
    assert result["publish"]["status"] == "ready"


def test_metadata_merge_preserves_unrelated_fields_and_materializes_compatibility() -> None:
    manifest = landscaping_manifest()
    pricing = price_manifest(manifest)
    enrichment = {
        "version": 1,
        "pipelineSource": "planned",
        "provenance": {"modelId": "flux-2-pro"},
        "qa": {"status": "keep"},
        "priceableManifest": manifest,
        "before": {"status": "success", "url": "https://cdn.example.com/before.jpg", "imageId": "before-id", "attempts": 1, "disclosure": "ai_generated_illustrative_before"},
        "verification": passed_verification(manifest),
        "pricing": pricing,
        "publish": {"status": "ready"},
        "stages": {},
    }
    merged = merge_enrichment_metadata({"keep_me": 42}, enrichment)
    assert merged["keep_me"] == 42
    assert merged["before_image_url"].endswith("before.jpg")
    assert merged["price_range"]["min"] == pricing["localizedRange"]["low"]
    assert merged["project_manifest"]["analysisStatus"] == "verified"
    assert compatibility_metadata(enrichment)["included_items"] == ["Paver patio", "Fire pit"]


def test_generated_row_filter_excludes_uploads_and_before_children() -> None:
    assert eligible_generated_gallery_row({"id": "transient", "model_id": "flux", "metadata": {}}) is False
    assert eligible_generated_gallery_row(
        {"id": "gallery-row", "model_id": "flux", "metadata": {}},
        gallery_image_ids={"gallery-row"},
    ) is True
    assert eligible_generated_gallery_row(
        {"id": "catalog", "metadata": {"generated_for": "style_seed"}}
    ) is True
    assert eligible_generated_gallery_row(
        {"id": "sample", "metadata": {"generated_for": "sample_gallery"}}
    ) is True
    assert eligible_generated_gallery_row(
        {"id": "refinement", "model_id": "flux", "metadata": {"generated_for": "refinement_option"}}
    ) is False
    assert eligible_generated_gallery_row({"model_id": "flux", "metadata": {"source": "customer_upload"}}) is False
    assert eligible_generated_gallery_row({"model_id": "flux", "metadata": {"generated_for": "illustrative_before"}}) is False


def test_before_child_keeps_provider_slug_out_of_uuid_model_column(monkeypatch) -> None:
    store = SupabaseGalleryStore.__new__(SupabaseGalleryStore)
    store.dry_run = False
    store.base_url = "https://example.supabase.co"
    store.key = "test"
    monkeypatch.setattr(store, "existing_before_child", lambda _parent_id: None)
    monkeypatch.setattr(
        store,
        "upload_from_url",
        lambda *_args, **_kwargs: {
            "url": "https://example.supabase.co/storage/before.webp",
            "storagePath": "gallery-before/parent/1-before.webp",
        },
    )
    captured = {}

    def fake_request(method, path, body=None, **_kwargs):
        captured.update({"method": method, "path": path, "body": body})
        return [{"id": "before-id", "image_url": body["image_url"]}]

    monkeypatch.setattr(store, "_request", fake_request)
    persisted = store.persist_before_child(
        {
            "id": "parent-id",
            "model_id": None,
            "account_id": None,
            "instance_id": None,
            "subcategory_id": "service-id",
            "user_id": None,
        },
        "https://provider.example/before.webp",
        1,
    )
    assert persisted["imageId"] == "before-id"
    assert persisted["pairId"] == "parent-id"
    assert captured["body"]["model_id"] is None
    assert captured["body"]["metadata"]["generator_model"] == "black-forest-labs/flux-2-pro"
    assert captured["body"]["metadata"]["gallery_pair"] == {
        "version": 1,
        "pair_id": "parent-id",
        "role": "before",
        "counterpart_image_id": "parent-id",
        "source": "generated",
    }


def test_source_availability_rejects_missing_and_accepts_image_response(monkeypatch) -> None:
    store = SupabaseGalleryStore.__new__(SupabaseGalleryStore)
    store.dry_run = True

    class Response:
        status = 200
        headers = {"Content-Type": "image/webp"}

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self, _size):
            return b"x"

    monkeypatch.setattr("programs.gallery_enrichment.persistence.urllib.request.urlopen", lambda *_args, **_kwargs: Response())
    assert store.image_accessible("https://example.com/image.webp") is True
    assert store.image_accessible("") is False


def test_existing_pair_link_is_bidirectional_and_preserves_metadata(monkeypatch) -> None:
    store = SupabaseGalleryStore.__new__(SupabaseGalleryStore)
    store.dry_run = False
    rows = {
        "after-id": {"id": "after-id", "metadata": {"keep_after": 1}},
        "before-id": {"id": "before-id", "metadata": {"keep_before": 2}},
    }
    writes = {}
    monkeypatch.setattr(store, "image_by_id", lambda image_id: rows.get(image_id))
    monkeypatch.setattr(store, "patch_metadata", lambda image_id, metadata: writes.update({image_id: metadata}))
    pair_id = store.link_existing_pair(
        after_image_id="after-id",
        before_image_id="before-id",
        source="uploaded",
    )
    assert pair_id == "after-id"
    assert writes["after-id"]["keep_after"] == 1
    assert writes["before-id"]["keep_before"] == 2
    assert writes["after-id"]["gallery_pair"]["counterpart_image_id"] == "before-id"
    assert writes["before-id"]["gallery_pair"]["counterpart_image_id"] == "after-id"
    assert writes["after-id"]["gallery_pair"]["role"] == "after"
    assert writes["before-id"]["gallery_pair"]["role"] == "before"


def test_catalog_normalization_requires_valid_manifest_and_preflights_price() -> None:
    manifest = landscaping_manifest()
    concepts = _normalize_concepts(
        [
            {"label": "Paver patio", "value": "paver_patio", "image_prompt": "Patio and fire pit", "manifest": manifest},
            {"label": "Unstructured", "value": "unstructured", "image_prompt": "Pretty yard"},
        ],
        limit=5,
        pricing_family="landscape_design",
        service_id="service-landscaping",
    )
    assert len(concepts) == 1
    assert concepts[0]["pricing_preflight"]["status"] == "complete"
    assert registry_contract("landscape_design")["version"] == 1


def test_vertical_launcher_builds_a_large_unique_priceable_kitchen_catalog() -> None:
    concepts = build_project_concepts(
        service_id="kitchen-service",
        pricing_family="kitchen_remodel",
        target_count=125,
    )
    assert len(concepts) == 125
    assert len({concept["key"] for concept in concepts}) == 125
    for concept in concepts:
        validated = validate_manifest(
            concept["manifest"],
            expected_family="kitchen_remodel",
            expected_service_id="kitchen-service",
            source="planned",
        )
        assert validated.valid is True
        assert concept["pricingPreflight"]["status"] == "complete"
        assert concept["pricingPreflight"]["breakdown"]


def test_catalog_contract_materializes_badge_tags_lifecycle_and_metrics() -> None:
    manifest = landscaping_manifest(source="legacy_inferred")
    enrichment = process_classified_after(
        qa={"verdict": "keep", "priceableManifest": manifest},
        manifest=manifest,
        model_id="quality-model",
    )
    merged = merge_enrichment_metadata({"tags": ["existing"]}, enrichment)
    assert merged["gallery_status"] == "active"
    assert merged["gallery_badge"] == "Estimated range"
    assert merged["gallery_catalog"]["pricingFamily"] == "landscape_design"
    assert {"existing", "landscape_design", "paver_patio", "fire_pit"}.issubset(set(merged["tags"]))
    assert merged["adventure_stats"]["shown"] == 0
    assert merged["adventure_stats"]["selected"] == 0
    assert merged["adventure_stats"]["impressions"] == 0
    assert merged["adventure_stats"]["clicks"] == 0


def test_launch_metadata_and_low_performer_policy_are_deterministic() -> None:
    concept = build_project_concepts(
        service_id="kitchen-service",
        pricing_family="kitchen_remodel",
        target_count=1,
    )[0]
    metadata = initial_project_metadata(
        vertical_key="kitchen_remodeling",
        industry="Residential Remodelers",
        service_id="kitchen-service",
        service_name="Kitchen Remodeling",
        concept=concept,
        model_id="quality-model",
    )
    assert metadata["catalog_key"].startswith("gallery_launch:v1:kitchen_remodeling:kitchen-service:")
    assert metadata["gallery_status"] == "hidden"
    assert is_low_performer({"adventure_stats": {"shown": 99, "selected": 0}}) is False
    assert is_low_performer({"adventure_stats": {"shown": 100, "selected": 1}}) is True
    assert is_low_performer({"adventure_stats": {"shown": 100, "selected": 2}}) is False
