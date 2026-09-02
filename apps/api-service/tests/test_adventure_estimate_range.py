from programs.adventure_pipeline.orchestrator import _round_estimate_bounds


def test_customer_price_range_rounds_outward_without_collapsing() -> None:
    assert _round_estimate_bounds(3800, 4050, 500) == (3500, 4500)
    assert _round_estimate_bounds(4000, 4000, 500) == (3500, 4500)
    assert _round_estimate_bounds(8000, 5000, 500) == (5000, 8000)
