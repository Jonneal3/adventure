from __future__ import annotations

import os
import statistics
from dataclasses import dataclass
from typing import Iterable, List

from programs.image_request.eval.judge import ImageJudge, clamp_score
from programs.image_request.providers.replicate_adapter import render_with_replicate
from programs.image_request.types import ImageRequest, ImageSpec


@dataclass
class ConsistencyScore:
    values: List[float]
    mean: float
    stdev: float
    objective: float


def evaluate_request_consistency(
    spec: ImageSpec,
    request: ImageRequest,
    *,
    seeds: Iterable[int],
    judge: ImageJudge,
    model: str | None = None,
    variance_penalty: float | None = None,
) -> ConsistencyScore:
    values: List[float] = []
    for seed in seeds:
        image_url = render_with_replicate(request=request, spec=spec, seed=int(seed), model=model)
        values.append(clamp_score(float(judge.score(spec, image_url))))

    if not values:
        raise ValueError("At least one seed is required")
    mean = statistics.mean(values)
    stdev = statistics.pstdev(values) if len(values) > 1 else 0.0
    lam = float(variance_penalty if variance_penalty is not None else os.getenv("IMAGE_OPT_LAMBDA", "0.8"))
    objective = mean - (lam * stdev)
    return ConsistencyScore(values=values, mean=mean, stdev=stdev, objective=objective)
