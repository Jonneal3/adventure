from __future__ import annotations

from programs.adventure_pipeline.visual_directions import assign_discovery_model, plan_visual_directions


def test_fallback_explore_returns_twelve_varied_directions() -> None:
    result = plan_visual_directions(
        {
            "count": 12,
            "round": 0,
            "serviceLabel": "Bathroom Remodel",
            "scopes": ["Vanity", "Flooring"],
            "budget": 15000,
            "sessionId": "session-a",
        },
        llm_result={},
    )
    assert result["ok"] is True
    assert result["source"] == "fallback"
    assert result["room"] == "residential bathroom"
    assert len(result["directions"]) == 12
    prompts = [row["prompt"] for row in result["directions"]]
    assert len(set(prompts)) >= 8
    assert result["modelId"] in (
        "black-forest-labs/flux-schnell",
        "google/imagen-4-fast",
    )


def test_llm_directions_are_used_when_present() -> None:
    result = plan_visual_directions(
        {
            "count": 4,
            "round": 0,
            "serviceLabel": "Bathroom Remodel",
            "scopes": ["Vanity"],
            "sessionId": "session-b",
        },
        llm_result={
            "directions": [
                {"label": "warm modern", "prompt": "warm oak vanity, pale stone, daylight"},
                {"label": "dark traditional", "prompt": "dark wood, cream tile, evening light"},
                {"label": "minimal", "prompt": "quiet surfaces, floating vanity"},
                {"label": "organic", "prompt": "natural stone, plants, soft light"},
            ]
        },
    )
    assert result["source"] == "llm"
    assert [row["label"] for row in result["directions"]] == [
        "warm modern",
        "dark traditional",
        "minimal",
        "organic",
    ]


def test_narrow_round_keeps_liked_looks_in_fallback() -> None:
    result = plan_visual_directions(
        {
            "count": 6,
            "round": 1,
            "serviceLabel": "Bathroom Remodel",
            "scopes": ["Vanity", "Flooring"],
            "likedDirections": [
                {"label": "warm modern", "prompt": "warm oak vanity, pale stone, daylight"},
            ],
            "sessionId": "session-c",
        },
        llm_result={},
    )
    blob = " ".join(row["prompt"].lower() for row in result["directions"])
    assert "warm oak vanity" in blob


def test_modest_budget_fallback_skips_luxury() -> None:
    result = plan_visual_directions(
        {
            "count": 12,
            "round": 0,
            "serviceLabel": "Bathroom Remodel",
            "scopes": ["Vanity"],
            "budget": 5000,
            "sessionId": "session-d",
        },
        llm_result={},
    )
    blob = " ".join(f"{row['label']} {row['prompt']}".lower() for row in result["directions"])
    assert "luxury" not in blob
    assert "evening glow" not in blob
    palettes = {str(row.get("palette") or row.get("family") or row["prompt"]).lower() for row in result["directions"]}
    assert len(palettes) >= 8
    assert any("navy" in p or "sage" in p or "terracotta" in p for p in palettes)


def test_bathroom_fallback_varies_tile_and_fixtures() -> None:
    result = plan_visual_directions(
        {
            "count": 6,
            "round": 0,
            "serviceLabel": "Bathroom Remodel",
            "scopes": ["Shower", "Tub"],
            "budget": 6500,
            "sessionId": "session-e",
        },
        llm_result={},
    )
    families = [str(row.get("family") or "") for row in result["directions"]]
    assert len(set(f for f in families if f)) == 6
    blob = " ".join(f"{row.get('surfaces', '')} {row.get('fixtures', '')} {row['prompt']}".lower() for row in result["directions"])
    assert "subway" in blob or "herringbone" in blob or "hex" in blob or "zellige" in blob
    assert "rain" in blob or "brass" in blob or "matte black" in blob


def test_discovery_model_split_is_sticky() -> None:
    first = assign_discovery_model("session-alpha")
    assert first in ("black-forest-labs/flux-schnell", "google/imagen-4-fast")
    assert assign_discovery_model("session-alpha") == first
    assert assign_discovery_model("x", "imagen") == "google/imagen-4-fast"
    assert assign_discovery_model("x", "schnell") == "black-forest-labs/flux-schnell"
