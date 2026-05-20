# Signmos

*AI agent index: [llms.txt](./llms.txt)*

Signmos is a lightweight e-signature workflow built on TanStack Start, Hono, Cloudflare Workers, Neon Postgres, Drizzle, and R2. It supports creating envelopes, uploading source PDFs, adding recipients and signature/date fields, sending signer links, completing typed signatures through magic links, and downloading a completed PDF artifact with an audit summary.

The legal posture is basic e-signature intent. Signmos records signer intent, timestamps, document hashes, field values, and immutable audit events, but it is not a certified trust-service platform.

## Current Capabilities

- Create draft envelopes through the lifecycle API.
- Upload one source PDF per draft envelope to R2.
- Add up to 10 recipients.
- Add signature and date fields by page coordinates.
- Use `/envelope-fields` to visually review/place fields for a real envelope via query params.
- Send envelopes in parallel and receive generated signing links in the API response.
- Open `/signing/{token}` without an account to complete or decline signing.
- Generate and store a completed final PDF after all recipients complete.
- Download the final PDF from the lifecycle API.
- Use `/manual-signing-smoke` to run the full browser-driven local smoke flow.

Known product gaps:

- No production email delivery UI yet. Send records are persisted, and generated signing links are returned by the API for manual sharing.
- No full internal dashboard/worklist yet.
- Final PDF generation is deterministic and testable, but not a polished production PDF overlay engine.

## Quick Start

```bash
pnpm install
cp .example.vars .dev.vars
# Fill DATABASE_HOST, DATABASE_USERNAME, and DATABASE_PASSWORD in .dev.vars.

pnpm cf-typegen
pnpm db:migrate:dev
pnpm dev
```

The app runs on http://localhost:3000. API endpoints are served under `/api/*`.

## Manual End-to-End Smoke Test

After applying migrations and starting the dev server:

```bash
pnpm db:migrate:dev
pnpm dev
```

Open:

```text
http://localhost:3000/manual-signing-smoke
```

Then:

1. Click `Run setup`.
2. Confirm a `/signing/{token}` link appears.
3. Open the signer link in another tab to inspect the signer page.
4. Return to `/manual-signing-smoke`.
5. Keep or edit signer name/date.
6. Click `Complete in page`.
7. Confirm `Download final PDF` appears.
8. Open/download the final PDF.

This smoke page creates a local test envelope, uploads a tiny generated PDF, adds Ada Lovelace as recipient, places signature/date fields, sends the envelope, completes signing, polls status, and links the final PDF.

## Manual API Flow With Your Own PDF

```bash
BASE=http://localhost:3000
PDF=/absolute/path/to/your.pdf

ENVELOPE_ID=$(curl -s -X POST "$BASE/api/envelopes" \
  -H "x-internal-user-id: you" \
  -H "idempotency-key: manual-create-$(date +%s)" \
  | jq -r '.data.id')

curl -s -X POST "$BASE/api/envelopes/$ENVELOPE_ID/source-pdf" \
  -H "x-internal-user-id: you" \
  -H "idempotency-key: manual-upload-$(date +%s)" \
  -H "content-type: application/pdf" \
  --data-binary @"$PDF" | jq

RECIPIENTS=$(curl -s -X POST "$BASE/api/envelopes/$ENVELOPE_ID/recipients" \
  -H "x-internal-user-id: you" \
  -H "content-type: application/json" \
  -d '{"recipients":[
    {"name":"Your Name","email":"you@example.com"},
    {"name":"Other Signer","email":"other@example.com"}
  ]}')

YOU_ID=$(echo "$RECIPIENTS" | jq -r '.data[0].id')
OTHER_ID=$(echo "$RECIPIENTS" | jq -r '.data[1].id')

curl -s -X POST "$BASE/api/envelopes/$ENVELOPE_ID/fields" \
  -H "x-internal-user-id: you" \
  -H "content-type: application/json" \
  -d "{
    \"fields\": [
      {\"recipientId\":\"$YOU_ID\",\"type\":\"signature\",\"page\":1,\"x\":72,\"y\":144,\"width\":180,\"height\":48},
      {\"recipientId\":\"$YOU_ID\",\"type\":\"date\",\"page\":1,\"x\":300,\"y\":144,\"width\":120,\"height\":32},
      {\"recipientId\":\"$OTHER_ID\",\"type\":\"signature\",\"page\":1,\"x\":72,\"y\":240,\"width\":180,\"height\":48},
      {\"recipientId\":\"$OTHER_ID\",\"type\":\"date\",\"page\":1,\"x\":300,\"y\":240,\"width\":120,\"height\":32}
    ]
  }" | jq

SEND=$(curl -s -X POST "$BASE/api/envelopes/$ENVELOPE_ID/actions" \
  -H "x-internal-user-id: you" \
  -H "content-type: application/json" \
  -d '{"action":"send"}')

echo "$SEND" | jq '.data.signingLinks'
```

Open each returned `url` as `http://localhost:3000/signing/{token}` and complete both signers. Then:

```bash
curl -s "$BASE/api/envelopes/$ENVELOPE_ID/status" | jq
curl -L "$BASE/api/envelopes/$ENVELOPE_ID/final-pdf" -o /tmp/signmos-final.pdf
```

## Lifecycle API

Success responses use `{ "data": ... }`. Known errors use `{ "error": { "code": string, "message": string, ... } }`.

| Endpoint | Purpose |
|---|---|
| `POST /api/envelopes` | Create a draft envelope. Requires `x-internal-user-id`; accepts `Idempotency-Key`. |
| `POST /api/envelopes/{id}/source-pdf` | Upload a PDF under 10 MB. Requires `x-internal-user-id`; accepts `Idempotency-Key`. |
| `POST /api/envelopes/{id}/recipients` | Add 1-10 recipients. Requires `x-internal-user-id`. |
| `POST /api/envelopes/{id}/fields` | Add signature/date coordinate fields. Requires `x-internal-user-id`. |
| `POST /api/envelopes/{id}/actions` | Send an envelope with `{ "action": "send" }`; returns signing links. |
| `POST /api/envelopes/{id}/recipients/{recipientId}/resend` | Create a new invitation send record and signing token. |
| `GET /api/envelopes/{id}/status` | Poll lifecycle state and final PDF availability. |
| `GET /api/envelopes/{id}/final-pdf` | Download the completed PDF artifact. |
| `GET /api/signing/{token}` | Resolve a magic-link signer session. |
| `POST /api/signing/{token}/complete` | Complete typed signature/date values. |
| `POST /api/signing/{token}/decline` | Decline with reason and optional comment. |

See [plans/simple-esignature-prd.md](./plans/simple-esignature-prd.md) for the full contract, validation checklist, assumptions, and out-of-scope items.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing/demo page from the original starter. |
| `/clients` | Starter client CRUD demo. |
| `/envelope-fields` | Field placement UI. Supports `envelopeId`, `recipientId`, `name`, and `email` query params. |
| `/signing/{token}` | No-account signer page for a magic link. |
| `/manual-signing-smoke` | Browser-driven local smoke test for the complete workflow. |

Example real field editor URL:

```text
/envelope-fields?envelopeId=<uuid>&recipientId=<uuid>&name=Ada%20Lovelace&email=ada@example.com
```

## Project Structure

```text
src/
├── server.ts                         # CF Workers entry; routes /api/* to Hono
├── routes/                           # TanStack file routes
│   ├── envelope-fields.tsx
│   ├── manual-signing-smoke.tsx
│   └── signing.$token.tsx
├── components/
│   ├── envelopes/field-editor.tsx
│   └── signing/
│       ├── manual-smoke-page.tsx
│       └── signer-page.tsx
├── db/
│   ├── envelope/                     # Envelope tables, schemas, queries, finalization
│   ├── client/                       # Starter client demo domain
│   ├── health/
│   └── migrations/dev/               # Dev Drizzle migrations
└── hono/
    ├── api.ts                        # Mounts /api/health, /api/clients, /api/envelopes, /api/signing
    └── api/
        ├── envelopes.ts
        └── signing.ts
```

Path alias `@/*` resolves to `src/*`.

## Database And Storage

Envelope metadata is stored in Neon Postgres via Drizzle. PDF artifacts are stored in the `DOCUMENTS_BUCKET` R2 binding configured in `wrangler.jsonc`.

Core envelope tables include:

- `envelopes`
- `idempotency_records`
- `source_documents`
- `final_documents`
- `envelope_recipients`
- `signer_tokens`
- `email_send_records`
- `envelope_fields`
- `field_values`
- `audit_events`

Migration workflow:

```bash
pnpm db:generate:dev
pnpm db:migrate:dev
pnpm db:studio
```

Generate staging/production migrations with the corresponding `db:generate:*` scripts when deploying to those environments.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server on port 3000. |
| `pnpm build` | Production build. |
| `pnpm serve` | Preview production build locally. |
| `pnpm deploy` | Build and deploy to Cloudflare Workers. |
| `pnpm cf-typegen` | Generate Cloudflare `Env` types. |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest. |
| `pnpm types` | `tsc --noEmit`. |
| `pnpm lint` / `pnpm lint:fix` / `pnpm lint:ci` | Biome checks. |
| `pnpm knip` | Detect unused files, dependencies, and exports. |
| `pnpm db:generate:{dev,staging,production}` | Generate Drizzle migrations. |
| `pnpm db:migrate:{dev,staging,production}` | Apply migrations. |
| `pnpm db:pull:{dev,staging,production}` | Pull schema from DB. |
| `pnpm db:studio` | Open Drizzle Studio against dev. |
| `pnpm db:seed:{dev,staging,production}` | Seed starter client data. |

All `db:*` scripts load per-environment vars with `@dotenvx/dotenvx`.

## Verification

Before declaring changes done:

```bash
pnpm types
pnpm test
pnpm lint
pnpm build
```

The test suite includes lifecycle API smoke coverage, PDF finalization assertions, field editor and signer UI tests, and the docs/contract presence test.

## Development Notes

- `AGENTS.md` is the compact agent context map.
- `ARCHITECTURE.md` is the stable code map for module boundaries and invariants.
- `docs/AGENT_GUIDE.md` contains detailed agent operating rules distilled from `.claude/rules`.
- Prefer deep modules: test through public module/API/component boundaries.
- Keep source files under 500 lines.
- Do not edit `src/components/ui/*` manually; use Shadcn tooling.
- Do not edit `src/routeTree.gen.ts` manually; it is generated by TanStack Router during dev/build.
- `plans/simple-esignature-prd.md` is the source of truth for product requirements and lifecycle contract documentation.

## Learn More

- [TanStack Start](https://tanstack.com/start)
- [Hono](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Neon](https://neon.tech/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Shadcn/UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Biome](https://biomejs.dev/)
