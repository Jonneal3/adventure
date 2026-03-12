# Environment Management (One File)

This repo uses one universal env file for local runtime and Vercel sync.

## Source of truth

- Canonical schema: `env/schema.json`
- Universal values file (not committed): `env/.env.shared.local`

Everything reads from `env/.env.shared.local`.

## App mapping

- `adv-widget` -> `adv-widget`
- `adv-designer` -> `adv-designer`
- `adv-shopify` -> `adv-shopify`
- `adv-api-service` -> `adv-api-service`

Team scope default in schema: `unfilteredmarketing-5949s-projects`

## Daily commands

From repo root:

```bash
npm run env:doctor
npm run env:cleanup-local
npm run env:diff -- --target preview
npm run env:push -- --target preview
npm run env:pull -- --target production
```

Behavior note:
- `env:push` syncs all non-empty keys from `env/.env.shared.local` to selected apps.
- `env:doctor` uses `env/schema.json` to enforce required keys per app/target.
- `env:cleanup-local` removes legacy per-app env files so only `env/.env.shared.local` remains in use.

Optional flags:

- `--app adv-widget` or `--app adv-widget,adv-designer`
- `--target development|preview|production` (comma separated supported)
- `--scope your-team-scope`
- `--dry-run` (push only)
- `--prune` (push only, removes remote vars not in local canonical set)

## Recovery and rollback

- Pull current remote values into snapshots:
  - `npm run env:pull -- --target production`
- Output files are written to `env/generated/<app>.<target>.env`.
- If needed, restore by updating `env/.env.shared.local` and re-running `env:push`.

## Guardrails

- Do not commit `env/.env.shared.local`.
- `NEXT_PUBLIC_*` keys are always treated as non-secret.
- Push fails fast when required variables are missing.
- Remote deletion only happens when `--prune` is explicitly passed.
