# AI Form Generate-Steps Contract (OpenAPI)

This folder contains a **minimal OpenAPI contract** used to keep the widget's **generate-steps** request/response JSON shapes consistent across projects.

- Endpoint covered: `POST /api/ai-form/{instanceId}/generate-steps`
- Implementation: `app/api/ai-form/[instanceId]/generate-steps/route.ts`
- Endpoint covered: `POST /api/ai-form/{instanceId}/generate-image`
- Implementation: `app/api/ai-form/[instanceId]/generate-image/route.ts`
- Note: `formPlan` is intentionally not part of this contract anymore; the only persisted client-side “already asked” state is expressed via fields like `askedStepIds` and `answeredQA`.

## Updating

Update `shared/ai-form-service-openapi/openapi.json` whenever you change the generate-steps handler's request/response payload shape.
