from programs.adventure_pipeline.budget_bands import adjacent_finish_tiers, propose_budget_bands


def test_vanity_slider_is_smaller_than_full_bath() -> None:
    vanity = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Vanity"])
    full = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Full Bathroom Remodel"])
    assert vanity["min"] == 500
    assert vanity["max"] < full["max"]
    assert vanity["min"] <= vanity["defaultAmount"] <= vanity["max"]
    assert full["min"] <= full["defaultAmount"] <= full["max"]


def test_shower_sits_between_vanity_and_full() -> None:
    vanity = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Vanity"])
    shower = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Shower / Tub"])
    full = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Full Bathroom Remodel"])
    assert vanity["max"] <= shower["max"] <= full["max"]


def test_finish_tiers_are_scope_aware() -> None:
    vanity = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Vanity"])
    full = propose_budget_bands(service_label="Bathroom Remodel", scopes=["Full Bathroom Remodel"])
    vanity_tiers = vanity["finishTiers"]
    full_tiers = full["finishTiers"]
    assert vanity_tiers[0]["min"] == 500
    assert 5 <= len(vanity_tiers) <= 8
    assert vanity_tiers[-1]["openEnded"] is True
    assert full_tiers[0]["min"] <= 1_500
    assert 5 <= len(full_tiers) <= 8
    assert full_tiers[-1]["openEnded"] is True
    assert full_tiers[-1]["min"] >= 40_000
    allowed = adjacent_finish_tiers("value", vanity_tiers)
    assert "value" in allowed and "mid" in allowed
    assert "premium" not in allowed


def test_each_service_uses_its_own_rungs() -> None:
    paint = propose_budget_bands(service_label="Interior Painting", scopes=["Specific Rooms"])
    kitchen = propose_budget_bands(service_label="Kitchen Remodel", scopes=["Full Kitchen Remodel"])
    assert paint["finishTiers"][0]["min"] == 250
    assert paint["finishTiers"][-1]["openEnded"] is True
    assert 2 <= len(paint["finishTiers"]) <= 8
    assert kitchen["finishTiers"][0]["min"] <= 3_000
    assert 5 <= len(kitchen["finishTiers"]) <= 8
    assert kitchen["finishTiers"][-1]["openEnded"] is True
    assert kitchen["finishTiers"][-1]["min"] >= 60_000
