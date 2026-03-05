from __future__ import annotations

import argparse
import json
import os
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from programs.image_request.eval.judge import DeterministicStubJudge
from programs.image_request.optimizers.image_request_driver import optimize_image_request_program, serialize_program
from programs.image_request.training.artifacts import load_artifact, save_artifact
from programs.image_request.types import ImageSpec

router = APIRouter(prefix="/v1/api", tags=["image-optimization"])
compat_router = APIRouter(prefix="/api", tags=["image-optimization"])


class TrainSpecModel(BaseModel):
    user_prompt: str
    style_preset: str
    aspect: str = "1:1"
    constraints: str = ""
    reference_image_url: str | None = None
    mask_image_url: str | None = None
    task: str = "t2i"


class TrainRequest(BaseModel):
    train_specs: List[TrainSpecModel]
    seeds: List[int] = Field(default_factory=lambda: [101, 303, 707])
    model: str = Field(default_factory=lambda: os.getenv("REPLICATE_MODEL_ID", "black-forest-labs/flux-1.1-pro"))
    variance_penalty: float = 0.8
    max_iters: int = 12


def _run_training(payload: TrainRequest) -> dict:
    judge = DeterministicStubJudge()
    result = optimize_image_request_program(
        train_specs=[ImageSpec(**s.model_dump()) for s in payload.train_specs],
        seeds=payload.seeds,
        judge=judge,
        model=payload.model,
        variance_penalty=payload.variance_penalty,
        max_iters=payload.max_iters,
    )
    artifact = {
        "optimizer_used": result.optimizer_used,
        "baseline_score": result.baseline_score,
        "best_score": result.best_score,
        "model": payload.model,
        "seeds": payload.seeds,
        "variance_penalty": payload.variance_penalty,
        "program": serialize_program(result.best_program),
        "train_specs": [s.model_dump() for s in payload.train_specs],
    }
    saved_path = save_artifact(artifact)
    return {"ok": True, "artifactPath": str(saved_path), **artifact}


@router.post("/image-optimization/train")
def train_image_request_program(body: TrainRequest) -> dict:
    return _run_training(body)


@compat_router.post("/image-optimization/train")
def train_image_request_program_compat(body: TrainRequest) -> dict:
    return _run_training(body)


@router.get("/image-optimization/artifact")
def get_latest_artifact() -> dict:
    return {"ok": True, "artifact": load_artifact()}


@compat_router.get("/image-optimization/artifact")
def get_latest_artifact_compat() -> dict:
    return {"ok": True, "artifact": load_artifact()}


def register(parent_router: APIRouter, parent_compat_router: APIRouter) -> None:
    parent_router.include_router(router)
    parent_compat_router.include_router(compat_router)


def _load_specs(path: str) -> List[TrainSpecModel]:
    raw = json.loads(open(path, "r", encoding="utf-8").read())
    if not isinstance(raw, list):
        raise ValueError("Training data must be a JSON array of specs")
    out: List[TrainSpecModel] = []
    for row in raw:
        out.append(TrainSpecModel(**row))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DSPy image request program for consistency.")
    parser.add_argument("--trainset", required=True, help="Path to JSON list of ImageSpec objects.")
    parser.add_argument("--model", default=os.getenv("REPLICATE_MODEL_ID", "black-forest-labs/flux-1.1-pro"))
    parser.add_argument("--seeds", default="101,303,707", help="Comma-separated seeds.")
    parser.add_argument("--lambda", dest="variance_penalty", type=float, default=0.8)
    parser.add_argument("--max-iters", type=int, default=12)
    args = parser.parse_args()

    body = TrainRequest(
        train_specs=_load_specs(args.trainset),
        model=args.model,
        seeds=[int(x.strip()) for x in args.seeds.split(",") if x.strip()],
        variance_penalty=float(args.variance_penalty),
        max_iters=int(args.max_iters),
    )
    result = _run_training(body)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
