from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol

from programs.image_request.types import ImageSpec


class ImageJudge(Protocol):
    def score(self, spec: ImageSpec, image_url: str) -> float:
        """Return score on a 0..10 scale."""


@dataclass
class DeterministicStubJudge:
    """Stable non-ML judge for local/offline testing."""

    floor: float = 3.0
    span: float = 4.0

    def score(self, spec: ImageSpec, image_url: str) -> float:
        data = f"{spec.user_prompt}|{spec.style_preset}|{image_url}".encode("utf-8")
        h = hashlib.sha256(data).hexdigest()
        raw = int(h[:8], 16) / 0xFFFFFFFF
        return max(0.0, min(10.0, self.floor + raw * self.span))


def clamp_score(score: float) -> float:
    if score < 0:
        return 0.0
    if score > 10:
        return 10.0
    return score
