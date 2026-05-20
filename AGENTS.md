# signmos

Signmos is a lightweight e-signature workflow on TanStack Start + Hono + Cloudflare Workers. It stores envelope metadata in Neon Postgres through Drizzle and stores source/final PDF artifacts in Cloudflare R2.

## Product Scope

Current workflow:

1. Create a draft envelope.
2. Upload one source PDF under 10 MB.
3. Add up to 10 recipients.
4. Add signature/date fields with page coordinates.
5. Send the envelope and receive generated signing links.
6. Signers open `/signing/{token}` without accounts.
7. Signers complete typed signature/date values or decline with reason/comment.
8. After all recipients complete, the app stores a completed PDF artifact with flattened values and audit summary.
9. The lifecycle API exposes status polling and final PDF download.

Important limitations:

- Email sending is represented by persisted send records and returned signing links; production email delivery UI is not complete.
- `/manual-signing-smoke` exists for local/manual end-to-end browser verification.
- `/envelope-fields` is a field placement/review screen, not a full envelope dashboard.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (Router + Query + SSR) |
| API | Hono on Cloudflare Workers |
| Runtime | Cloudflare Workers |
| Storage | Cloudflare R2 via `DOCUMENTS_BUCKET` |
| Database | Neon Postgres + Drizzle ORM |
| Validation | Zod |
| Styling | Tailwind CSS v4, Shadcn (new-york, Zinc, CSS vars) |
| Language | TypeScript (strict) |
| Linter | Biome |
| Tests | Vitest + Testing Library + jsdom |
| Package manager | pnpm |

## Project Structure

- `src/routes/` — file-based routes; `routeTree.gen.ts` is generated.
- `src/routes/envelope-fields.tsx` — field placement route; accepts `envelopeId`, `recipientId`, `name`, `email` query params.
- `src/routes/signing.$token.tsx` — magic-link signer route.
- `src/routes/manual-signing-smoke.tsx` — browser-driven local smoke test route.
- `src/components/envelopes/` — field editor UI and tests.
- `src/components/signing/` — signer UI, manual smoke UI, and tests.
- `src/components/ui/` — Shadcn primitives; do not edit manually.
- `src/db/envelope/` — envelope tables, Zod schemas, queries, and PDF finalization.
- `src/db/client/` — starter client demo domain.
- `src/db/migrations/dev/` — dev migrations.
- `src/hono/api/envelopes.ts` — envelope lifecycle API.
- `src/hono/api/signing.ts` — signer token/session/completion API.
- `src/server.ts` — custom CF Workers entry; routes `/api/*` to Hono and the rest to TanStack.
- `src/integrations/tanstack-query/` — query client setup and providers.
- Path alias: `@/*` → `src/*`.

## Key API Endpoints

- `POST /api/envelopes`
- `POST /api/envelopes/:id/source-pdf`
- `POST /api/envelopes/:id/recipients`
- `POST /api/envelopes/:id/fields`
- `POST /api/envelopes/:id/actions` with `{ "action": "send" }`
- `POST /api/envelopes/:id/recipients/:recipientId/resend`
- `GET /api/envelopes/:id/status`
- `GET /api/envelopes/:id/final-pdf`
- `GET /api/signing/:token`
- `POST /api/signing/:token/complete`
- `POST /api/signing/:token/decline`

See `docs/simple-esignature-prd.md` for the lifecycle contract, validation checklist, and product assumptions.

## Commands

```bash
pnpm dev                  # dev server (port 3000)
pnpm build                # production build
pnpm serve                # preview production build
pnpm deploy               # build + wrangler deploy
pnpm test                 # run all tests
pnpm test:watch           # watch mode
pnpm test:coverage        # with coverage
pnpm types                # type-check (tsc --noEmit)
pnpm lint                 # biome check
pnpm lint:ci              # biome ci
pnpm lint:fix             # biome auto-fix
pnpm knip                 # unused files/deps/exports
pnpm deps                 # check for updates
pnpm deps:update          # apply minor updates
pnpx shadcn@latest add <component>  # add Shadcn component

# Database (per-environment)
pnpm db:generate:dev
pnpm db:generate:staging
pnpm db:generate:production
pnpm db:migrate:dev
pnpm db:migrate:staging
pnpm db:migrate:production
pnpm db:pull:dev
pnpm db:seed:dev
pnpm db:seed:staging
pnpm db:seed:production
pnpm db:studio
```

## Manual Local Verification

Run:

```bash
pnpm db:migrate:dev
pnpm dev
```

Open:

```text
http://localhost:3000/manual-signing-smoke
```

Use it to create, prepare, send, sign, check final availability, and download the final PDF from the browser.

For field-editor review against real draft data, create an envelope and recipient, then open:

```text
/envelope-fields?envelopeId=<uuid>&recipientId=<uuid>&name=Ada%20Lovelace&email=ada@example.com
```

## Architecture

Prefer **deep modules** (Ousterhout): small public interface hiding larger implementation. Test at module boundaries, not internals. See `.claude/rules/deep-modules.md`.

Technology-specific rules live in `.claude/rules/` with scoped `paths:` frontmatter.

## Verification

Max 500 lines per source file; split files before exceeding the limit.

<important if="you have finished implementing or modifying code">
Run manually before declaring done:
1. `pnpm types`
2. `pnpm test`
3. `pnpm lint`
4. `pnpm build`
</important>

<important if="you are writing or modifying tests">
- Tests live next to source as `*.test.ts` / `*.test.tsx`.
- Vitest globals are enabled; no need to import `describe` / `it` / `expect`.
- Path alias `@` resolves to `src/`.
- Route files (`src/routes/**`) are excluded from test discovery.
- Mock only external boundaries such as DB, R2, network, time, and browser APIs.
</important>

<important if="you are creating or reviewing design documents">
- `/docs` is the single source of truth for business requirements and lifecycle contract docs.
- Apply review notes/status updates directly in the corresponding design doc.
- Never create separate markdown files for reviews/audits/analyses unless explicitly asked.
</important>
