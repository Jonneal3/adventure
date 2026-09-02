from programs.adventure_pipeline.discovery import (
    MIN_DISCOVERY_RELEVANCE,
    discovery_page,
    hard_filter_discovery,
    project_discovery,
)
from programs.adventure_pipeline.schemas import DesignState


def _img(**kwargs):
    row = {
        "url": kwargs.get("url") or "https://example.com/a.jpg",
        "label": kwargs.get("label") or "Look",
        "scopeKey": kwargs.get("scopeKey"),
        "priceTier": kwargs.get("priceTier"),
        "discovery": kwargs.get("discovery"),
        "tags": kwargs.get("tags") or [],
    }
    return row


def test_discovery_admits_exact_scope_and_rejects_low_relevance_neighbors() -> None:
    tiers = [
        {"id": "value", "min": 1500, "max": 4000},
        {"id": "mid", "min": 4000, "max": 8000},
        {"id": "premium", "min": 8000, "max": 13000},
    ]
    rows = [
        _img(discovery={"primary_scope": "vanity", "estimated_finish_tier": "value"}),
        _img(url="https://example.com/b.jpg", discovery={"primary_scope": "vanity", "estimated_finish_tier": "mid"}),
        _img(url="https://example.com/c.jpg", discovery={"primary_scope": "vanity", "estimated_finish_tier": "premium"}),
        _img(url="https://example.com/d.jpg", discovery={"primary_scope": "full-bathroom-remodel", "estimated_finish_tier": "value"}),
        _img(url="https://example.com/e.jpg", label="mystery"),
    ]
    kept = hard_filter_discovery(rows, scopes=["Vanity"], finish_tier="value", tiers=tiers)
    urls = [r["url"] for r in kept]
    assert urls.index("https://example.com/a.jpg") < urls.index("https://example.com/b.jpg")
    assert urls.index("https://example.com/b.jpg") < urls.index("https://example.com/c.jpg")
    assert "https://example.com/d.jpg" not in urls
    assert "https://example.com/e.jpg" not in urls
    assert kept[0]["retrievalMatch"] == "exact"
    assert all(row["relevanceScore"] >= MIN_DISCOVERY_RELEVANCE for row in kept)


def test_full_bath_keeps_relevant_part_photos_but_not_untagged_filler() -> None:
    tiers = [
        {"id": "value", "min": 5000, "max": 21000},
        {"id": "mid", "min": 21000, "max": 37000},
        {"id": "premium", "min": 37000, "max": 54000},
        {"id": "luxury", "min": 54000, "max": 70000},
    ]
    rows = [
        _img(url="https://example.com/vanity.jpg", discovery={"primary_scope": "vanity", "estimated_finish_tier": "mid"}),
        _img(url="https://example.com/shower.jpg", label="Shower / Tub", priceTier="$$"),
        _img(url="https://example.com/legacy.jpg", label="From our work", tags=["Bathroom Remodel"]),
        _img(url="https://example.com/premium.jpg", discovery={"primary_scope": "vanity", "estimated_finish_tier": "premium"}),
        _img(url="https://example.com/kitchen.jpg", label="Kitchen island white oak"),
        _img(url="https://example.com/swatch.jpg", label="close-up of four off-white textured tiles"),
    ]
    kept = hard_filter_discovery(
        rows,
        scopes=["Full Bathroom Remodel"],
        finish_tier="value",
        tiers=tiers,
        service_label="Bathroom remodel",
    )
    urls = [r["url"] for r in kept]
    assert "https://example.com/vanity.jpg" in urls
    assert "https://example.com/shower.jpg" in urls
    assert "https://example.com/legacy.jpg" in urls
    assert "https://example.com/premium.jpg" in urls
    assert urls.index("https://example.com/vanity.jpg") < urls.index("https://example.com/premium.jpg")
    assert "https://example.com/kitchen.jpg" not in urls
    assert "https://example.com/swatch.jpg" not in urls


def test_legacy_projection_from_scope_and_price_tier() -> None:
    item = project_discovery(_img(scopeKey="Vanity", priceTier="$$"))
    assert item["primaryScope"] == "vanity"
    assert item["estimatedFinishTier"] == "mid"
    assert item["discoverySource"] == "legacy"


def test_generic_label_is_not_primary_scope() -> None:
    item = project_discovery(_img(label="From our work"))
    assert item["primaryScope"] is None


def test_lighting_only_does_not_backfill_with_generic_bathrooms() -> None:
    tiers = [{"id": "value"}, {"id": "mid"}, {"id": "premium"}]
    generic = [
        _img(
            url=f"https://example.com/generic-{i}.jpg",
            label=f"Modern bathroom {i}",
            discovery={"primary_scope": "full-bathroom-remodel", "estimated_finish_tier": "mid"},
        )
        for i in range(50)
    ]
    lighting = [
        _img(
            url=f"https://example.com/lighting-{i}.jpg",
            label=f"Layered bathroom lighting {i}",
            discovery={"primary_scope": "lighting", "estimated_finish_tier": "mid"},
        )
        for i in range(5)
    ]

    kept = hard_filter_discovery(
        [*generic, *lighting],
        scopes=["Lighting only"],
        finish_tier="mid",
        tiers=tiers,
        service_label="Bathroom remodel",
    )

    assert len(kept) == 5
    assert all("lighting-" in row["url"] for row in kept)
    assert all(row["relevanceScore"] >= MIN_DISCOVERY_RELEVANCE for row in kept)


def test_patio_scope_rejects_lawn_filler_and_generic_architecture() -> None:
    tiers = [{"id": "value"}, {"id": "mid"}, {"id": "premium"}]
    rows = [
        _img(
            url="https://example.com/patio.jpg",
            label="Finished paver patio terrace with outdoor seating",
            discovery={"primary_scope": "patio", "estimated_finish_tier": "mid"},
        ),
        _img(
            url="https://example.com/lawn.jpg",
            label="Fresh lawn grass close-up",
            discovery={"primary_scope": "lawn", "estimated_finish_tier": "mid"},
        ),
        _img(
            url="https://example.com/house.jpg",
            label="Modern house facade",
            discovery={"primary_scope": "exterior", "estimated_finish_tier": "mid"},
        ),
        _img(url="https://example.com/woods.jpg", label="Woodland planting view"),
    ]

    kept = hard_filter_discovery(
        rows,
        scopes=["Patio / terrace"],
        finish_tier="mid",
        tiers=tiers,
        service_label="Yard and garden design",
    )

    assert [row["url"] for row in kept] == ["https://example.com/patio.jpg"]


def test_refinement_options_never_enter_the_discovery_board() -> None:
    rows = [
        {
            **_img(
                url="https://example.com/refinement.jpg",
                label="White zellige glow",
                discovery={"primary_scope": "shower-tub", "estimated_finish_tier": "mid"},
            ),
            "generatedFor": "refinement_option",
            "clientQualified": True,
        }
    ]

    kept = hard_filter_discovery(
        rows,
        scopes=["Full Bathroom Remodel"],
        finish_tier="mid",
        tiers=[{"id": "value"}, {"id": "mid"}, {"id": "premium"}],
        service_label="Bathroom remodel",
    )

    assert kept == []


def test_first_gallery_keeps_exact_matches_first_then_fills_to_120() -> None:
    design = DesignState.model_validate(
        {
            "instanceId": "instance-1",
            "serviceId": "bathroom-remodel",
            "serviceLabel": "Bathroom remodel",
            "customerServiceLabel": "Bathroom remodel",
            "scopes": ["Countertop", "Wall tile"],
            "scopeKeys": ["Countertop", "Wall tile"],
            "budgetBandId": "value",
        }
    )
    exact = [
        _img(
            url=f"https://example.com/exact-{i}.jpg",
            label=f"Finished bathroom scene with countertop and tiled shower wall {i}",
            discovery={
                "primary_scope": "countertops",
                "estimated_finish_tier": "value",
            },
        )
        for i in range(3)
    ]
    broad = [
        _img(
            url=f"https://example.com/style-{i}.jpg",
            label=f"Styled bathroom project {i}",
            discovery={
                "primary_scope": "vanity",
                "estimated_finish_tier": "mid",
                "quality_score": 0.82,
            },
        ) | {
            "generatedFor": "v2_scope_starter",
            "clientQualified": True,
            "subcategoryId": "bathroom-remodel",
        }
        for i in range(130)
    ]

    page = discovery_page(
        design,
        finish_tier="value",
        limit=120,
        candidates=[*exact, *broad],
    )

    assert len(page["images"]) == 120
    assert page["counts"]["matched"] == 3
    assert page["counts"]["broad"] == 117
    assert all(row["retrievalMatch"] == "exact" for row in page["images"][:3])
    assert any(row["retrievalMatch"] == "broad" for row in page["images"][3:])
    assert page["hasMore"] is False


def test_unfiltered_gallery_keeps_catalog_order_and_ignores_scope_and_finish() -> None:
    design = DesignState.model_validate(
        {
            "instanceId": "instance-1",
            "serviceId": "bathroom-remodel",
            "serviceLabel": "Bathroom remodel",
            "scopes": ["Vanity"],
            "scopeKeys": ["Vanity"],
            "budgetBandId": "value",
        }
    )
    rows = [
        _img(url="https://example.com/shower.jpg", label="Shower", priceTier="$$$"),
        _img(url="https://example.com/vanity.jpg", label="Vanity", priceTier="$"),
        {
            **_img(url="https://example.com/refine.jpg", label="Tile option"),
            "generatedFor": "refinement_option",
        },
    ]

    page = discovery_page(
        design,
        finish_tier="value",
        limit=120,
        candidates=rows,
        unfiltered=True,
    )

    assert [row["url"] for row in page["images"]] == [
        "https://example.com/shower.jpg",
        "https://example.com/vanity.jpg",
    ]
    assert all(row["retrievalMatch"] == "broad" for row in page["images"])
    assert page["source"] == "library-unfiltered"
