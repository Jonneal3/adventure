# Replicate API Contract (Focal + References)

This project uses a single request contract for image generation:

- `targetImage`: the focal image to edit
- `referenceImages[]`: additional reference/context images
- `maskImage` (optional): inpainting mask URL for models that support masks

## Where requests are created

- Shared type: `shared-api/types/api.ts` (`GenerateImageRequest`)
- Generic route: `app/api/generate/route.ts`
- Use-case routes:
  - `app/api/generate/scene/route.ts`
  - `app/api/generate/scene-placement/route.ts`
  - `app/api/generate/try-on/route.ts`
  - `app/api/generate/drilldown/route.ts`

## Where image generation now runs

- Image generation is now delegated to `adv-ai-form-service` (`/v1/api/generate/*`).
- `adv-widget` keeps local credit checks/deductions and forwards generation payloads to the DSPy service.
- Option thumbnail generation uses a single endpoint:
  - `app/api/ai-form/[instanceId]/option-images/generate/route.ts`
  - hard-pinned model: `black-forest-labs/flux-schnell`

## Prompt ownership

- DSPy service builds and optimizes prompts server-side (`adv-ai-form-service`).
- `adv-widget` no longer performs direct Replicate generation in `/api/generate/*` routes.
- `adv-widget` still controls billing/credits and wraps the service response for client compatibility.
