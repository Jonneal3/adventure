"""Re-exports from program-specific optimizers (backward compatibility)."""

from programs.common.optimizers.bootstrap_fewshot import bootstrap_few_shot

__all__ = [
    "bootstrap_few_shot",
]
