from __future__ import annotations

from programs.adventure_pipeline.intake import plan_intake
from programs.adventure_pipeline.recipes import match_recipe, scope_question_for_service


def test_single_service_skips_without_llm() -> None:
    result = plan_intake(
        {
            "step": "service",
            "services": [
                {
                    "id": "bath-1",
                    "businessLabel": "Bathroom Remodeling",
                    "customerLabel": "Bathroom remodel",
                }
            ],
        },
        llm_result=None,
    )
    assert result["skip"] is True
    assert result["selectedServiceId"] == "bath-1"
    assert result["step"] == "service"


def test_groq_can_skip_redundant_services() -> None:
    result = plan_intake(
        {
            "step": "service",
            "services": [
                {"id": "a", "customerLabel": "Bathroom Remodeling"},
                {"id": "b", "customerLabel": "Bathroom Design Consult"},
            ],
        },
        llm_result={"skip": True, "selectedServiceId": "a", "choices": []},
    )
    assert result["skip"] is True
    assert result["selectedServiceId"] == "a"
    assert result["source"] == "llm"


def test_service_choices_bind_to_catalog_ids() -> None:
    result = plan_intake(
        {
            "step": "service",
            "services": [
                {"id": "k", "customerLabel": "Kitchen Remodeling", "businessLabel": "Kitchen Remodeling"},
                {"id": "b", "customerLabel": "Bathroom Remodeling", "businessLabel": "Bathroom Remodeling"},
                {"id": "a", "customerLabel": "Additions", "businessLabel": "Additions"},
            ],
        },
        llm_result={
            "skip": False,
            "question": "What are you working on?",
            "subtitle": "Pick one.",
            "selectionType": "single",
            "choices": [
                {"label": "Kitchen", "serviceId": "k"},
                {"label": "Bathroom", "id": "b"},
                {"label": "Spaceship", "serviceId": "not-real"},
            ],
        },
    )
    assert result["skip"] is False
    assert result["question"] == "What are you working on?"
    ids = [c["serviceId"] for c in result["choices"]]
    assert ids == ["k", "b"]


def test_bathroom_scope_is_vertical_config() -> None:
    result = plan_intake(
        {
            "step": "scope",
            "selectedServiceId": "bath-1",
            "services": [{"id": "bath-1", "customerLabel": "Bathroom Remodeling"}],
        },
        llm_result={"question": "ignore me", "choices": [{"label": "Should not appear"}]},
    )
    labels = [c["label"] for c in result["choices"]]
    assert result["question"] == "What would you like to include?"
    assert result["selectionType"] == "multiple"
    assert result["source"] == "recipe"
    assert labels[0] == "Full Bathroom Remodel"
    assert "Vanity" in labels
    assert "Shower / Tub" in labels
    assert labels[-1] == "Other"
    assert "Everything" not in labels


def test_landscaping_and_painting_use_natural_full_scope() -> None:
    land = scope_question_for_service({"id": "l", "customerLabel": "Landscaping"})
    paint = scope_question_for_service({"id": "p", "customerLabel": "House Painting"})
    pool = scope_question_for_service({"id": "o", "customerLabel": "Pool Remodel"})
    assert land["choices"][0]["label"] == "Full Landscape Project"
    assert "Pavers" in [c["label"] for c in land["choices"]]
    assert paint["choices"][0]["label"] == "Whole House"
    assert "Trim & Doors" in [c["label"] for c in paint["choices"]]
    assert pool["choices"][0]["label"] == "Complete Pool Remodel"
    assert match_recipe(service_label="Kitchen Remodeling")["fullScope"] == "Full Kitchen Remodel"


def test_scope_follows_the_selected_service_not_summary_substrings() -> None:
    from programs.adventure_pipeline.recipes import recipe_key

    assert recipe_key(industry="Home services", service_label="Landscaping", summary="Outdoor living spaces") == "landscaping"
    assert recipe_key(industry="Home improvement", service_label="Bathroom Remodeling", summary="spa-like whirlpool tub") == "bathroom"
    assert recipe_key(service_label="Pool Remodel") == "pool"
    assert recipe_key(service_label="Windows & Doors") == "windows"

    from programs.adventure_pipeline.recipes import look_conflicts_with_service

    assert look_conflicts_with_service("Kitchen island", service_label="Bathroom Remodel") is True
    assert look_conflicts_with_service("Warm oak vanity", service_label="Bathroom Remodel") is False
    assert look_conflicts_with_service("Windows / Doors", service_label="Bathroom Remodel") is True

    stored = scope_question_for_service(
        {
            "id": "l",
            "customerLabel": "Landscaping",
            "summary": "Outdoor living spaces",
            "knownParts": ["Pavers", "Planting", "Irrigation"],
        }
    )
    labels = [c["label"] for c in stored["choices"]]
    assert stored["source"] == "service"
    assert labels[0] == "Full Landscape Project"
    assert labels[1:-1] == ["Pavers", "Planting", "Irrigation"]
    assert "Shell" not in labels
    assert "Complete Pool Remodel" not in labels

    bath = scope_question_for_service(
        {
            "id": "b",
            "customerLabel": "Bathroom Remodeling",
            "summary": "spa bathrooms and whirlpool tubs",
        }
    )
    assert bath["source"] == "recipe"
    assert bath["choices"][0]["label"] == "Full Bathroom Remodel"
    assert bath["recipeKey"] == "bathroom"
