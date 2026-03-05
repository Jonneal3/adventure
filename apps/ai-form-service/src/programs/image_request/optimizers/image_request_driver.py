from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from typing import Iterable, List, Optional

from programs.image_request.eval.consistency import ConsistencyScore, evaluate_request_consistency
from programs.image_request.eval.judge import ImageJudge
from programs.image_request.program import ImageRequestProgram
from programs.image_request.types import ImageSpec, spec_to_promptable_text

try:
    import dspy  # type: ignore
except Exception:  # pragma: no cover
    dspy = None


@dataclass
class ProgramEval:
    mean_objective: float
    per_spec: List[ConsistencyScore]


@dataclass
class OptimizationResult:
    best_program: ImageRequestProgram
    best_score: float
    baseline_score: float
    optimizer_used: str


def evaluate_program(
    program: ImageRequestProgram,
    specs: Iterable[ImageSpec],
    *,
    seeds: Iterable[int],
    judge: ImageJudge,
    model: Optional[str] = None,
    variance_penalty: Optional[float] = None,
) -> ProgramEval:
    rows: List[ConsistencyScore] = []
    for spec in specs:
        req = program(spec_to_promptable_text(spec, policy=program.policy))
        rows.append(
            evaluate_request_consistency(
                spec=spec,
                request=req,
                seeds=seeds,
                judge=judge,
                model=model,
                variance_penalty=variance_penalty,
            )
        )
    if not rows:
        raise ValueError("Training set cannot be empty")
    score = sum(r.objective for r in rows) / len(rows)
    return ProgramEval(mean_objective=score, per_spec=rows)


def _compile_with_dspy(program: ImageRequestProgram, train_specs: List[ImageSpec]) -> ImageRequestProgram | None:
    if dspy is None:
        return None

    teleprompter = None
    for cls_name in ("MIPROv2", "GEPA"):
        cls = getattr(dspy, cls_name, None)
        if cls is not None:
            try:
                teleprompter = cls()
                break
            except Exception:
                continue
    if teleprompter is None:
        return None

    trainset = [{"spec": spec_to_promptable_text(spec)} for spec in train_specs]
    try:
        compiled = teleprompter.compile(program, trainset=trainset)
        if compiled is not None:
            return compiled
    except Exception:
        return None
    return None


def _manual_policy_search(
    train_specs: List[ImageSpec],
    *,
    seeds: Iterable[int],
    judge: ImageJudge,
    model: Optional[str],
    variance_penalty: Optional[float],
    max_iters: int,
) -> OptimizationResult:
    baseline_program = ImageRequestProgram()
    baseline = evaluate_program(
        baseline_program,
        train_specs,
        seeds=seeds,
        judge=judge,
        model=model,
        variance_penalty=variance_penalty,
    ).mean_objective
    best_program = baseline_program
    best_score = baseline
    policies = [
        "Prioritize stable composition and avoid brittle stylistic overfitting.",
        "Keep prompts concise; enforce strict negatives for text, watermark, and artifacts.",
        "Lock core nouns/adjectives from user intent before adding style/camera language.",
        "When uncertain, prefer clean lighting and realistic material consistency.",
        "For first-try reliability, avoid extreme artistic modifiers unless explicitly requested.",
    ]
    for policy in policies[: max(1, max_iters)]:
        candidate = ImageRequestProgram(policy=policy)
        score = evaluate_program(
            candidate,
            train_specs,
            seeds=seeds,
            judge=judge,
            model=model,
            variance_penalty=variance_penalty,
        ).mean_objective
        if score > best_score:
            best_program = candidate
            best_score = score
    return OptimizationResult(
        best_program=best_program,
        best_score=best_score,
        baseline_score=baseline,
        optimizer_used="manual_policy_search",
    )


def optimize_image_request_program(
    train_specs: List[ImageSpec],
    *,
    seeds: Iterable[int],
    judge: ImageJudge,
    model: Optional[str] = None,
    variance_penalty: Optional[float] = None,
    max_iters: int = 30,
) -> OptimizationResult:
    fallback = _manual_policy_search(
        train_specs,
        seeds=seeds,
        judge=judge,
        model=model,
        variance_penalty=variance_penalty,
        max_iters=max_iters,
    )
    baseline_program = ImageRequestProgram()
    compiled = _compile_with_dspy(baseline_program, train_specs)
    if compiled is None:
        return fallback

    compiled_score = evaluate_program(
        compiled,
        train_specs,
        seeds=seeds,
        judge=judge,
        model=model,
        variance_penalty=variance_penalty,
    ).mean_objective
    if compiled_score <= fallback.best_score:
        return fallback

    return OptimizationResult(
        best_program=compiled,
        best_score=compiled_score,
        baseline_score=fallback.baseline_score,
        optimizer_used="dspy_compile",
    )


def serialize_program(program: ImageRequestProgram) -> dict:
    # For now we only persist lightweight tunables needed by runtime generation.
    return {"policy": program.policy}


def hydrate_program(payload: dict) -> ImageRequestProgram:
    policy = str((payload or {}).get("policy") or "").strip()
    return ImageRequestProgram(policy=policy)


def serialize_spec(spec: ImageSpec) -> dict:
    return dataclasses.asdict(spec)
