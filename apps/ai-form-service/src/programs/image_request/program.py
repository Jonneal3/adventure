from __future__ import annotations

import json
from typing import Any, Optional

from programs.image_request.types import ImageRequest

try:
    import dspy  # type: ignore
except Exception:  # pragma: no cover
    dspy = None


if dspy is not None:

    class MakeImageRequest(dspy.Signature):
        """Turn widget spec text into a structured image request."""

        spec = dspy.InputField(desc="Widget spec and policy text.")
        prompt = dspy.OutputField(desc="Positive prompt for image generation.")
        negative_prompt = dspy.OutputField(desc="Negative prompt for artifact reduction.")
        params_json = dspy.OutputField(desc="JSON string for generation params.")


class ImageRequestProgram:
    """Version-safe wrapper around a DSPy module.

    Falls back to a deterministic heuristic when DSPy is unavailable.
    """

    def __init__(self, *, policy: Optional[str] = None) -> None:
        self.policy = policy or ""
        self._gen: Optional[Any] = None
        if dspy is not None:
            self._gen = dspy.ChainOfThought(MakeImageRequest)

    def _fallback(self, spec: str) -> ImageRequest:
        prompt = spec.strip()
        if self.policy:
            prompt = f"{prompt}\n{self.policy}".strip()
        return ImageRequest(
            prompt=prompt,
            negative_prompt="blurry, low quality, artifacts, text, watermark",
            params={"steps": 28, "guidance_scale": 3.5, "safety_tolerance": 2},
        )

    def forward(self, spec: str) -> ImageRequest:
        if self._gen is None:
            return self._fallback(spec)

        out = self._gen(spec=spec)
        try:
            params = json.loads(getattr(out, "params_json", "") or "{}")
        except Exception:
            params = {}
        if not isinstance(params, dict):
            params = {}

        return ImageRequest(
            prompt=str(getattr(out, "prompt", "")).strip(),
            negative_prompt=str(getattr(out, "negative_prompt", "")).strip(),
            params=params,
        )

    __call__ = forward
