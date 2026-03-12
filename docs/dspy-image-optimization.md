# DSPy Image Optimization

This repo now includes a full optimization loop for image request generation in `adv-api-service`:

1. Build `ImageRequest` from `ImageSpec` via DSPy (`prompt`, `negative_prompt`, `params`).
2. Render images via Replicate (t2i, img2img, inpaint payload mapping).
3. Score with a pluggable judge.
4. Optimize for first-try consistency using `mean - lambda * stdev` across seeds.

## Defaults

- Primary model: `REPLICATE_MODEL_ID` (current default in env: `black-forest-labs/flux-1.1-pro`)
- Option image model: `REPLICATE_OPTION_IMAGES_MODEL_ID` (`black-forest-labs/flux-schnell`)

## Train command

```bash
cd adv-api-service
PYTHONPATH=.:src python3 -m api.train_image_request_program \
  --trainset ./path/to/train_specs.json \
  --model black-forest-labs/flux-1.1-pro \
  --seeds 101,303,707 \
  --lambda 0.8 \
  --max-iters 12
```

## Artifact

Saved to:

- `adv-api-service/artifacts/image-optimization/compiled_image_request_program.json`

## Runtime usage

Enable:

```bash
IMAGE_OPT_USE_ARTIFACT=true
```

When enabled, `/v1/api/image` and related image-generation routes apply compiled policy context before provider calls.
