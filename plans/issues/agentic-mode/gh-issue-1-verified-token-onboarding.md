## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Deliver the first complete Agentic tracer bullet from the fourth landing choice to one successful Bearer-authenticated identity call.

The user requests dedicated Agentic access with email plus Turnstile, receives a scanner-safe single-use link, redeems it into a 15-minute browser-only management session, acknowledges full token authority, generates one named opaque token, sees the secret once, copies platform-neutral setup guidance, and calls the first `/api/v1` identity resource. Publish initial secret-free `/agent.md` and `/openapi.json` artifacts that describe this slice from the same runtime schemas.

Persist dedicated Agentic access-link/session hashes and API-token hash/metadata. Audit the authenticated call with normalized email, stable token ID/name, and agent actor type. Reuse the existing email, Turnstile, normalized-email, and security-audit boundaries; do not build a parallel identity or signing lifecycle.

## Assumptions

- The existing Turnstile verifier, transactional-email boundary, scanner-safe confirmation pattern, normalized-email rules, and security-audit conventions are implemented and tested.
- Cloudflare Workers, Neon Postgres/Drizzle, and the project migration workflow remain the runtime/persistence stack.
- The identity response is the only `/api/v1` business resource in this issue.
- The source PRD and approved plan define the durable token, session, prompt, audit, and redaction contracts.

## Out of scope for this issue

- Multiple active tokens, token history/listing, revocation, and the five-token cap; issue 2 adds these.
- Document catalog, document creation, upload, signing, lifecycle actions, and final PDF access.
- Complete documentation for later document resources.
- Final rate-limit thresholds, full UI/API parity, CLI, SDK, MCP, webhooks, or token scopes.
- Refactoring existing browser sender, signer, completed-document, or My Documents contracts.

## Acceptance criteria

- [ ] The landing chooser renders exactly four unselected tasks including Agentic mode and preserves the existing three choices — [test: landing component behavior]
- [ ] Agentic access requests validate email and Turnstile, require an Idempotency-Key, permit the explicit bypass only outside production, and return enumeration-safe public responses — [test: public access-request contract]
- [ ] Normal UI/production responses never expose the Agentic verification URL; restricted debug exposure remains non-production only — [test: verification-link exposure]
- [ ] Link inspection is scanner-safe; explicit same-origin redemption works before 30 minutes, fails at/after 30 minutes, and two concurrent redemptions yield exactly one session — [test: time-controlled atomic credential lifecycle]
- [ ] The management cookie is secure, HTTP-only, same-site, valid before 15 minutes, invalid at/after 15 minutes, and cannot authorize My Documents or `/api/v1` — [test: time-controlled session isolation]
- [ ] Token generation requires a non-empty name and explicit acknowledgment that it can send, sign, decline, cancel, and delete as the verified email — [test: management API and console form]
- [ ] The generated secret has the `signmos_` prefix and at least 256 bits of CSPRNG material; only a deterministic hash and safe metadata persist — [test: token generation/persistence boundary]
- [ ] The raw secret is returned/displayed once and is absent from later reads, reloads, persisted rows, public artifacts, logs, errors, and audits — [test: one-time display and credential redaction]
- [ ] The `/api/v1` identity resource rejects missing/malformed Bearer, cookies, query credentials, and `x-internal-user-id`; the generated Bearer returns normalized email and safe token metadata only — [test: authentication matrix]
- [ ] The authenticated call records normalized email, stable token ID/name, and `actorType: "agent"` without raw token/hash material — [test: audit attribution]
- [ ] Public `/agent.md` and `/openapi.json` are unauthenticated, accurately describe the identity slice, use runtime schemas, and contain no secret — [test: public artifact and schema-drift contract]
- [ ] The console prompt is platform-neutral, references `$SIGNMOS_TOKEN`, and exposes separate accessible copy controls for prompt and secret/environment setup — [test: prompt UI/accessibility]
- [ ] An end-to-end onboarding test starts at the fourth choice and finishes with a valid Bearer identity response using only the one-time secret — [test: agentic onboarding integration smoke]

## How to verify

1. Run `pnpm test -- -t "agentic onboarding"`; the public request, exact time boundaries, atomic redemption, generation, prompt, and identity smoke pass.
2. Run `pnpm test -- -t "agent credential redaction"`; no raw link/session/token/hash canary appears outside the one-time generation response.
3. Run `pnpm types`.
4. Run `pnpm test`.
5. Run `pnpm lint`.
6. Run `pnpm build`.
7. Inspect the generated OpenAPI/Markdown responses in the integration smoke and confirm neither requires authentication or contains the test secret.

## Blocked by

None — can start immediately.

## User stories addressed

- User stories 1–5
- User stories 7–8
- User stories 15–16
- User stories 38–42
