# Provisioning real Cloudflare resources

Everything in this repo runs and builds with **zero Cloudflare credentials** — `wrangler dev`/`vite dev` emulate D1, R2, KV, and Queues locally via Miniflare, and `npm run build` produces a deployable worker without touching your account. You only need this page once, when you're ready to actually deploy.

Workers AI is the one exception: it has no local emulation (every call proxies to Cloudflare's real edge inference), so it's deliberately left commented out in `wrangler.jsonc` until the OCR milestone (M3) — that's the first point you'll need to authenticate at all, even for local dev of that one feature.

## One-time setup

```bash
npx wrangler login
```

Then create each real resource and copy the printed ID back into `wrangler.jsonc` (replacing the `REPLACE_AFTER_*` placeholders):

```bash
npx wrangler d1 create medsassist
# → copy database_id into wrangler.jsonc's d1_databases[0].database_id

npx wrangler kv namespace create OTP_KV
# → copy id into wrangler.jsonc's kv_namespaces[0].id

npx wrangler r2 bucket create medsassist-photos
# (bucket_name in wrangler.jsonc already matches — no ID to copy)

npx wrangler queues create medsassist-notifications
npx wrangler queues create medsassist-notifications-dlq
```

Apply the schema to the real (remote) database — local dev already has it via the `--local` flag used during scaffolding:

```bash
npx wrangler d1 execute DB --remote --file=db/migrations/0001_init.sql
```

Secrets (never committed — set per-environment):

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler secret put VAPID_PUBLIC_KEY
```

## When M3 (OCR) lands

Uncomment the `ai` block in `wrangler.jsonc`, then `npm run gen` to regenerate `worker-configuration.d.ts` with the `AI` binding back in scope.

## When M4 (reminders) lands

`workers/reminder-engine/` is a second, separate Worker (see the top-level plan notes / `DESIGN.md`) with its own `wrangler.jsonc` binding to the _same_ D1 database, plus the Queue consumer side. It needs `wrangler deploy` run from its own directory, separately from the main app.
