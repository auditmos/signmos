# Plan: No-Account E-Signature Pilot

> Source PRD: `plans/simple-esignature-prd.md`

## Architectural decisions

- **Architecture style**: TanStack Start frontend with Hono API on Cloudflare Workers.
- **Identity model**: no password accounts in v1; sender and partner use verified email magic links.
- **Data model**: Neon Postgres/Drizzle owns envelopes, verification sessions, recipients, fields, signature profiles, audit events, idempotency records, email send records, rate-limit records, and retention/deletion state.
- **Document storage**: Cloudflare R2 owns source PDFs and completed PDF artifacts; database rows own metadata, hashes, deletion state, and retention eligibility.
- **Email**: Resend sends transactional email when configured; local/dev/recovery paths expose fallback links.
- **Abuse controls**: Cloudflare Turnstile protects public initiation; rate limits apply by IP and email.
- **Agent foundation**: REST/JSON endpoints expose stable schemas, explicit allowed actions, idempotency on mutations, and bounded machine-readable errors.
- **Future public API**: design for customer API keys and a standalone agent CLI later, but do not ship API-key auth in the pilot.
- **Final artifact**: completed PDFs include flattened signatures/dates plus an appended audit/certificate page with checksum/hash.
- **Retention**: terminal envelopes are retained for 90 days after completion or expiry unless the sender deletes earlier.

---

## Phase 1: Verified Sender Envelope Start

**User stories**: 1, 2, 16, 25, 27, 29, 31, 32

### What to build

Create the no-account sender start path. A sender enters name/email, passes Turnstile/rate-limit checks, receives a verification email or fallback link, verifies through a magic link, and gets a draft/awaiting-verification envelope session with audit events and agent-readable state.

### Assumptions carried in

- The app can send or record email through the configured email abstraction.
- Turnstile can be mocked or bypassed in test with an explicit test configuration.

### Out of scope for this phase

- PDF upload, partner recipients, signatures, field placement, sending, and final PDF generation.
- Public API keys or password accounts.

### Acceptance criteria

- [ ] Sender can start an envelope with name/email and no password account — [test: API/UI integration test]
- [ ] Sender start rejects missing/invalid Turnstile and rate-limited IP/email attempts — [test: abuse-control integration test]
- [ ] Verification email send record or fallback link is produced — [observable: email send row or test response]
- [ ] Valid sender magic link verifies the session; expired/invalid links return stable machine-readable errors — [test: verification token test]
- [ ] Envelope status exposes draft/awaiting-verification and allowed next actions — [test: status contract test]
- [ ] Sender start and verification append immutable audit events — [observable: audit event rows]
- [ ] Repeating idempotent start requests does not duplicate envelopes or verification sends — [test: idempotency test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 2: PDF Upload, Storage, And Revision Slot

**User stories**: 3, 4, 14, 15, 25, 28, 29, 31, 32

### What to build

Let a verified sender upload one source PDF to the envelope, store it in R2, persist metadata/hash, expose clear upload errors, and establish the same document slot for future revised uploads after change requests.

### Assumptions carried in

- Phase 1 verified sender sessions and idempotency conventions exist.
- R2 has a local/test binding or mock that can verify put/get/delete behavior.

### Out of scope for this phase

- PDF field placement, partner sending, change-request UI, completed PDF generation, and retention deletion jobs.

### Acceptance criteria

- [ ] Verified sender can upload one valid PDF and see document metadata — [test: API/UI upload test]
- [ ] Non-PDF, empty, duplicate, and over-limit uploads are rejected with actionable UI and stable JSON errors — [test: validation test]
- [ ] Source PDF object key, byte size, content type, and checksum/hash are persisted — [observable: document row and R2 object]
- [ ] Upload appends audit events and structured errors for rejected attempts — [observable: audit/log evidence]
- [ ] Repeating upload with the same idempotency key does not duplicate document records or objects — [test: idempotency test]
- [ ] The document model can mark later revision upload as a new source version and clear dependent fields when invoked by a supported state — [test: revision-slot unit/integration test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 3: Signature Profiles And Field Placement

**User stories**: 5, 6, 7, 15, 29, 30, 31, 32

### What to build

Give the sender a professional field-preparation surface. The sender can draw a signature or generate a signature-like mark from typed text, place signature/date fields for both parties, and agents can use the same field model plus default bottom-right placement.

### Assumptions carried in

- Phase 2 provides a verified sender with an uploaded source PDF.
- Recipient identity can be represented before send as sender plus one partner draft recipient.

### Out of scope for this phase

- Partner email verification, actual send, signer completion, and final PDF rendering.
- Uploaded signature images, templates, text fields, checkboxes, and initials.

### Acceptance criteria

- [ ] Sender can create and select a drawn signature profile — [test: component/API persistence test]
- [ ] Sender can type a name and generate/select a signature-like mark — [test: component/API persistence test]
- [ ] Sender can place signature/date fields for sender and partner on PDF pages — [test: UI integration test]
- [ ] API can create equivalent explicit fields with recipient assignment, page, geometry, and type — [test: API field contract test]
- [ ] API can create default bottom-right signature/date fields without explicit coordinates — [test: default placement contract test]
- [ ] Invalid field types, recipients, pages, or geometry return valid values/allowed actions in error JSON — [test: machine-readable error test]
- [ ] Revised source PDF upload clears previous fields when the envelope is in changes requested — [test: revision field-clearing test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 4: Resend Delivery And Partner Verification

**User stories**: 8, 9, 16, 17, 23, 24, 25, 29, 31, 32

### What to build

Send prepared envelopes through Resend or fallback links, create partner verification links, enforce 7-day expiry, and expose sent-state visibility for both humans and agents.

### Assumptions carried in

- Phase 3 can prepare a ready envelope with sender and partner fields.
- Resend can be mocked in automated tests and configured in pilot environments.

### Out of scope for this phase

- Partner signing completion, change requests, final PDF generation, cancel/delete, and retention cleanup.

### Acceptance criteria

- [ ] Verified sender can send a prepared envelope to partner email — [test: send integration test]
- [ ] Resend payloads or fallback links are recorded with delivery metadata — [observable: email send rows]
- [ ] Partner must verify email before signing access is granted — [test: partner verification flow test]
- [ ] Sent envelope status exposes allowed next actions and final PDF unavailable state — [test: status contract test]
- [ ] Signing/verification links expire after 7 days and return stable expired-link errors — [test: time-controlled expiry test]
- [ ] Send, verification, view, and expiry actions append audit events — [observable: audit event rows]
- [ ] Repeated send/resend attempts are idempotent or explicitly rejected with allowed actions — [test: retry/state transition test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 5: Partner Review, Signing, And Change Request Loop

**User stories**: 10, 11, 12, 13, 14, 15, 16, 23, 25, 29, 31, 32

### What to build

Complete the partner decision path. A verified partner can review the PDF, sign assigned fields, or request changes with a comment. Change requests pause completion, notify the sender, allow revised PDF upload, clear fields, and support resending through the same envelope flow.

### Assumptions carried in

- Phase 4 can send an envelope and verify partner identity.
- Phase 2 revision slot and Phase 3 field clearing behavior are available.

### Out of scope for this phase

- Completed PDF finalization, audit certificate page, deletion, and retention cleanup.
- Text discussion threads beyond the change-request comment.

### Acceptance criteria

- [ ] Verified partner can review the PDF and assigned fields without password account login — [test: signer UI integration test]
- [ ] Partner can complete required signature/date fields and recipient status updates — [test: signing integration test]
- [ ] Partner can request changes with a comment; envelope moves to changes requested — [test: change-request integration test]
- [ ] Changes requested blocks completion and exposes sender next action to upload revised PDF — [test: state transition test]
- [ ] Sender can upload revised PDF, old fields are cleared, and envelope can be prepared/sent again — [test: revision loop integration test]
- [ ] Change request and resend produce email notifications or fallback links — [observable: email send rows]
- [ ] Review, sign, comment, revision, and resend append audit events — [observable: audit event rows]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 6: Completion, Final PDF, And Audit Certificate

**User stories**: 16, 21, 22, 23, 25, 29, 32

### What to build

When every required party has signed, finalize the envelope. Generate a completed PDF in R2 with flattened signatures/dates and an appended audit/certificate page containing event summary and checksum/hash, then notify both parties and expose final access through verified process links.

### Assumptions carried in

- Phase 5 persists all field values, signature assets, dates, recipient statuses, and audit events.
- PDF generation can run within the selected Worker/runtime constraints for pilot PDF size.

### Out of scope for this phase

- Certified signing, notarization, advanced evidence packages, and webhooks.
- New field types or templates.

### Acceptance criteria

- [ ] Envelope reaches completed only after all required parties complete assigned fields — [test: completion state test]
- [ ] Completed PDF is stored in R2 with metadata/hash and final availability status — [observable: final document row and R2 object]
- [ ] Final PDF visibly contains flattened signatures and dates at saved fields — [test: deterministic PDF assertion or visual regression]
- [ ] Final PDF includes appended audit/certificate page with checksum/hash and signing event summary — [test: PDF certificate assertion]
- [ ] Both parties receive completion email records or fallback notifications — [observable: email send rows]
- [ ] Verified process links can download final PDF; unverified/expired/deleted access cannot — [test: access-control download test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 7: Cancel, Delete, And Retention Controls

**User stories**: 17, 18, 19, 20, 23, 25, 28, 29, 32

### What to build

Give the sender control over in-flight and stored documents. The sender can cancel/expire active envelopes, delete envelopes and revoke/remove PDF access, recipients see a clear deleted-document message, and terminal envelopes become eligible for deletion after 90 days.

### Assumptions carried in

- Phases 1-6 define sender ownership, partner access, R2 document records, and final artifacts.
- A background retention execution mechanism can be represented as a callable command/action or scheduled Worker binding.

### Out of scope for this phase

- Partner-initiated deletion requests.
- Enterprise legal holds, custom retention policies, or admin restore.

### Acceptance criteria

- [ ] Sender can manually cancel/expire an active envelope and block further signing — [test: cancel/expire flow test]
- [ ] Sender can delete an envelope and revoke/remove source/final PDF access — [test: delete/storage integration test]
- [ ] Partner opening a deleted envelope link sees "This document was deleted by the sender" with no PDF access — [test: signer deleted-state UI test]
- [ ] Completed/expired envelopes become retention-eligible 90 days after terminal state — [test: time-controlled retention test]
- [ ] Delete, cancel, expire, and retention eligibility append audit events and structured logs — [observable: audit/log evidence]
- [ ] Email notifications or fallback records are produced for relevant cancel/delete events — [observable: email send rows]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

---

## Phase 8: Agent-Ready Contract And Pilot Smoke Hardening

**User stories**: 1-32

### What to build

Make the pilot operable end to end by humans and future agents. Document the lifecycle contract, ensure every mutating action has idempotent/retry-safe behavior, polish loading/error/empty states, and provide repeatable smoke paths for human browser use and agent/API use.

### Assumptions carried in

- Phases 1-7 are complete.
- No new major product capability is introduced in this phase.

### Out of scope for this phase

- Public API keys, standalone CLI, webhooks, billing, templates, and additional field types.

### Acceptance criteria

- [ ] API contract documentation lists endpoints, request/response schemas, statuses, idempotency keys, allowed actions, and error codes — [observable: docs artifact]
- [ ] Agent-style smoke creates/verifies sender, uploads PDF, prepares/default-places fields, sends, verifies partner, signs, polls, and downloads final PDF — [test or runnable command]
- [ ] Human browser smoke covers upload, sender verification, field preparation, send, partner verification, sign/change request, revision, completion, and final download — [test: browser/UI smoke or HITL checklist]
- [ ] Professional UI states exist for loading, empty, validation error, expired, changes requested, completed, and deleted states — [test: component/browser state coverage]
- [ ] All PRD validation items are mapped to tests, observable artifacts, or runnable commands — [observable: validation checklist]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]
