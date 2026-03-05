# Mage Designer - AI Image Generation Designer App

## Database and migrations

This repo uses Supabase migrations under `supabase/migrations`. To add changes:

- Create a new `.sql` file in `supabase/migrations` with an ISO-like timestamp prefix.
- Prefer additive migrations with `IF NOT EXISTS` and explicit constraints.
- Avoid ad-hoc SQL scripts outside `supabase/migrations`.

Helpful scripts:

```bash
npm run db:update   # refresh types and configs via project script
npm run gen-types   # regenerate designer app DB types
```

The main designer application for the Mage AI Image Generation Platform.

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

- **Designer App**: `http://localhost:3000`

## Building for Production

```bash
pnpm build
```

## Available Scripts

- `dev` - Start development server on port 3000
- `build` - Build for production
- `start` - Start production server
- `lint` - Run linting
- `update:service-summaries:prompt` - Update `service_summary` via an LLM + custom prompt
- `gen-types` - Generate TypeScript types from Supabase
- `db:update` - Update Supabase database
- `sort:configs` - Sort configuration files

## Environment Variables

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REPLICATE_API_KEY`
- `OPENAI_API_KEY`

## Deployment

This app is configured for deployment to Vercel with the following settings:
- Build Command: `pnpm run build`
- Install Command: `pnpm install`
- Framework: Next.js # Force redeploy Fri Jul 18 15:18:28 CDT 2025
# sif-designer
