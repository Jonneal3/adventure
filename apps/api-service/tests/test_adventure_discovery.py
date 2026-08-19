from programs.adventure_pipeline.discovery import hard_filter_discovery, project_discovery


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


def test_hard_filter_drops_unlabeled_and_far_tiers() -> None:
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
    assert "https://example.com/a.jpg" in urls
    assert "https://example.com/b.jpg" in urls
    assert "https://example.com/c.jpg" not in urls
    assert "https://example.com/d.jpg" not in urls
    assert "https://example.com/e.jpg" not in urls


def test_full_bath_keeps_part_photos_and_untagged() -> None:
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
    assert "https://example.com/premium.jpg" not in urls
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
