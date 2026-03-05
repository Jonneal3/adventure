"""Re-exports from program-specific providers (backward compatibility)."""

from programs.image_generator.providers.image_generation import (
    generate_images,
    generate_option_images_for_step,
)

__all__ = ["generate_images", "generate_option_images_for_step"]
