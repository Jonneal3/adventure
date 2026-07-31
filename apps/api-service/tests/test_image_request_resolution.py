from __future__ import annotations

from programs.image_generator import orchestrator
from programs.image_generator.model_catalog import resolve_model_entry
from programs.image_generator.provider_request_builder import build_replicate_request
from programs.image_generator.request_normalizer import resolve_image_request
from programs.image_generator.providers import image_generation


def test_resolve_scene_without_refs_uses_flux_pro_defaults() -> None:
    resolved = resolve_image_request(
        {
            "instanceId": "instance-1",
            "useCase": "scene",
        }
    )

    assert resolved["modelId"] == "black-forest-labs/flux-1.1-pro"
    assert resolved["outputFormat"] == "png"
    assert resolved["provider"] == "replicate"


def test_resolve_scene_with_anchor_image_uses_flux_2_pro() -> None:
    resolved = resolve_image_request(
        {
            "instanceId": "instance-2",
            "useCase": "scene",
            "sceneImage": "https://example.com/scene.png",
            "referenceImages": ["https://example.com/scene.png"],
        }
    )

    assert resolved["modelId"] == "black-forest-labs/flux-2-pro"
    assert resolved["outputFormat"] == "png"
    assert resolved["routingPolicy"]["provider"] == "replicate"


def test_resolve_scene_guide_only_refs_stays_text_to_image_routing() -> None:
    """Style-only reference URLs must not trigger anchored-edit routing."""
    resolved = resolve_image_request(
        {
            "instanceId": "instance-guide",
            "useCase": "scene",
            "referenceMode": "guide_only",
            "referenceImages": ["https://example.com/inspo-a.png", "https://example.com/inspo-b.png"],
        }
    )

    assert resolved["modelId"] == "black-forest-labs/flux-1.1-pro"
    assert resolved["routingPolicy"]["provider"] == "replicate"


def test_resolve_scene_placement_uses_flux_2_pro_defaults() -> None:
    resolved = resolve_image_request(
        {
            "instanceId": "instance-3",
            "useCase": "scene-placement",
            "sceneImage": "https://example.com/scene.png",
            "productImage": "https://example.com/product.png",
        }
    )

    assert resolved["modelId"] == "black-forest-labs/flux-2-pro"
    assert "inpainting" in resolved["routingPolicy"]["traits"]


def test_resolve_scene_refinement_uses_high_quality_flux_2_defaults() -> None:
    resolved = resolve_image_request(
        {
            "instanceId": "instance-fast-edit",
            "useCase": "scene-refinement",
            "sceneImage": "https://example.com/scene.png",
            "refinementNotes": "Use warmer materials and improve the lighting.",
        }
    )

    assert resolved["modelId"] == "black-forest-labs/flux-2-pro"
    assert resolved["numInferenceSteps"] == 28
    assert resolved["outputFormat"] == "png"


def test_resolve_tryon_uses_nano_banana_defaults() -> None:
    resolved = resolve_image_request(
        {
            "instanceId": "instance-4",
            "useCase": "tryon",
            "userImage": "https://example.com/user.png",
            "productImage": "https://example.com/product.png",
        }
    )

    assert resolved["modelId"] == "google/nano-banana"
    assert "faces" in resolved["requiredTags"]


def test_thumbnail_resolution_prefers_flux_schnell_for_speed() -> None:
    model = resolve_model_entry(use_case="scene", is_thumbnail=True)

    assert model.model_id == "black-forest-labs/flux-schnell"
    assert model.speed == "very_fast"


def test_build_replicate_request_uses_grok_edit_shape() -> None:
    request = build_replicate_request(
        prompt="Place the chair in the room.",
        model_id="xai/grok-imagine-image",
        scene_image="https://example.com/scene.png",
        num_outputs=1,
    )

    assert request["modelId"] == "xai/grok-imagine-image"
    assert request["input"]["image"] == "https://example.com/scene.png"
    assert "aspect_ratio" not in request["input"]


def test_build_replicate_request_uses_p_image_edit_shape() -> None:
    request = build_replicate_request(
        prompt="Use warmer tile and improve the lighting.",
        model_id="prunaai/p-image-edit",
        scene_image="https://example.com/scene.png",
        reference_images=["https://example.com/scene.png", "https://example.com/material.png"],
        num_outputs=1,
    )

    assert request["modelId"] == "prunaai/p-image-edit"
    assert request["input"]["images"] == [
        "https://example.com/scene.png",
        "https://example.com/material.png",
    ]
    assert request["input"]["aspect_ratio"] == "match_input_image"

def test_build_replicate_request_uses_flux_2_successive_edit_shape() -> None:
    request = build_replicate_request(
        prompt="Edit the supplied current image by adding a physically buildable half wall for the shower.",
        model_id="black-forest-labs/flux-2-pro",
        scene_image="https://example.com/current-revision.png",
        reference_images=[
            "https://example.com/current-revision.png",
            "https://example.com/product-reference.png",
        ],
        output_format="png",
        aspect_ratio="match_input_image",
        safety_tolerance=2,
        num_outputs=1,
    )

    assert request["modelId"] == "black-forest-labs/flux-2-pro"
    assert request["input"]["input_images"] == [
        "https://example.com/current-revision.png",
        "https://example.com/product-reference.png",
    ]
    assert request["input"]["aspect_ratio"] == "match_input_image"
    assert request["input"]["resolution"] == "match_input_image"
    assert request["input"]["output_format"] == "png"
    assert request["input"]["output_quality"] == 100


def test_build_replicate_request_uses_fast_p_image_generation_shape() -> None:
    request = build_replicate_request(
        prompt="A polished modern outdoor living concept.",
        model_id="prunaai/p-image",
        aspect_ratio="16:9",
        num_outputs=1,
    )

    assert request["modelId"] == "prunaai/p-image"
    assert request["input"] == {
        "prompt": "A polished modern outdoor living concept.",
        "aspect_ratio": "16:9",
        "prompt_upsampling": False,
        "disable_safety_checker": False,
    }


def test_generate_image_resolves_model_before_provider_call(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def _fake_build_image_prompt(_payload):
        return {
            "ok": True,
            "prompt": {
                "prompt": "Generated by DSPy inside the image request.",
                "negativePrompt": "watermark, blurry",
            },
        }

    def _fake_generate_images(**kwargs):
        captured.update(kwargs)
        return {
            "id": "pred_test_resolved",
            "status": "succeeded",
            "output": ["https://example.com/generated.png"],
        }

    monkeypatch.setattr(orchestrator, "build_image_prompt", _fake_build_image_prompt)
    monkeypatch.setattr(image_generation, "generate_images", _fake_generate_images)

    resp = orchestrator.generate_image(
        {
            "instanceId": "instance-5",
            "useCase": "scene",
            "numOutputs": 1,
        }
    )

    assert resp["ok"] is True
    assert captured["model_id"] == "black-forest-labs/flux-1.1-pro"
    assert captured["output_format"] == "png"
