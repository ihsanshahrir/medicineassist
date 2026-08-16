# Provisioning real Cloudflare resources

Everything in this repo runs and builds with **zero Cloudflare credentials** — `wrangler dev`/`vite dev` emulate D1, KV, and Queues locally via Miniflare, and `npm run build` produces a deployable worker without touching your account. You only need this page once, when you're ready to actually deploy.

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

npx wrangler kv namespace create PHOTOS
# → copy id into wrangler.jsonc's kv_namespaces[1].id — photo storage lives
# in KV (see src/lib/server/photos.ts), not R2: no account-level dashboard
# enablement needed, and well within KV's free tier for a handful of users.

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
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put SENDGRID_FROM_EMAIL
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler secret put VAPID_PUBLIC_KEY
```

## When M3 (OCR) lands

Uncomment the `ai` block in `wrangler.jsonc`, then `npm run gen` to regenerate `worker-configuration.d.ts` with the `AI` binding back in scope.

## M4 — reminder pipeline (reminder-engine + push)

`workers/reminder-engine/` is a second, separate Worker with its own `wrangler.jsonc`, binding to the _same_ D1 database as the main app plus its own Queue consumer/producer of `medsassist-notifications`. Deploy it separately from the main app:

```bash
npm run deploy:reminder
# equivalent to: cd workers/reminder-engine && wrangler deploy
```

It has no local emulation gap like Workers AI does — D1/Queues both run under Miniflare the same way for this worker as for the root app, so `npm run dev:reminder` (`wrangler dev --test-scheduled`) works fully offline. Trigger a tick manually against the local dev server with:

```bash
curl "http://localhost:8787/__scheduled"
```

**VAPID keys** (Web Push's signing keypair — distinct per environment, not shared with anything else):

```bash
node scripts/generate-vapid-keys.mjs
```

Prints a public key and a private JWK. They go to **different places**:

- `VAPID_PUBLIC_KEY` → the **root app's** secrets (it's what `GET /api/push/public-key` hands the browser to subscribe with): `npx wrangler secret put VAPID_PUBLIC_KEY` from the repo root.
- `VAPID_PRIVATE_JWK` + `VAPID_SUBJECT` (a `mailto:`/`https:` contact for push-service abuse reports) → **reminder-engine's own** secrets, since that's the only thing that ever signs a push: `npx wrangler secret put VAPID_PRIVATE_JWK` and `... put VAPID_SUBJECT`, both run from `workers/reminder-engine/`.

For local dev, paste the same values into `.dev.vars` (root, `VAPID_PUBLIC_KEY` only) and `workers/reminder-engine/.dev.vars` (`VAPID_PRIVATE_JWK` + `VAPID_SUBJECT`) — both gitignored, both have a `.dev.vars.example` alongside them.

## M7 — quota monitoring

`db/migrations/0002_usage_counters.sql` adds a `usage_counters` table (one row per UTC day per counter: `ocr_calls`, `push_attempts`, `push_failures`). Both the root app and `reminder-engine` write to it directly — no admin UI, this is a single-user MVP, so a manual check is enough:

```bash
npx wrangler d1 execute DB --remote --file=db/migrations/0002_usage_counters.sql
# (once, same as 0001_init.sql was applied — local dev already has it via --local during scaffolding)

npx wrangler d1 execute DB --remote --command "SELECT * FROM usage_counters ORDER BY counter_date DESC"
```

Compare against the plan's own researched free-tier ceilings: 100K D1 writes/day, 10K Workers AI Neurons/day, 10K Queue messages/month. `ocr_calls` tracks against the Neuron budget; `push_attempts`/`push_failures` track against the Queue budget (each queue message becomes one `sendToSubscription` call per device, i.e. one `push_attempts` increment).
