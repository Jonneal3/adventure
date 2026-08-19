from programs.adventure_pipeline.catalog_tag import (
    already_tagged,
    discovery_hidden,
    inspiration_blocked,
    needs_review,
    normalize_catalog_tags,
)
from programs.adventure_pipeline.discovery import hard_filter_discovery


def test_normalize_rejects_hard_defects() -> None:
    tags = normalize_catalog_tags(
        {
            "primary_scope": "Vanity",
            "estimated_finish_tier": "premium",
            "style": "modern",
            "quality_score": 0.9,
            "verdict": "keep",
            "keep": True,
            "defects": ["watermark"],
        },
        model="gemini-2.5-flash-lite",
    )
    assert tags["primary_scope"] == "vanity"
    assert tags["keep"] is False
    assert tags["verdict"] == "reject"
    assert "watermark" in tags["defects"]
    assert tags["model"] == "gemini-2.5-flash-lite"


def test_normalize_keeps_clean_catalog_shot() -> None:
    tags = normalize_catalog_tags(
        {
            "primary_scope": "full-bathroom-remodel",
            "estimated_finish_tier": "mid",
            "style": "transitional",
            "contains": ["vanity", "shower"],
            "quality_score": 0.84,
            "verdict": "keep",
            "keep": True,
            "defects": [],
        }
    )
    assert tags["keep"] is True
    assert tags["verdict"] == "keep"
    assert tags["quality_score"] == 0.84
    assert tags["role"] == "inspiration"
    assert tags["inspirational"] is True
    assert "subway" in (tags.get("search_text") or "") or "vanity" in (tags.get("search_text") or "")
    assert discovery_hidden(tags) is False


def test_needs_review_only_for_ambiguous_taste() -> None:
    keep = normalize_catalog_tags({"primary_scope": "vanity", "verdict": "keep", "quality_score": 0.88, "keep": True})
    reject = normalize_catalog_tags({"primary_scope": "other", "verdict": "reject", "defects": ["blur"], "keep": False})
    taste = normalize_catalog_tags({"primary_scope": "vanity", "verdict": "keep", "quality_score": 0.5, "keep": True})
    review = normalize_catalog_tags({"primary_scope": "vanity", "verdict": "review", "quality_score": 0.58})
    assert needs_review(keep) is False
    assert needs_review(reject) is False
    assert needs_review(taste) is True
    assert needs_review(review) is True


def test_untagged_rows_are_not_hidden() -> None:
    assert already_tagged({}) is False
    assert discovery_hidden({}) is False
    assert discovery_hidden(None) is False


def test_gallery_drops_rejected_photos() -> None:
    tiers = [
        {"id": "value", "min": 1500, "max": 4000},
        {"id": "mid", "min": 4000, "max": 8000},
    ]
    rows = [
        {
            "url": "https://example.com/good.jpg",
            "discovery": {"primary_scope": "vanity", "estimated_finish_tier": "value", "keep": True, "verdict": "keep"},
        },
        {
            "url": "https://example.com/bad.jpg",
            "discovery": {
                "primary_scope": "vanity",
                "estimated_finish_tier": "value",
                "keep": False,
                "verdict": "reject",
                "defects": ["watermark"],
            },
        },
    ]
    kept = hard_filter_discovery(rows, scopes=["Vanity"], finish_tier="value", tiers=tiers)
    urls = [r["url"] for r in kept]
    assert "https://example.com/good.jpg" in urls
    assert "https://example.com/bad.jpg" not in urls


def test_dated_builder_bath_is_not_inspiration() -> None:
    tags = normalize_catalog_tags(
        {
            "primary_scope": "full-bathroom-remodel",
            "style": "other",
            "mood": "dated",
            "lighting": "dingy",
            "estimated_finish_tier": "value",
            "tile_shape": "square",
            "tile_color": "beige",
            "hardware_finish": "chrome",
            "description": "Yellow dingy builder bath with 4x4 tile",
            "quality_score": 0.4,
            "verdict": "keep",
            "keep": True,
            "defects": ["dated", "dingy", "builder-basic"],
        }
    )
    assert tags["keep"] is False
    assert tags["inspirational"] is False
    assert tags["role"] == "before"
    assert discovery_hidden(tags) is True
    assert "beige" in (tags.get("search_text") or "") or "dated" in (tags.get("search_text") or "")


def test_starters_are_blocked_until_tagged_as_inspiration() -> None:
    assert inspiration_blocked(generated_for="v2_scope_starter", discovery=None) is True
    assert inspiration_blocked(generated_for="style_seed", discovery={}) is True
    assert inspiration_blocked(generated_for="adventure_v8", discovery=None) is False
    kept = {
        "role": "inspiration",
        "keep": True,
        "inspirational": True,
        "verdict": "keep",
        "primary_scope": "vanity",
    }
    assert inspiration_blocked(generated_for="v2_scope_starter", discovery=kept) is False


def test_gallery_drops_starter_canvases() -> None:
    tiers = [{"id": "value", "min": 1500, "max": 8000}, {"id": "mid", "min": 8000, "max": 15000}]
    rows = [
        {
            "url": "https://example.com/nice.jpg",
            "generatedFor": "adventure_v8",
            "discovery": {
                "primary_scope": "full-bathroom-remodel",
                "estimated_finish_tier": "value",
                "keep": True,
                "verdict": "keep",
                "role": "inspiration",
                "inspirational": True,
            },
        },
        {
            "url": "https://example.com/starter.jpg",
            "generatedFor": "v2_scope_starter",
            "label": "Full Bathroom Remodel",
            "discovery": {"primary_scope": "full-bathroom-remodel", "estimated_finish_tier": "value"},
        },
    ]
    kept = hard_filter_discovery(rows, scopes=["Full Bathroom Remodel"], finish_tier="value", tiers=tiers)
    urls = [r["url"] for r in kept]
    assert "https://example.com/nice.jpg" in urls
    assert "https://example.com/starter.jpg" not in urls
