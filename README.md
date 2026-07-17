# Signmos

*AI agent index: [llms.txt](./llms.txt)*

Signmos is a lightweight e-signature workflow built on TanStack Start, Hono, Cloudflare Workers, Neon Postgres, Drizzle, and R2. It supports self-sign and two-party envelopes, source PDF upload and field preparation, passwordless signing, completed PDF artifacts with audit summaries, and verified-email recovery through My Documents.

The legal posture is basic e-signature intent. Signmos records signer intent, timestamps, document hashes, field values, and immutable audit events, but it is not a certified trust-service platform.

## Current Capabilities

- Choose self-signing, signing with another person, or My Documents from the unselected task chooser at `/`.
- Start a no-account envelope with sender email verification and restricted fallback links in dev/test.
- Create draft envelopes through the lifecycle API.
- Upload one source PDF per draft envelope to R2 from `/source-pdf-upload`.
- Add up to 10 recipients.
- Create drawn or typed signature profiles.
- Add signature and date fields by page coordinates, or use default placement.
- Use `/envelope-fields` to visually prepare/review fields.
- Send envelopes, persist notification records, and receive verification/signing fallback links in API responses.
- Open `/signing/{token}` without an account after partner email verification.
- Complete signing, decline, or request changes with a comment.
- Revise a PDF after a change request, clear old fields, resend, and complete the envelope.
- Generate and store a completed PDF with flattened field values plus an audit certificate/checksum.
- Open completed-document details and download the final PDF from verified sender or signer process links.
- Expire/delete envelopes and check 90-day retention eligibility.
- Request privacy-safe My Documents access by email through a single-use 30-minute link and a fixed eight-hour HTTP-only browser session.
- Browse all matching retained creator/signer documents with server-side search, role/state filters, action-first ordering, and numbered pagination.
- Resume creator preparation, review status, cancel/delete where permitted, recover active signer work, and download completed PDFs through the history session without exposing process bearer tokens.
- Start a new self-sign or two-party draft from an active My Documents session without repeating email verification.
- Use `/manual-signing-smoke` to run the full browser-driven local smoke flow.

Known product gaps:

- No account/team administration dashboard; My Documents is a temporary, email-scoped personal worklist rather than permanent storage.
- No public API keys, standalone agent CLI, webhooks, billing, templates, or multi-document envelopes yet.
- Final PDF generation is deterministic and testable, but still pilot-scope rather than a full production PDF layout engine.

## Quick Start

```bash
pnpm install
cp .example.vars .dev.vars
# Fill DATABASE_HOST, DATABASE_USERNAME, DATABASE_PASSWORD,
# TURNSTILE_SITE_KEY, and TURNSTILE_SECRET_KEY in .dev.vars.
# Add APP_BASE_URL and RESEND_* values for real transactional email.

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

Manual browser development uses Cloudflare Turnstile development keys from `.dev.vars`:
`TURNSTILE_SECRET_KEY` for the API verifier and `TURNSTILE_SITE_KEY` for the sender
start form widget. `TURNSTILE_TEST_BYPASS=true` is reserved for automated tests and
debug-only API calls, not normal browser smoke runs.

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

echo "$SEND" | jq '.data.verificationLinks'
```

Verify each returned `url`, copy the resulting `data.signingLink.token` into `SIGNING_TOKEN`,
open `http://localhost:3000/signing/$SIGNING_TOKEN`, and complete both signers. Then:

```bash
curl -s "$BASE/api/envelopes/$ENVELOPE_ID/status" | jq
curl -L "$BASE/api/signing/$SIGNING_TOKEN/final-pdf" -o /tmp/signmos-final.pdf
```

## Lifecycle API

Success responses use `{ "data": ... }`. Known errors use `{ "error": { "code": string, "message": string, ... } }`.

| Endpoint | Purpose |
|---|---|
| `POST /api/envelopes/sender-start` | Start a no-account envelope with sender name/email and Turnstile; accepts `Idempotency-Key`. |
| `GET /api/envelopes/sender-verifications/{token}` | Verify the sender magic link and return a sender session token. |
| `GET /api/envelopes/{id}/sender-session` | Validate a sender session and return its verified identity. |
| `POST /api/envelopes` | Create a draft envelope. Requires `x-internal-user-id`; accepts `Idempotency-Key`. |
| `GET /api/envelopes/{id}/source-pdf` | Read current source PDF metadata and self-sign preparation state. |
| `GET /api/envelopes/{id}/source-pdf/content` | Read the current source PDF bytes for preparation. |
| `POST /api/envelopes/{id}/source-pdf` | Upload a PDF under 10 MB. Requires `x-internal-user-id`; accepts `Idempotency-Key`. |
| `GET /api/envelopes/{id}/recipients` | List current recipients. |
| `POST /api/envelopes/{id}/recipients` | Add 1-10 recipients. Requires `x-internal-user-id`. |
| `PATCH /api/envelopes/{id}/recipients/{recipientId}` | Update a draft recipient. |
| `DELETE /api/envelopes/{id}/recipients/{recipientId}` | Remove a draft recipient. |
| `POST /api/envelopes/{id}/signature-profiles` | Create a drawn or typed signature profile. |
| `GET /api/envelopes/{id}/signature-profiles/selected` | Resolve the sender's latest selected signature profile. |
| `GET /api/envelopes/{id}/fields` | List current signature/date fields. |
| `POST /api/envelopes/{id}/fields` | Add signature/date coordinate fields. Requires `x-internal-user-id`. |
| `POST /api/envelopes/{id}/fields/defaults` | Add default bottom-right signature/date fields for recipients. |
| `POST /api/envelopes/{id}/actions` | Send, cancel, expire, or delete an envelope with `{ "action": ... }`. |
| `POST /api/envelopes/{id}/recipients/{recipientId}/resend` | Create a new invitation send record and signing token. |
| `GET /api/envelopes/{id}/status` | Poll lifecycle state and final PDF availability. |
| `GET /api/envelopes/{id}/retention` | Check 90-day retention eligibility for completed or expired envelopes. |
| `GET /api/envelopes/{id}/history` | Read the verified sender's legacy document history. |
| `GET /api/envelopes/{id}/final-pdf` | Download the completed PDF artifact with a verified sender session token. |
| `GET /api/final-documents/{token}` | Resolve completed-document detail through an existing process link. |
| `GET /api/final-documents/{token}/pdf` | Download the completed PDF through an existing process link. |
| `GET /api/signing/verifications/{token}` | Verify a partner magic link and return a signing link. |
| `GET /api/signing/{token}` | Resolve a magic-link signer session. |
| `GET /api/signing/{token}/source-pdf` | Download the source PDF for a verified signer session. |
| `GET /api/signing/{token}/final-pdf` | Download the completed PDF artifact through a verified signer token. |
| `PATCH /api/signing/{token}/fields/{fieldId}` | Reposition an allowed self-sign field before completion. |
| `POST /api/signing/{token}/complete` | Complete typed signature/date values. |
| `POST /api/signing/{token}/change-request` | Request changes with a comment and pause completion until revision/resend. |
| `POST /api/signing/{token}/decline` | Decline with reason and optional comment. |
| `POST /api/history/access-requests` | Request enumeration-safe My Documents access; requires Turnstile and `Idempotency-Key`. |
| `GET /api/history/access-links/{credential}` | Inspect a single-use history link without consuming it. |
| `POST /api/history/access-links/{credential}/redeem` | Consume the link and create the history-session cookie. |
| `POST /api/history/session/sign-out` | Revoke the active history session and clear its cookie. |
| `GET /api/history/documents` | List the session email's retained documents with search, filters, and pagination. |
| `GET /api/history/documents/{id}` | Read authorized completed-document details through the history session. |
| `GET /api/history/documents/{id}/pdf` | Download an authorized final PDF through the history session. |
| `POST /api/history/envelopes` | Start an already-verified draft from the active history session; requires same origin and `Idempotency-Key`. |
| `GET /api/history/documents/{id}/creator` | Resolve creator recovery/status data and server-derived actions. |
| `POST /api/history/documents/{id}/creator-actions` | Invoke an authorized creator cancel/delete action. |
| `GET /api/history/documents/{id}/signing` | Resolve an authorized signing task through the history session. |
| `GET /api/history/documents/{id}/signing/source-pdf` | Read the source PDF for recovered signing. |
| `PATCH /api/history/documents/{id}/signing/fields/{fieldId}` | Reposition an allowed self-sign field. |
| `POST /api/history/documents/{id}/signing/{complete,change-request,decline}` | Perform an allowed recovered-signer action. |

See [plans/pilot-readiness-contract.md](./plans/pilot-readiness-contract.md) for the core agent-ready endpoint contract and smoke map. Product requirements start with [plans/simple-esignature-prd.md](./plans/simple-esignature-prd.md) and are amended by the feature PRDs, including [plans/my-documents-prd.md](./plans/my-documents-prd.md) for passwordless history and recovery.

## Routes

| Route | Purpose |
|---|---|
| `/` | Unselected task chooser for self-sign, two-party signing, or My Documents access. |
| `/clients` | Starter client CRUD demo. |
| `/sender-verifications/{token}` | Sender email confirmation and continuation. |
| `/signing-verifications/{token}` | Partner email confirmation and signing continuation. |
| `/source-pdf-upload` | Sender PDF upload/revision screen. Supports `envelopeId` and `senderSessionToken` query params. |
| `/envelope-fields` | Field preparation UI for review envelopes and explicit field placement. |
| `/signing/{token}` | No-account signer page for a magic link. |
| `/completed-documents/{token}` | Completed-document detail and final download for a process link. |
| `/history-access/{credential}` | Scanner-safe confirmation before consuming a My Documents link. |
| `/my-documents` | Session-protected retained-document catalog and new-document start. |
| `/my-documents/{envelopeId}` | Session-protected completed-document detail. |
| `/my-documents/{envelopeId}/manage` | Session-protected creator recovery and controls. |
| `/my-documents/{envelopeId}/sign` | Session-protected recovered signer flow. |
| `/manual-signing-smoke` | Browser-driven local smoke test for the complete workflow. |

## Project Structure

```text
src/
├── server.ts                         # CF Workers entry; routes /api/* to Hono
├── routes/                           # TanStack file routes
│   ├── envelope-fields.tsx
│   ├── source-pdf-upload.tsx
│   ├── completed-documents.$token.tsx
│   ├── history-access.$credential.tsx
│   ├── my-documents*.tsx
│   ├── manual-signing-smoke.tsx
│   └── signing.$token.tsx
├── components/
│   ├── sender/
│   │   ├── start-envelope-page.tsx
│   │   ├── source-pdf-upload-panel.tsx
│   │   └── signature-profile-panel.tsx
│   ├── envelopes/
│   │   ├── envelope-preparation-page.tsx
│   │   └── field-editor.tsx
│   ├── history/                       # Access request, catalog, recovery, controls
│   ├── completed-documents/           # Completed artifact detail
│   └── signing/
│       ├── manual-smoke-page.tsx
│       └── signer-page.tsx
├── db/
│   ├── envelope/                     # Envelope tables, schemas, queries, finalization
│   ├── history-access/                # Credential/session, catalog, authorization, audit
│   ├── client/                       # Starter client demo domain
│   ├── health/
│   └── migrations/dev/               # Dev Drizzle migrations
└── hono/
    ├── api.ts                        # Mounts the Hono API domains
    └── api/
        ├── envelopes.ts
        ├── history-*.ts
        ├── final-documents.ts
        └── signing.ts
```

Path alias `@/*` resolves to `src/*`.

## Database And Storage

Envelope metadata is stored in Neon Postgres via Drizzle. PDF artifacts are stored in the `DOCUMENTS_BUCKET` R2 binding configured in `wrangler.jsonc`.

Core persistence tables include:

- `envelopes`
- `idempotency_records`
- `sender_verification_tokens`
- `sender_verification_email_records`
- `rate_limit_records`
- `source_documents`
- `final_documents`
- `envelope_recipients`
- `signature_profiles`
- `signer_tokens`
- `email_send_records`
- `envelope_fields`
- `field_values`
- `audit_events`
- `history_access_links`
- `history_access_requests`
- `history_email_records`
- `history_sessions`
- `history_security_events`

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
| `pnpm db:seed:{dev,staging,production}` | Seed demo client data. |

All `db:*` scripts load per-environment vars with `@dotenvx/dotenvx`.

## Verification

Before declaring changes done:

```bash
pnpm types
pnpm test
pnpm lint
pnpm build
```

The test suite includes lifecycle API smoke coverage, PDF finalization assertions, field editor and signer UI tests, My Documents credential/catalog/recovery/security coverage, and release/docs contract checks.

## Development Notes

- `AGENTS.md` is the compact agent context map.
- `ARCHITECTURE.md` is the stable code map for module boundaries and invariants.
- `docs/AGENT_GUIDE.md` contains detailed agent operating rules distilled from `.claude/rules`.
- Prefer deep modules: test through public module/API/component boundaries.
- Keep source files under 500 lines.
- Do not edit `src/components/ui/*` manually; use Shadcn tooling.
- Do not edit `src/routeTree.gen.ts` manually; it is generated by TanStack Router during dev/build.
- `plans/simple-esignature-prd.md` defines the core lifecycle contract; feature PRDs such as `plans/my-documents-prd.md` amend it for their surfaces.

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
