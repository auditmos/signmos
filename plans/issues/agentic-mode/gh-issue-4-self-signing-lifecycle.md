## Parent PRD

#43

## Type

AFK — an agent can implement, verify, and merge this slice without human input. Every gate is automated or observable.

## What to build

Deliver the first complete Bearer-authenticated document mutation lifecycle. A verified token creates a self-sign draft, uploads one PDF, saves/selects a typed or drawn signature profile, prepares explicit or default signature/date fields, reviews and completes its assigned task, observes finalization, and downloads the completed PDF.

Introduce the universal idempotent-command authority with this slice. Every `/api/v1` mutation in the slice must require an Idempotency-Key, return the original result for an exact replay, and reject changed-request reuse without side effects. Reuse existing envelope, self-sign, storage, signature-profile, field, signing, finalization, audit, and email domain behavior.

## Assumptions

- Issue #46 supplies active-token authentication, role-aware reads, final-PDF access, error envelopes, audit attribution, redaction, and public contract publication.
- Existing source-PDF, self-sign preparation, signature profile, field placement, signing, finalization, R2, audit, and email behaviors remain authoritative.
- Existing one-PDF, PDF size, field, date, and retention rules must not be weakened.

## Out of scope for this issue

- Partner recipients, two-party send/resend, partner completion/change/decline.
- Revision after change request.
- Cancel/expire/delete or retention commands.
- Bulk operations, templates, webhooks, CLI, token scopes, or extra field types.

## Acceptance criteria

- [ ] Bearer-authenticated creation produces a self-sign draft owned by the normalized principal without another verification/email credential — [test: verified draft creation]
- [ ] Source upload accepts one valid PDF under 10 MB, rejects invalid type and exact over-limit input, persists byte size/hash/content type/version/R2 key, and authorizes preparation reads correctly — [test: source storage and boundaries]
- [ ] Typed/drawn signature profiles validate existing shapes, remain isolated by normalized email, and persist reusable content only with explicit existing consent — [test: signature profile boundary]
- [ ] Explicit/default field placement persists recipient, type, page, geometry, and existing one-signature-placeholder/draft-only rules — [test: field preparation]
- [ ] The self-signer resolves only its own assigned source/fields and repositions fields only where current self-sign rules permit — [test: signing-task authorization]
- [ ] Typed/drawn completion uses the server-controlled current date, ignores/rejects future client dates, records field values/audit attribution, and finalizes the envelope — [test: signing/finalization]
- [ ] Completed detail/history/final PDF become available to the token and contain flattened values plus certificate/checksum evidence — [test: completed artifact]
- [ ] Every `/api/v1` mutation in this slice rejects a missing Idempotency-Key — [test: mutation route enumeration]
- [ ] Exact key/request replay returns the original status/body without duplicate envelope, object, profile, field, value, audit, email, or finalization side effects — [test: idempotent replay]
- [ ] Reusing a key with changed JSON or PDF content returns `IDEMPOTENCY_CONFLICT` and executes no changed intent — [test: request fingerprint conflict]
- [ ] Precondition/state errors expose stable codes, valid values, field paths, allowed actions, retryability, and recovery guidance — [test: machine recovery contract]
- [ ] OpenAPI and `/agent.md` cover the complete self-sign workflow and remain runtime-aligned and secret-free — [test: contract publication]
- [ ] A curl-compatible integration smoke completes create → upload → default prepare → sign → poll → final download using only Bearer auth and Idempotency-Key — [test: self-sign integration smoke]

## How to verify

1. Run `pnpm test -- -t "agent self-sign lifecycle"`; the complete Bearer workflow and artifact assertions pass.
2. Run `pnpm test -- -t "agent command idempotency"`; missing key, exact replay, binary fingerprint, and conflict scenarios pass.
3. Run `pnpm test -- -t "agent API contract"`; self-sign OpenAPI/guidance/error assertions pass.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.
7. Run `pnpm build`.

## Blocked by

- Blocked by #46

## User stories addressed

- User stories 20–25
- User story 27
- User story 29
- User stories 34–36
- User stories 38–41
