from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from programs.adventure_pipeline import library as library_module
from programs.adventure_pipeline.library import _row_to_candidate
from programs.adventure_pipeline.retrieval import MIN_LIBRARY_RELEVANCE, rank_library, retrieval_mix


def test_service_library_query_paginates_past_the_old_240_row_cap(monkeypatch) -> None:
    calls = []

    def fake_rest_get(path_qs: str):
        query = parse_qs(urlsplit(path_qs).query)
        limit = int(query["limit"][0])
        offset = int(query["offset"][0])
        calls.append((offset, limit))
        remaining = max(0, 527 - offset)
        return [{"id": str(offset + i)} for i in range(min(limit, remaining))]

    monkeypatch.setattr(library_module, "_rest_get", fake_rest_get)
    rows = library_module._query_images(
        filters=["subcategory_id=eq.service-id"],
        limit=527,
        require_completed=True,
    )

    assert len(rows) == 527
    assert calls == [(0, 200), (200, 200), (400, 127)]


def test_thin_service_catalog_scans_deeper_shared_pool_to_fill_120(monkeypatch) -> None:
    calls = []

    def row(image_id: str, subcategory_id: str = ""):
        return {
            "id": image_id,
            "subcategory_id": subcategory_id or None,
            "account_id": None,
            "image_url": f"https://cdn.example.com/{image_id}.jpg",
                "metadata": {
                    "generated_for": "subcategory_catalog",
                    "option_label": f"Project {image_id}",
                    "gallery_enrichment": {"version": 1, "publish": {"status": "ready"}},
                },
        }

    def fake_query_images(*, filters, limit, require_completed):
        calls.append((tuple(filters), limit, require_completed))
        if any(part.startswith("subcategory_id=eq.") for part in filters):
            return [row("service-1", "bathroom-remodel")]
        assert filters == ["account_id=is.null"]
        return [row(f"platform-{index}") for index in range(119)]

    monkeypatch.setattr(library_module, "_query_images", fake_query_images)
    images = library_module.fetch_library_candidates(
        service_id="bathroom-remodel",
        limit=120,
        broaden=False,
        allow_any_source=True,
    )

    assert len(images) == 120
    assert calls[0] == (("subcategory_id=eq.bathroom-remodel",), 240, True)
    assert calls[1] == (("account_id=is.null",), 480, True)
    assert all(image["catalogSource"] == "platform" for image in images)
from programs.adventure_pipeline.schemas import DesignState


def test_inspiration_mix_prefers_stored_looks_then_fills_with_generation() -> None:
    assert retrieval_mix(mode="inspiration", requested=12, library_available=8) == {
        "library": 8,
        "generate": 4,
    }
    assert retrieval_mix(mode="inspiration", requested=12, library_available=24) == {
        "library": 12,
        "generate": 0,
    }
    assert retrieval_mix(mode="inspiration", requested=6, library_available=0) == {
        "library": 0,
        "generate": 6,
    }


def test_catalog_row_keeps_scope_finish_materials_and_directional_price_range() -> None:
    row = _row_to_candidate(
        {
            "id": "img-1",
            "image_url": "https://cdn.example.com/bath.jpg",
            "metadata": {
                "generated_for": "adventure_v8",
                "starter_scope": "Shower",
                "starter_scope_key": "shower",
                "scope_keys": ["Shower", "Tub"],
                "tags": ["Bathroom Remodel", "Shower", "Tub", "value", "navy"],
                "finish_tier": "value",
                "price_range": {"min": 5000, "max": 8000, "currency": "USD", "source": "scope_finish_tier"},
                "price_relationship": "value",
                "palette_family": "navy",
                "style": "classic modern",
                "materials": ["navy subway tile", "chrome fixtures"],
                "visual_prompt": "navy subway tile, chrome rain head",
                "before_image_url": "https://cdn.example.com/bath-before.jpg",
                "what_changed": ["Replaced the tub surround", "Updated the vanity and fixtures"],
                "included_items": ["Shower", "Vanity", "Fixtures"],
                "focus_regions": {"Vanity": {"x": 4, "y": 42, "width": 38, "height": 46}},
                "focus_outlines": {
                    "Vanity": [
                        {"x": 4, "y": 42},
                        {"x": 42, "y": 42},
                        {"x": 42, "y": 88},
                        {"x": 4, "y": 88},
                    ]
                },
            },
        }
    )
    assert row is not None
    assert row["finishTier"] == "value"
    assert row.get("budget") is None
    assert row["priceRange"]["min"] == 5000
    assert row["priceRelationship"] == "value"
    assert "navy subway tile" in row["materials"]
    assert "Shower" in row["tags"]
    assert "Tub" in row["tags"]
    assert "navy" in row["tags"]
    assert row["paletteFamily"] == "navy"
    assert row["visualPrompt"]
    assert row["beforeUrl"] == "https://cdn.example.com/bath-before.jpg"
    assert row["changeSummary"] == "Replaced the tub surround · Updated the vanity and fixtures"
    assert row["includedItems"] == ["Shower", "Vanity", "Fixtures"]
    assert row["focusRegions"]["Vanity"]["x"] == 4
    assert row["focusOutlines"]["Vanity"][2]["y"] == 88


def test_ready_catalog_pricing_localizes_from_national_base_at_read_time() -> None:
    row = _row_to_candidate(
        {
            "id": "localized-1",
            "image_url": "https://cdn.example.com/patio.jpg",
            "metadata": {
                "generated_for": "adventure_v8",
                "gallery_enrichment": {
                    "version": 1,
                    "publish": {"status": "ready"},
                    "before": {"url": "https://cdn.example.com/patio-before.jpg"},
                    "verification": {"confidence": .88},
                    "priceableManifest": {"version": 1, "components": [{"componentKey": "paver_patio"}]},
                    "pricing": {
                        "status": "complete",
                        "confidence": "high",
                        "baseRange": {"low": 10000, "likely": 12000, "high": 15000, "currency": "USD"},
                        "breakdown": [
                            {
                                "key": "patio:materials",
                                "label": "Paver patio — Materials",
                                "category": "materials",
                                "range": {"low": 10000, "likely": 12000, "high": 15000, "currency": "USD"},
                            }
                        ],
                        "assumptions": [],
                    },
                },
            },
        },
        require_publish_ready=True,
        pricing_city="Austin",
        pricing_state="TX",
    )
    assert row is not None
    assert row["priceRange"]["min"] == 10800
    assert row["priceRange"]["max"] == 16200
    assert row["pricingBreakdown"][0]["localizedRange"]["high"] == 16200


def test_catalog_row_projects_social_proof_and_local_business_usage() -> None:
    row = _row_to_candidate(
        {
            "id": "img-social",
            "image_url": "https://cdn.example.com/local-bath.jpg",
            "instance_id": "instance-1",
            "account_id": "business-1",
            "metadata": {
                "generated_for": "adventure_v8",
                "starter_scope": "Full Bathroom Remodel",
                "finish_tier": "value",
                "worth_keeping": True,
                "reusable_status": "reusable",
                "adventure_stats": {
                    "shown": 12,
                    "selected": 4,
                    "saved": 2,
                    "shared": 3,
                    "conversions": 1,
                },
                "adventure_usage": {
                    "instance_count": 3,
                    "by_instance": {
                        "instance-1": {
                            "shown": 5,
                            "selected": 1,
                            "saved": 1,
                            "shared": 1,
                            "conversions": 0,
                        }
                    },
                },
            },
        },
        instance_id="instance-1",
    )
    assert row is not None
    assert row["local"] is True
    assert row["catalogSource"] == "instance"
    assert row["timesShared"] == 3
    assert row["businessUsageCount"] == 3
    assert row["localSelections"] == 1
    assert row["performanceCue"] == "🔥🔥🔥 Hot in your area"
    assert row["worthKeeping"] is True
    assert row["reusableStatus"] == "reusable"


def test_stable_styled_scope_catalog_is_admitted_without_legacy_discovery_tags() -> None:
    row = _row_to_candidate(
        {
            "id": "styled-scope-1",
            "image_url": (
                "https://project.supabase.co/storage/v1/object/public/"
                "generated-images/bathroom/styled-scope-1.png"
            ),
            "metadata": {
                "generated_for": "v2_scope_starter",
                "starter_scope": "Full Bathroom Remodel",
                "starter_variant_label": "Modern organic",
            },
        }
    )

    assert row is not None
    assert row["clientQualified"] is True
    assert row["curationSource"] == "stable_scope_catalog"


def test_temporary_untagged_scope_starter_remains_blocked() -> None:
    row = _row_to_candidate(
        {
            "id": "temporary-scope-1",
            "image_url": "https://replicate.delivery/pbxt/temporary-scope-1.webp",
            "metadata": {
                "generated_for": "v2_scope_starter",
                "starter_scope": "Full Bathroom Remodel",
                "starter_variant_label": "Modern organic",
            },
        }
    )

    assert row is None


def test_temporary_provider_delivery_url_never_enters_reusable_gallery() -> None:
    row = _row_to_candidate(
        {
            "id": "temporary-adventure-look",
            "image_url": "https://replicate.delivery/yhqm/expired/out-0.webp",
            "metadata": {
                "generated_for": "adventure_v8",
                "starter_scope": "Shower / tub",
                "starter_variant_label": "Boutique contrast",
                "discovery": {
                    "primary_scope": "shower-tub",
                    "estimated_finish_tier": "value",
                    "role": "inspiration",
                    "keep": True,
                    "inspirational": True,
                },
            },
        }
    )

    assert row is None


def test_rank_library_prefers_matching_scope_combo_and_finish_quality() -> None:
    design = DesignState.model_validate(
        {
            "serviceId": "bathroom-remodel",
            "serviceLabel": "Bathroom Remodel",
            "customerServiceLabel": "Bathroom Remodel",
            "scopes": ["Shower", "Tub"],
            "scopeKeys": ["shower", "tub"],
            "budgetBandId": "value",
        }
    )
    ranked = rank_library(
        design,
        [
            {
                "url": "https://cdn.example.com/shower-tub.jpg",
                "label": "navy shower",
                "tags": ["Shower", "Tub", "value"],
                "scope": "Shower",
                "scopeKey": "shower",
                "finishTier": "value",
            },
            {
                "url": "https://cdn.example.com/vanity-only.jpg",
                "label": "vanity",
                "tags": ["Vanity", "premium"],
                "scope": "Vanity",
                "scopeKey": "vanity",
                "finishTier": "premium",
            },
        ],
        limit=2,
    )
    assert ranked[0]["url"].endswith("shower-tub.jpg")
    assert len(ranked) == 1
    assert ranked[0]["relevanceScore"] >= MIN_LIBRARY_RELEVANCE


def test_rank_library_drops_tile_macros_and_catalog_option_cards() -> None:
    from programs.adventure_pipeline.recipes import look_fits_selected_scopes, looks_like_material_swatch

    assert looks_like_material_swatch("close-up of four off-white textured tiles") is True
    assert looks_like_material_swatch("patterned tile") is True
    assert looks_like_material_swatch("navy subway tile, chrome rain head and tub filler") is False
    assert look_fits_selected_scopes(
        "From our work",
        scopes=["Shower", "Tub"],
        generated_for="subcategory_catalog",
    ) is False
    assert look_fits_selected_scopes(
        "Warm oak vanity",
        scopes=["Shower", "Tub"],
    ) is False
    assert look_fits_selected_scopes(
        "navy subway shower with chrome rain head",
        scopes=["Shower", "Tub"],
    ) is True

    design = DesignState.model_validate(
        {
            "serviceId": "bathroom-remodel",
            "serviceLabel": "Bathroom Remodel",
            "customerServiceLabel": "Bathroom Remodel",
            "scopes": ["Shower", "Tub"],
            "scopeKeys": ["shower", "tub"],
            "budget": 6500,
        }
    )
    ranked = rank_library(
        design,
        [
            {
                "url": "https://cdn.example.com/tile-macro.jpg",
                "label": "patterned tile",
                "tags": ["Tile"],
                "scope": "Tile",
                "generatedFor": "subcategory_catalog",
            },
            {
                "url": "https://cdn.example.com/shower.jpg",
                "label": "navy subway shower",
                "tags": ["Shower", "Tub"],
                "scope": "Shower",
                "generatedFor": "adventure_v8",
            },
        ],
        limit=4,
    )
    assert [row["url"] for row in ranked] == ["https://cdn.example.com/shower.jpg"]


def test_rank_library_soft_ranks_finish_neighbors_instead_of_price_filtering() -> None:
    design = DesignState.model_validate(
        {
            "serviceId": "bathroom-remodel",
            "serviceLabel": "Bathroom Remodel",
            "customerServiceLabel": "Bathroom Remodel",
            "scopes": ["Shower", "Tub"],
            "scopeKeys": ["shower", "tub"],
            "budgetBandId": "value",
        }
    )
    ranked = rank_library(
        design,
        [
            {
                "url": "https://cdn.example.com/in-budget.jpg",
                "label": "navy subway shower",
                "tags": ["Shower", "Tub"],
                "scope": "Shower",
                "finishTier": "value",
            },
            {
                "url": "https://cdn.example.com/palace.jpg",
                "label": "marble spa shower",
                "tags": ["Shower", "Tub"],
                "scope": "Shower",
                "finishTier": "luxury",
            },
        ],
        limit=4,
    )
    assert [row["url"] for row in ranked] == [
        "https://cdn.example.com/in-budget.jpg",
        "https://cdn.example.com/palace.jpg",
    ]
