# Dispatch Drafts: No-Account E-Signature Pilot

> Parent PRD: `docs/simple-esignature-prd.md`
>
> GitHub issues created on 2026-05-20.
>
> Note: `gh auth status` still reports an invalid token for `tkowalczyk`, but `gh issue` network operations succeeded during dispatch.

## Created Issues

- Parent PRD: #13 — https://github.com/auditmos/signmos/issues/13
- #14 — Verified sender envelope start
- #15 — PDF upload, storage, and revision slot
- #16 — Signature profiles and field placement
- #17 — Resend delivery and partner verification
- #18 — Partner review, signing, and change request loop
- #19 — Completion, final PDF, and audit certificate
- #20 — Cancel, delete, and retention controls
- #21 — Agent-ready contract and pilot smoke hardening

## Proposed Breakdown

1. **#14 Verified sender envelope start** — Type: AFK — Blocked by: None — User stories: 1, 2, 16, 25, 27, 29, 31, 32
2. **#15 PDF upload, storage, and revision slot** — Type: AFK — Blocked by: #14 — User stories: 3, 4, 14, 15, 25, 28, 29, 31, 32
3. **#16 Signature profiles and field placement** — Type: HITL — Blocked by: #14, #15 — User stories: 5, 6, 7, 15, 29, 30, 31, 32
4. **#17 Resend delivery and partner verification** — Type: AFK — Blocked by: #14, #15, #16 — User stories: 8, 9, 16, 17, 23, 24, 25, 29, 31, 32
5. **#18 Partner review, signing, and change request loop** — Type: HITL — Blocked by: #17 — User stories: 10, 11, 12, 13, 14, 15, 16, 23, 25, 29, 31, 32
6. **#19 Completion, final PDF, and audit certificate** — Type: AFK — Blocked by: #18 — User stories: 16, 21, 22, 23, 25, 29, 32
7. **#20 Cancel, delete, and retention controls** — Type: AFK — Blocked by: #19 — User stories: 17, 18, 19, 20, 23, 25, 28, 29, 32
8. **#21 Agent-ready contract and pilot smoke hardening** — Type: HITL — Blocked by: #20 — User stories: 1-32

---

## Issue 1: Verified Sender Envelope Start

### Parent PRD

#13

### Type

AFK

### What to build

Implement the no-account sender start path from public form/API through verified email magic link, draft/awaiting-verification envelope state, audit events, Turnstile/rate-limit controls, idempotency, and structured errors.

### Assumptions

- The current Workers/Neon/Drizzle architecture remains in use.
- Resend can be mocked or replaced with fallback link capture in local/test environments.
- Turnstile can be validated through a test-safe adapter.

### Out of scope for this issue

- Do not add PDF upload, partner recipients, signatures, sending, final PDFs, public API keys, or password accounts.

### Acceptance criteria

- [ ] Sender can start an envelope with name/email and no password account — [test: API/UI integration test]
- [ ] Missing/invalid Turnstile and rate-limited IP/email attempts are rejected — [test: abuse-control integration test]
- [ ] Verification email send record or fallback link is produced — [observable: email send row or test response]
- [ ] Valid sender magic link verifies the session; expired/invalid links return stable JSON errors — [test: verification token test]
- [ ] Envelope status exposes draft/awaiting-verification and allowed next actions — [test: status contract test]
- [ ] Sender start and verification append immutable audit events — [observable: audit event rows]
- [ ] Repeating idempotent start requests does not duplicate envelopes or sends — [test: idempotency test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run database migrations for the local test environment.
2. Run sender start, verification, rate-limit, Turnstile, idempotency, and status-contract tests.
3. Inspect test database rows for envelope, audit event, idempotency, and email send records.
4. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

None - can start immediately.

### User stories addressed

- User stories 1, 2, 16, 25, 27, 29, 31, 32

---

## Issue 2: PDF Upload, Storage, And Revision Slot

### Parent PRD

#13

### Type

AFK

### What to build

Allow a verified sender to upload one source PDF, store it in R2, persist document metadata/hash, show clear upload errors, and establish the document revision slot used later after change requests.

### Assumptions

- #14 is complete.
- R2 has a local/test binding or mock that can verify object lifecycle behavior.

### Out of scope for this issue

- Do not add field placement, partner sending, signer flows, final PDF generation, or retention cleanup.

### Acceptance criteria

- [ ] Verified sender can upload one valid PDF and see document metadata — [test: API/UI upload test]
- [ ] Non-PDF, empty, duplicate, and over-limit uploads are rejected with actionable UI and stable JSON errors — [test: validation test]
- [ ] Source PDF object key, byte size, content type, and checksum/hash are persisted — [observable: document row and R2 object]
- [ ] Upload appends audit events and structured errors for rejected attempts — [observable: audit/log evidence]
- [ ] Repeating upload with the same idempotency key does not duplicate records or objects — [test: idempotency test]
- [ ] Document model can represent a later revised source version and clear dependent fields when invoked by a supported state — [test: revision-slot integration test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Apply migrations through this issue.
2. Run upload, validation, R2 storage, idempotency, and revision-slot tests.
3. Confirm persisted document metadata includes hash and R2 key.
4. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #14

### User stories addressed

- User stories 3, 4, 14, 15, 25, 28, 29, 31, 32

---

## Issue 3: Signature Profiles And Field Placement

### Parent PRD

#13

### Type

HITL - requires visual review of signature creation and PDF field placement before merge.

### What to build

Implement sender signature preparation: drawn signatures, typed-name generated signature marks, visual signature/date placement for sender and partner, explicit API field creation, and default bottom-right placement for agent-created envelopes.

### Assumptions

- #14 and #15 are complete.
- A draft partner recipient can be represented before send.

### Out of scope for this issue

- Do not add uploaded signature images, templates, text fields, checkboxes, initials, partner verification, signing completion, or final PDF rendering.

### Acceptance criteria

- [ ] Sender can create and select a drawn signature profile — [test: component/API persistence test]
- [ ] Sender can generate/select a signature-like mark from typed text — [test: component/API persistence test]
- [ ] Sender can place signature/date fields for sender and partner on PDF pages — [test: UI integration test]
- [ ] API can create equivalent explicit fields with recipient assignment, page, geometry, and type — [test: API field contract test]
- [ ] API can create default bottom-right signature/date fields without explicit coordinates — [test: default placement contract test]
- [ ] Invalid field input returns valid values/allowed actions in error JSON — [test: machine-readable error test]
- [ ] Revised source PDF upload clears previous fields when the envelope is in changes requested — [test: revision field-clearing test]
- [ ] Signature and placement UI passes visual review — [HITL: owner design review before merge]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run signature profile, field API, default placement, and revision field-clearing tests.
2. Run the browser field-placement flow and capture owner-approved evidence for the HITL gate.
3. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #14
- Blocked by #15

### User stories addressed

- User stories 5, 6, 7, 15, 29, 30, 31, 32

---

## Issue 4: Resend Delivery And Partner Verification

### Parent PRD

#13

### Type

AFK

### What to build

Send prepared envelopes through Resend or fallback links, create partner verification links, require partner email verification before signing access, enforce 7-day expiry, and expose sent-state visibility for humans and agents.

### Assumptions

- #14, #15, and #16 are complete.
- Resend can be mocked in tests and configured in pilot environments.

### Out of scope for this issue

- Do not add partner signing completion, change requests, final PDF generation, cancel/delete, or retention cleanup.

### Acceptance criteria

- [ ] Verified sender can send a prepared envelope to partner email — [test: send integration test]
- [ ] Resend payloads or fallback links are recorded with delivery metadata — [observable: email send rows]
- [ ] Partner must verify email before signing access is granted — [test: partner verification flow test]
- [ ] Sent envelope status exposes allowed next actions and final PDF unavailable state — [test: status contract test]
- [ ] Signing/verification links expire after 7 days and return stable expired-link errors — [test: time-controlled expiry test]
- [ ] Send, verification, view, and expiry actions append audit events — [observable: audit event rows]
- [ ] Repeated send/resend attempts are idempotent or explicitly rejected with allowed actions — [test: retry/state transition test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run send, Resend adapter, partner verification, status, expiry, audit, and retry tests.
2. Inspect email send records for sender/partner verification and send events.
3. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #14
- Blocked by #15
- Blocked by #16

### User stories addressed

- User stories 8, 9, 16, 17, 23, 24, 25, 29, 31, 32

---

## Issue 5: Partner Review, Signing, And Change Request Loop

### Parent PRD

#13

### Type

HITL - requires signer UX review before merge.

### What to build

Build the verified partner experience: review PDF, sign assigned fields, request changes with comment, pause completion, notify sender, let sender upload a revised PDF, clear fields, and resend through the same envelope flow.

### Assumptions

- #17 is complete.
- Revision slot and field clearing behavior from #15 and #16 are available.

### Out of scope for this issue

- Do not add final PDF generation, audit certificate page, deletion, retention cleanup, or multi-message discussion threads.

### Acceptance criteria

- [ ] Verified partner can review the PDF and assigned fields without password account login — [test: signer UI integration test]
- [ ] Partner can complete required signature/date fields and recipient status updates — [test: signing integration test]
- [ ] Partner can request changes with a comment; envelope moves to changes requested — [test: change-request integration test]
- [ ] Changes requested blocks completion and exposes sender next action to upload revised PDF — [test: state transition test]
- [ ] Sender can upload revised PDF, old fields are cleared, and envelope can be prepared/sent again — [test: revision loop integration test]
- [ ] Change request and resend produce email notifications or fallback links — [observable: email send rows]
- [ ] Review, sign, comment, revision, and resend append audit events — [observable: audit event rows]
- [ ] Signer and change-request UX passes visual review — [HITL: owner design review before merge]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run signer access, signing, change-request, revision loop, email, and audit tests.
2. Run a browser walkthrough of partner review, sign, request changes, and sender revision.
3. Record owner approval for the HITL UX gate.
4. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #17

### User stories addressed

- User stories 10, 11, 12, 13, 14, 15, 16, 23, 25, 29, 31, 32

---

## Issue 6: Completion, Final PDF, And Audit Certificate

### Parent PRD

#13

### Type

AFK

### What to build

Finalize envelopes after all required parties sign. Generate and store a completed PDF with flattened signatures/dates plus an appended audit/certificate page containing event summary and checksum/hash, then notify both parties and expose verified final download.

### Assumptions

- #18 is complete.
- PDF generation is viable within the selected Worker/runtime constraints for pilot PDF size.

### Out of scope for this issue

- Do not add certified signing, notarization, advanced evidence packages, webhooks, new field types, or templates.

### Acceptance criteria

- [ ] Envelope reaches completed only after all required parties complete assigned fields — [test: completion state test]
- [ ] Completed PDF is stored in R2 with metadata/hash and final availability status — [observable: final document row and R2 object]
- [ ] Final PDF visibly contains flattened signatures and dates at saved fields — [test: deterministic PDF assertion or visual regression]
- [ ] Final PDF includes appended audit/certificate page with checksum/hash and signing event summary — [test: PDF certificate assertion]
- [ ] Both parties receive completion email records or fallback notifications — [observable: email send rows]
- [ ] Verified process links can download final PDF; unverified/expired/deleted access cannot — [test: access-control download test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run completion, PDF finalization, certificate, notification, and download access tests.
2. Inspect R2/local storage for final artifact and database for final document metadata/hash.
3. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #18

### User stories addressed

- User stories 16, 21, 22, 23, 25, 29, 32

---

## Issue 7: Cancel, Delete, And Retention Controls

### Parent PRD

#13

### Type

AFK

### What to build

Give senders control over active and stored documents: manual cancel/expire, sender delete with PDF access revocation/removal, deleted-message recipient UX, and 90-day retention eligibility for completed/expired envelopes.

### Assumptions

- #19 is complete.
- Retention execution can be represented by a callable action, test command, or scheduled Worker binding.

### Out of scope for this issue

- Do not add partner-initiated deletion, legal holds, custom retention policies, or admin restore.

### Acceptance criteria

- [ ] Sender can manually cancel/expire an active envelope and block further signing — [test: cancel/expire flow test]
- [ ] Sender can delete an envelope and revoke/remove source/final PDF access — [test: delete/storage integration test]
- [ ] Partner opening a deleted envelope link sees "This document was deleted by the sender" with no PDF access — [test: signer deleted-state UI test]
- [ ] Completed/expired envelopes become retention-eligible 90 days after terminal state — [test: time-controlled retention test]
- [ ] Delete, cancel, expire, and retention eligibility append audit events and structured logs — [observable: audit/log evidence]
- [ ] Email notifications or fallback records are produced for relevant cancel/delete events — [observable: email send rows]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run cancel/expire, delete/storage, deleted-state UI, retention, email, and audit tests.
2. Confirm deleted links cannot access source or completed PDFs.
3. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #19

### User stories addressed

- User stories 17, 18, 19, 20, 23, 25, 28, 29, 32

---

## Issue 8: Agent-Ready Contract And Pilot Smoke Hardening

### Parent PRD

#13

### Type

HITL - requires owner pilot-readiness walkthrough before launch.

### What to build

Harden the complete pilot for humans and future agents. Document the lifecycle contract, verify idempotent/retry-safe behavior, polish loading/error/empty states, and provide repeatable smoke paths for browser and API use.

### Assumptions

- #14-#20 are complete.
- This issue does not add new major product capabilities.

### Out of scope for this issue

- Do not add public API keys, standalone CLI, webhooks, billing, templates, or additional field types.

### Acceptance criteria

- [ ] API contract docs list endpoints, schemas, statuses, idempotency keys, allowed actions, and error codes — [observable: docs artifact]
- [ ] Agent-style smoke creates/verifies sender, uploads PDF, prepares/default-places fields, sends, verifies partner, signs, polls, and downloads final PDF — [test or runnable command]
- [ ] Human browser smoke covers upload, sender verification, field preparation, send, partner verification, sign/change request, revision, completion, and final download — [test: browser/UI smoke or HITL checklist]
- [ ] Professional UI states exist for loading, empty, validation error, expired, changes requested, completed, and deleted states — [test: component/browser state coverage]
- [ ] All PRD validation items are mapped to tests, observable artifacts, or runnable commands — [observable: validation checklist]
- [ ] Owner signs off that the pilot is usable for an external customer walkthrough — [HITL: owner pilot-readiness walkthrough before launch]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

### How to verify

1. Run the API contract tests and agent-style smoke command/test.
2. Run the browser smoke against the local dev server and capture evidence for the HITL gate.
3. Review docs against implemented endpoints and errors.
4. Confirm every PRD validation item has mapped evidence.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #20

### User stories addressed

- User stories 1-32
