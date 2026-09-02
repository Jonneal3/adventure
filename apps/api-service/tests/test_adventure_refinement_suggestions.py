from __future__ import annotations

from programs.adventure_pipeline.refinement_suggestions import plan_refinement_suggestions


def test_fixture_fallback_is_target_specific() -> None:
    result = plan_refinement_suggestions(
        {
            "serviceLabel": "Bathroom Remodel",
            "target": "Faucets & fixtures",
            "components": ["Vanity", "Faucets & fixtures", "Wall tile"],
        },
        llm_result={},
    )
    assert result["ok"] is True
    assert result["source"] == "fallback"
    assert [row["label"] for row in result["suggestions"]] == [
        "Polished chrome",
        "Brushed nickel",
        "Matte black",
    ]


def test_llm_suggestions_are_cleaned_and_cost_duplicates_are_replaced() -> None:
    result = plan_refinement_suggestions(
        {"target": "Vanity"},
        llm_result={
            "suggestions": [
                {"label": "Walnut finish", "prompt": "Use a restrained walnut veneer."},
                {"label": "More premium", "prompt": "Spend more."},
                {"label": "Slim hardware", "prompt": "Use slim brushed-nickel pulls."},
            ]
        },
    )
    assert result["source"] == "llm"
    assert len(result["suggestions"]) == 3
    labels = [row["label"] for row in result["suggestions"]]
    assert labels[:2] == ["Walnut finish", "Slim hardware"]
    assert "More premium" not in labels


def test_anywhere_fallback_uses_room_wide_finish_changes() -> None:
    result = plan_refinement_suggestions({"target": "Anywhere"}, llm_result={})
    assert len(result["suggestions"]) == 3
    assert {row["label"] for row in result["suggestions"]} == {
        "Make it warmer",
        "More modern",
        "Add contrast",
    }
