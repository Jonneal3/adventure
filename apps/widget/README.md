# Mage Widget - AI Image Generation Widget App

The widget application for the Mage AI Image Generation Platform.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables (copy from .env.example)

3. Run the development server:
```bash
pnpm dev
```

## Development

- **Widget App**: `http://localhost:3001`

## Shared contract (AI form)

This repo uses shared contracts for the AI form system:
- **UI step schema/types**: `shared/ai-form-ui-contract/` (local setup: symlink to `/Users/jon/Desktop/sif-ai-form-contract`)
- **Service OpenAPI**: `shared/ai-form-service-openapi/openapi.json`

## Building for Production

```bash
pnpm build
```

## Available Scripts

- `dev` - Start development server on port 3001
- `build` - Build for production (creates .env file with placeholders)
- `start` - Start production server
- `lint` - Run linting
- `gen:types` - Generate TypeScript types from your *remote* Supabase project into `supabase/types.ts`
- `db:update` - Update Supabase database
- `sort:configs` - Sort configuration files

## Keeping local code in sync with remote Supabase (schema + policies)

This repo depends on your **remote Supabase** schema for tables, views, and RLS behavior.

### 1) Ensure `.env.local` has the right keys

Required for `/widget`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for `/form` (AI form flow endpoints must read `instance_subcategories`, which is typically **not public** under RLS):
- `SUPABASE_SERVICE_ROLE_KEY`

If `SUPABASE_SERVICE_ROLE_KEY` is missing, `/widget` may still work (instances are public-read), but `/form` will fail.

### 2) Regenerate types after any remote DB change

Run:

```bash
npm run gen:types
```

This uses your `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` to infer the Supabase project id and regenerates `supabase/types.ts`.

### 3) Quick sanity check that you can read subcategories

If you want to verify DB connectivity quickly:

```bash
node scripts/inspect-subcategory.cjs <subcategory-slug>
```


## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REPLICATE_API_KEY`

Optional environment variables:
- `PACK_QUERY_TYPE` - Set to 'users', 'gallery', or 'both' (default: 'both')
- `NEXT_PUBLIC_TUNE_TYPE` - Set to 'packs' or 'tune' (default: 'packs')
- `NEXT_PUBLIC_STRIPE_IS_ENABLED` - Set to 'true' if you want Stripe features
- `DEPLOYMENT_URL` - Your production domain for webhook configuration
- `DSPY_IMAGE_SERVICE_URL` - Base URL for the form-only image service (expects `POST /api/image`)
- `DEV_DSPY_IMAGE_SERVICE_URL` - Dev override for `DSPY_IMAGE_SERVICE_URL`
- `API_LOGS` - Set to `true` to enable server-side API logging in production

## Deployment

This app is configured for deployment to Vercel with the following settings:
- Build Command: `pnpm run build`
- Install Command: `pnpm install --no-frozen-lockfile`
- Framework: Next.js

## Features

- Image generation using Replicate API
- Webhook forwarding
- Supabase integration for authentication and data storage
- Responsive widget interface # sif-widget
# sif-widget

## Debug: Preview rail gating

The progressive image preview “experience rail” is intentionally gated so it doesn’t render at the start of the question flow.

- Default: shows once the user is ~60% through the question plan.
- Override (percent/fraction): add `?image_preview_at=0.6` (fraction) or `?image_preview_at=60` (percent).
- Override (answered questions): add `?image_preview_after=4` to show after N answered questions.
