from programs.adventure_pipeline.catalog_tag import normalize_starter_profile_suggestion


def test_starter_profile_suggestion_is_never_auto_approved() -> None:
    profile = normalize_starter_profile_suggestion(
        {
            "visible_scope_keys": ["Shower Tub", "Vanity", "Unrelated Scope"],
            "hero_scope_keys": ["Shower Tub", "Vanity"],
            "finish_tier": "premium",
            "layout_family": "Compact Hall Bath",
            "camera_angle": "Doorway Three Quarter Wide",
            "fixture_inventory": {
                "wet zone count": 1,
                "vanity count": 1,
                "toilet count": 1,
            },
            "plainness_score": 0.9,
            "editability_score": 0.85,
            "structural_valid": True,
            "defects": [],
        },
        service_id="bathroom-service",
        service_scope_keys=["shower-tub", "vanity"],
        model="vision-test",
    )

    assert profile["eligible"] is False
    assert profile["review_status"] == "pending"
    assert profile["service_id"] == "bathroom-service"
    assert profile["visible_scope_keys"] == ["shower-tub", "vanity"]
    assert profile["hero_scope_keys"] == ["shower-tub", "vanity"]
    assert profile["structural_valid"] is True
    assert profile["fixture_inventory"] == {
        "wet_zone_count": 1,
        "vanity_count": 1,
        "toilet_count": 1,
    }


def test_starter_profile_defects_make_structure_invalid() -> None:
    profile = normalize_starter_profile_suggestion(
        {
            "visible_scope_keys": ["shower-tub"],
            "structural_valid": True,
            "defects": ["AI Artifact", "Duplicate Fixture"],
        }
    )

    assert profile["structural_valid"] is False
    assert profile["defects"] == ["ai-artifact", "duplicate-fixture"]
    assert profile["eligible"] is False
