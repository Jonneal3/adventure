from __future__ import annotations

from programs.adventure_pipeline.library import _row_to_candidate
from programs.adventure_pipeline.retrieval import rank_library, retrieval_mix
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


def test_catalog_row_keeps_scope_price_and_design_tags() -> None:
    row = _row_to_candidate(
        {
            "id": "img-1",
            "image_url": "https://cdn.example.com/bath.jpg",
            "metadata": {
                "generated_for": "adventure_v8",
                "starter_scope": "Shower",
                "starter_scope_key": "shower",
                "scope_keys": ["Shower", "Tub"],
                "tags": ["Bathroom Remodel", "Shower", "Tub", "$", "navy"],
                "price_tier": "$",
                "budget": 6500,
                "palette_family": "navy",
                "style": "classic modern",
                "visual_prompt": "navy subway tile, chrome rain head",
            },
        }
    )
    assert row is not None
    assert row["priceTier"] == "$"
    assert "Shower" in row["tags"]
    assert "Tub" in row["tags"]
    assert "navy" in row["tags"]
    assert row["paletteFamily"] == "navy"
    assert row["visualPrompt"]


def test_rank_library_prefers_matching_scope_combo_and_price() -> None:
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
                "url": "https://cdn.example.com/shower-tub.jpg",
                "label": "navy shower",
                "tags": ["Shower", "Tub", "$"],
                "scope": "Shower",
                "scopeKey": "shower",
                "priceTier": "$",
            },
            {
                "url": "https://cdn.example.com/vanity-only.jpg",
                "label": "vanity",
                "tags": ["Vanity", "$$$"],
                "scope": "Vanity",
                "scopeKey": "vanity",
                "priceTier": "$$$",
            },
        ],
        limit=2,
    )
    assert ranked[0]["url"].endswith("shower-tub.jpg")


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


def test_rank_library_keeps_looks_inside_budget_window() -> None:
    from programs.adventure_pipeline.retrieval import within_budget_window

    assert within_budget_window({"budget": 6500}, 6500) is True
    assert within_budget_window({"budget": 8000}, 6500) is False
    assert within_budget_window({"priceTier": "$"}, 6500) is True
    assert within_budget_window({"priceTier": "$$$$"}, 6500) is False

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
                "url": "https://cdn.example.com/in-budget.jpg",
                "label": "navy subway shower",
                "tags": ["Shower", "Tub"],
                "scope": "Shower",
                "budget": 6500,
                "priceTier": "$",
            },
            {
                "url": "https://cdn.example.com/palace.jpg",
                "label": "marble spa shower",
                "tags": ["Shower", "Tub"],
                "scope": "Shower",
                "budget": 42000,
                "priceTier": "$$$$",
            },
        ],
        limit=4,
    )
    assert [row["url"] for row in ranked] == ["https://cdn.example.com/in-budget.jpg"]
