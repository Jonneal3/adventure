"""DSPy module for scene-placement use case: product composited into a scene."""

from __future__ import annotations

import dspy


class ScenePlacementPromptSignature(dspy.Signature):
    """Generate an optimal image prompt for placing a product into a scene (scene-placement).

    You are generating a scene-placement/compositing prompt.
    The user provided a scene photo and a product photo.
    Your prompt must describe how to naturally integrate the product into the scene.
    Focus on matching: lighting direction, shadow angles, scale/perspective, color temperature.
    The result should look like the product was photographed in that exact environment.

    Rules:
    - Never include UUIDs, URLs, or technical identifiers in the prompt.
    - Never include text instructions like "no text" in the main prompt (use negative_prompt).
    - Keep prompts under 300 words; be specific and visual.
    """

    service_summary: str = dspy.InputField(
        desc="Short description of the service/project context (e.g. landscaping, interior design)."
    )
    subject: str = dspy.InputField(
        desc="Short service or project label (e.g. 'landscaping', 'kitchen remodel')."
    )
    style_tags: str = dspy.InputField(desc="Comma-separated style keywords (e.g. 'modern, clean').")
    location: str = dspy.InputField(desc="Geographic location if known.")
    scene_context: str = dspy.InputField(
        desc="One-line context for the scene/background (e.g. 'user provided scene as background')."
    )
    product_context: str = dspy.InputField(
        desc="One-line context for the product to place (e.g. 'user provided product to integrate')."
    )

    prompt: str = dspy.OutputField(
        desc="The image generation prompt: concise, visual, compositing-focused description"
    )
    negative_prompt: str = dspy.OutputField(
        desc="Negative prompt: things to avoid (text, logos, artifacts, wrong perspective)"
    )


class ScenePlacementPromptModule(dspy.Module):
    """Scene-placement use case: product composited into scene."""

    def __init__(self) -> None:
        super().__init__()
        self.generate = dspy.ChainOfThought(ScenePlacementPromptSignature)

    def forward(
        self,
        *,
        service_summary: str = "",
        subject: str = "",
        style_tags: str = "",
        location: str = "",
        scene_context: str = "",
        product_context: str = "",
    ):
        return self.generate(
            service_summary=service_summary or "",
            subject=subject or "project",
            style_tags=style_tags or "",
            location=location or "",
            scene_context=scene_context or "User provided a scene as background.",
            product_context=product_context or "User provided a product to place in the scene.",
        )


__all__ = ["ScenePlacementPromptModule", "ScenePlacementPromptSignature"]
