from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from programs.image_request.eval.consistency import evaluate_request_consistency  # noqa: E402
from programs.image_request.eval.judge import DeterministicStubJudge  # noqa: E402
from programs.image_request.providers.replicate_adapter import _replicate_input  # noqa: E402
from programs.image_request.program import ImageRequestProgram  # noqa: E402
from programs.image_request.types import ImageRequest, ImageSpec  # noqa: E402


class SmokeTests(unittest.TestCase):
    def test_params_json_parse_robustness(self) -> None:
        program = ImageRequestProgram()

        class _Out:
            prompt = "  test prompt  "
            negative_prompt = "  noisy  "
            params_json = "{not-json"

        class _Gen:
            def __call__(self, spec: str):  # noqa: D401
                return _Out()

        program._gen = _Gen()  # type: ignore[attr-defined]
        req = program.forward("spec")
        self.assertEqual(req.prompt, "test prompt")
        self.assertEqual(req.negative_prompt, "noisy")
        self.assertEqual(req.params, {})

    def test_payload_mapping_t2i_img2img_inpaint(self) -> None:
        req = ImageRequest(prompt="a", negative_prompt="b", params={"steps": 30, "guidance_scale": 4.5})
        t2i = ImageSpec(user_prompt="u", style_preset="photoreal", task="t2i")
        img2img = ImageSpec(user_prompt="u", style_preset="photoreal", task="img2img", reference_image_url="https://x/img.png")
        inpaint = ImageSpec(
            user_prompt="u",
            style_preset="photoreal",
            task="inpaint",
            reference_image_url="https://x/img.png",
            mask_image_url="https://x/mask.png",
        )

        p1 = _replicate_input(req, t2i, 1)
        p2 = _replicate_input(req, img2img, 2)
        p3 = _replicate_input(req, inpaint, 3)

        self.assertNotIn("image", p1)
        self.assertIn("image", p2)
        self.assertNotIn("mask", p2)
        self.assertIn("image", p3)
        self.assertIn("mask", p3)
        self.assertEqual(p1["seed"], 1)
        self.assertEqual(p2["seed"], 2)
        self.assertEqual(p3["seed"], 3)

    def test_consistency_metric_penalizes_variance(self) -> None:
        spec = ImageSpec(user_prompt="kitchen", style_preset="photoreal")
        req = ImageRequest(prompt="p", negative_prompt="n", params={})
        judge = DeterministicStubJudge()

        import programs.image_request.eval.consistency as consistency_mod

        original = consistency_mod.render_with_replicate
        try:
            consistency_mod.render_with_replicate = lambda request, spec, seed, model=None: f"MOCK://seed/{seed}"  # type: ignore[assignment]
            low_var = evaluate_request_consistency(
                spec=spec,
                request=req,
                seeds=[1, 1, 1],
                judge=judge,
                variance_penalty=1.0,
            )
            high_var = evaluate_request_consistency(
                spec=spec,
                request=req,
                seeds=[1, 2, 3],
                judge=judge,
                variance_penalty=1.0,
            )
            self.assertLessEqual(high_var.objective, high_var.mean)
            self.assertGreaterEqual(low_var.objective, high_var.objective)
        finally:
            consistency_mod.render_with_replicate = original


if __name__ == "__main__":
    unittest.main()
