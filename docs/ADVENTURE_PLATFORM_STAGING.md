# Adventure platform staging

This staging path is isolated from the current Adventure production deployment. Set `ADVENTURE_PLATFORM_V2=true` on the **staging** designer and widget deployments only. Production continues to use its existing routes and Supabase source.

## Services and variables

Create separate Adventure PostgreSQL, S3-compatible buckets, Nest API, visual worker, image provider deployment, and Stripe **test-mode** catalog. Keep all credentials outside Git.
Configure the private asset bucket to accept signed `PUT` uploads from the widget staging origin and signed `GET` reads. Keep provider outputs private after the worker copies them into this bucket.

The API and visual worker need `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters), `ADVENTURE_PREVIEW_SECRET` (32+ characters), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WIDGET_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ASSET_BUCKET`, and `ADVENTURE_IMAGE_API_URL`. Email verification and reset need `RESEND_API_KEY` and `ADVENTURE_EMAIL_FROM`; configure `NEXT_PUBLIC_EMAIL_ENABLED=true` for staging email tests. Stripe needs `ADVENTURE_STRIPE_SECRET_KEY` (`sk_test_`), `ADVENTURE_STRIPE_ACCOUNT_ID`, `ADVENTURE_STRIPE_WEBHOOK_SECRET`, and `ADVENTURE_STRIPE_PRICE_USAGE`, `_BASIC`, `_PRO`. The price IDs must be active monthly USD test prices matching $0, $99, and $299. Point the Stripe test webhook to the staging designer `/api/platform/billing/webhook` route.

The designer and widget need `BACKEND_INTERNAL_URL` and `ADVENTURE_PLATFORM_V2=true`. The designer needs `NEXT_PUBLIC_WIDGET_URL`; the widget needs `NEXT_PUBLIC_SITE_URL`. Set the public URLs to their respective staging origins. The API must never use a Supabase database URL. Storage objects use `adventure-assets`; source files are copied under `legacy/<source-bucket>/<source-key>`.

The existing Next applications still compile retired route modules during a staging build. If a retired module requires Supabase variables merely to initialize, set those variables to a disabled localhost URL and nonsecret placeholders in staging. The staging middleware blocks those routes before they execute. Do not place the source Supabase service key in a staging runtime.

## Migration order

1. Put source and target database URLs and S3 target credentials in ignored `env/.env.migration.local` using `env/migration.example` as a template. Verify the source project is the intended Adventure project and target host is separate.
2. Run `node scripts/migration/backup.mjs` and `node scripts/migration/auth.mjs --snapshot-out .local/backups/auth.json` against the read-only source. Run `node scripts/migration/storage.mjs` to archive every storage bucket. Keep `.local/backups` private.
3. On the empty target run `node scripts/migration/prepare-target.mjs auth`, then `node scripts/migration/auth.mjs --snapshot .local/backups/auth.json --apply`, then `node scripts/migration/restore-public.mjs <backup.dump>`. Transferable bcrypt passwords remain valid. Users without a transferable password retain their identity records and must set a new password through the email reset flow.
4. Run `node scripts/migration/verify.mjs`. Stop if any row, schema, identity, or relationship differs. Run `node scripts/migration/storage.mjs --offline --upload`; it checks every copied object against its source checksum.
5. Run `node scripts/migration/prepare-target.mjs application`, then `node scripts/migration/backfill-experiences.mjs`. Backfill keeps old configuration JSON for audit and creates draft experiences only when one service industry can be mapped. Imported historical submissions and files remain in their original tables and object archive.
6. Import **approved** curated service price ranges and form presets with `node scripts/migration/import-curated-presets.mjs <approved-presets.json>`. Each JSON entry has `id`, `industryId`, `name`, `visualJob` (`none`, `scene`, or `tryon`), `defaultRange` (`currency: "USD"`, positive `minCents` and `maxCents`, `source: "curated"`), and `elements` (an array of shared form elements). No generic range is supplied by this code. A service with no range remains a draft until its owner enters one.

## Local commands and acceptance

Build `@adventure/experience`, `@adventure/api-contract`, and `@adventure/backend`. Start the API with `npm run dev -w @adventure/backend` and the worker with `npm run worker:visual -w @adventure/backend`. Start the designer and widget with their normal Next commands and the staging variables above. The owner workspace is `/platform`; the customer URL is `/adventure/<instanceId>` on the widget. Versioned customer URLs redirect to that canonical path in staging.

Owners can optionally scan a public HTTPS website after choosing an industry and services. The API returns page title, description, and theme color as suggestions; the owner explicitly applies branding changes to the draft. The scan checks DNS addresses and connects only to the verified public address.

Run `node scripts/test-platform-smoke.mjs` with `ADVENTURE_SMOKE_API_URL`, `ADVENTURE_SMOKE_ORIGIN`, and disposable credentials when email verification is enabled. Run the full staging acceptance matrix from the implementation plan before production cutover. Include migrated account sign-in and password reset, source/target parity, signed file access, curated and custom service publication, no-image services, scene and try-on provider calls, multi-service routing, contact gate, price snapshot stability, concurrent starts, duplicate submissions and webhooks, refunds, Stripe test checkout/deposit, and cross-account denial. The API smoke test covers signup, publication, project resume, duplicate answer idempotency, price snapshots, previews, and account isolation; it does not replace provider, Stripe, or deployed end-to-end checks.
