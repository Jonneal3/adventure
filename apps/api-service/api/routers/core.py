from __future__ import annotations

from fastapi import FastAPI


def register(app: FastAPI) -> None:
    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/")
    def root() -> dict:
        return {
            "ok": True,
            "service": "sif-api-service",
            "message": "This is an API service. Try /health or /docs.",
        }

