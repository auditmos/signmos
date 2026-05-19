# Dispatch Drafts: Simple E-Signature Workflow

> Parent PRD: `docs/simple-esignature-prd.md`
>
> GitHub issues created on 2026-05-19.

## Created Issues

- Parent PRD: #5 — https://github.com/auditmos/signmos/issues/5
- #6 — Envelope foundation and agent API contract
- #7 — PDF upload and R2 document storage
- #8 — Recipients and parallel sending through Resend
- #9 — Shared field model with visual and API placement
- #10 — Magic-link signer flow with decline and comments
- #11 — Completed PDF finalization and audit summary
- #12 — End-to-end agent and human smoke path

## Proposed Breakdown

1. **Envelope foundation and agent API contract** — Type: AFK — Blocked by: None — User stories: 1, 17, 18, 19, 20
2. **PDF upload and R2 document storage** — Type: AFK — Blocked by: 1 — User stories: 2, 18, 19, 20
3. **Recipients and parallel sending through Resend** — Type: AFK — Blocked by: 1, 2 — User stories: 3, 6, 13, 14, 18, 19, 20
4. **Shared field model with visual and API placement** — Type: HITL — Blocked by: 2, 3 — User stories: 4, 5, 18, 19, 20
5. **Magic-link signer flow with decline and comments** — Type: HITL — Blocked by: 3, 4 — User stories: 7, 8, 9, 10, 11, 12, 13
6. **Completed PDF finalization and audit summary** — Type: AFK — Blocked by: 5 — User stories: 12, 15, 16, 18
7. **End-to-end agent and human smoke path** — Type: AFK — Blocked by: 6 — User stories: 1-20

---

## Issue 1: Envelope Foundation And Agent API Contract

### Parent PRD

PARENT_PRD_ISSUE

### Type

AFK

### What to build

Implement the authenticated draft envelope foundation and establish the agent-friendly API conventions for lifecycle endpoints: stable JSON, idempotency for mutating operations, and machine-readable errors.

### Assumptions

- Neon/Drizzle is the database foundation.
- If internal auth is missing, this issue may add the smallest viable internal-user identity layer needed to create authenticated envelopes.

### Out of scope for this issue

- Do not add PDF upload.
- Do not add recipients, fields, signing, emails, or final PDF generation.
- Do not add role-based internal permissions.

### Acceptance criteria

- [ ] Authenticated API client can create a draft envelope with stable JSON response including envelope ID and status `draft` — [test: API integration test]
- [ ] Created envelope persists `created_by` identity and creation timestamp — [observable: database row]
- [ ] Repeating create with the same idempotency key returns the original result without duplicate rows — [test: idempotency integration test]
- [ ] Invalid status/action inputs return machine-readable error JSON with code, message, and valid values — [test: error contract test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Run database migrations for the local test environment.
2. Run the API integration tests for envelope creation and idempotency.
3. Run `pnpm types`.
4. Run `pnpm test`.
5. Run `pnpm lint`.

### Blocked by

None - can start immediately.

### User stories addressed

- User story 1
- User story 17
- User story 18
- User story 19
- User story 20

---

## Issue 2: PDF Upload And R2 Document Storage

### Parent PRD

PARENT_PRD_ISSUE

### Type

AFK

### What to build

Allow an authenticated internal user or API client to attach one source PDF to a draft envelope, store it in R2, enforce PDF/size validation, and persist source document metadata and hash.

### Assumptions

- Issue 1 is complete.
- R2 binding and local test strategy are available.

### Out of scope for this issue

- Do not add PDF preview UI.
- Do not add fields, recipients, signing links, or final PDF generation.

### Acceptance criteria

- [ ] Valid PDF under 10 MB uploads to R2 and links to the draft envelope — [test: API/storage integration test]
- [ ] Non-PDF and over-limit uploads are rejected with stable machine-readable errors — [test: validation test]
- [ ] Source PDF hash and R2 object key are persisted — [observable: database row plus R2 object]
- [ ] Repeating upload with the same idempotency key does not create duplicate document records — [test: idempotency integration test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Apply migrations from Issue 1 and this issue.
2. Run the upload/storage integration tests.
3. Confirm a test PDF object exists in the configured R2 test bucket or local mock.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 1

### User stories addressed

- User story 2
- User story 18
- User story 19
- User story 20

---

## Issue 3: Recipients And Parallel Sending Through Resend

### Parent PRD

PARENT_PRD_ISSUE

### Type

AFK

### What to build

Add recipient management, parallel envelope sending, expiring signer tokens, Resend invitation email records, and manual resend behavior.

### Assumptions

- Issues 1 and 2 are complete.
- Resend configuration is available in local/test environments or can be mocked in tests.

### Out of scope for this issue

- Do not build signer completion UI.
- Do not add field placement.
- Do not generate completed PDFs.
- Do not add automatic reminders.

### Acceptance criteria

- [ ] API can add up to 10 recipients with valid name/email fields — [test: recipient API test]
- [ ] Recipient count above 10 and invalid emails are rejected with stable errors — [test: validation test]
- [ ] Sending a ready envelope creates active tokens for all recipients in parallel and records `sent_by` identity — [test: integration test]
- [ ] Invitation email send records are persisted for each recipient — [observable: database rows]
- [ ] Manual resend creates a new email send record without duplicating recipients — [test: resend integration test]
- [ ] Expired tokens cannot be used and return an expired-token error — [test: time-controlled token test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Apply migrations through this issue.
2. Run recipient, send, resend, and token-expiry tests.
3. Verify email send records are persisted for all recipients.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 1
- Blocked by Issue 2

### User stories addressed

- User story 3
- User story 6
- User story 13
- User story 14
- User story 18
- User story 19
- User story 20

---

## Issue 4: Shared Field Model With Visual And API Placement

### Parent PRD

PARENT_PRD_ISSUE

### Type

HITL - requires visual editor UX review before merge.

### What to build

Implement one field-coordinate model for signature/date fields, expose it through lifecycle JSON APIs, and add a visual editor path for internal users to place fields on PDF pages.

### Assumptions

- Issues 2 and 3 are complete.
- Recipients are created before fields are assigned.

### Out of scope for this issue

- Do not add text, checkbox, initials, autofill, or templates.
- Do not build signer completion.
- Do not build final PDF rendering.

### Acceptance criteria

- [ ] API can create signature and date fields with page/x/y/width/height and recipient assignment — [test: field API test]
- [ ] Visual editor can create and persist the same field records — [test: UI integration test]
- [ ] Invalid field types, page numbers, geometry, and recipient IDs return machine-readable errors with valid field types listed — [test: validation test]
- [ ] Fields cannot be changed after an envelope is sent unless the envelope returns to draft through an explicit supported action — [test: state guard test]
- [ ] Visual editor placement is reviewed and accepted — [HITL: design/UX review by repo owner before merge]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Run field API tests.
2. Run UI integration tests for placing fields.
3. Complete the visual editor review checkpoint.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 2
- Blocked by Issue 3

### User stories addressed

- User story 4
- User story 5
- User story 18
- User story 19
- User story 20

---

## Issue 5: Magic-Link Signer Flow With Decline And Comments

### Parent PRD

PARENT_PRD_ISSUE

### Type

HITL - requires signer experience review before merge.

### What to build

Build the no-account signer experience for valid magic links. Signers can review assigned fields, type a signature, complete date fields, decline with a reason, and leave comments.

### Assumptions

- Issues 3 and 4 are complete.
- Tokens expire according to the model from Issue 3.

### Out of scope for this issue

- Do not add signer accounts.
- Do not add delegation.
- Do not generate completed PDFs.

### Acceptance criteria

- [ ] Signer can open a valid magic link without internal login and only access their assigned envelope view — [test: signer access integration test]
- [ ] Signer can type a signature and complete required signature/date fields — [test: signer completion test]
- [ ] Completing one recipient updates recipient status while envelope remains sent until all required recipients complete — [test: status transition test]
- [ ] Signer can decline with a reason and optional comment, causing envelope declined status — [test: decline flow test]
- [ ] Comments and signer actions append immutable audit events — [observable: audit event rows]
- [ ] Signer experience is reviewed and accepted — [HITL: UX review by repo owner before merge]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Run signer access, completion, status, and decline tests.
2. Verify audit event rows for signing and comments.
3. Complete the signer UX review checkpoint.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 3
- Blocked by Issue 4

### User stories addressed

- User story 7
- User story 8
- User story 9
- User story 10
- User story 11
- User story 12
- User story 13

---

## Issue 6: Completed PDF Finalization And Audit Summary

### Parent PRD

PARENT_PRD_ISSUE

### Type

AFK

### What to build

Generate and store the completed flattened PDF after all required recipients complete. Embed typed signatures and dates into the source PDF and append an audit summary page generated from immutable audit events.

### Assumptions

- Issue 5 is complete.
- Source PDF retrieval and final PDF upload through R2 are available.

### Out of scope for this issue

- Do not add certified evidence packages.
- Do not add webhooks.
- Do not add advanced field types.

### Acceptance criteria

- [ ] Completing all required recipients triggers completed envelope status and final PDF generation — [test: end-to-end integration test]
- [ ] Final PDF in R2 includes flattened typed signatures and date values at the saved coordinates — [test: PDF content/visual regression or deterministic PDF assertion]
- [ ] Final PDF includes an appended audit summary page generated from immutable audit events — [test: PDF/audit summary assertion]
- [ ] API status indicates final PDF availability and download endpoint returns the completed artifact — [test: lifecycle API test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Run an end-to-end completion test with all recipients signing.
2. Assert completed status and final R2 object existence.
3. Assert PDF contains rendered field values and audit summary.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 5

### User stories addressed

- User story 12
- User story 15
- User story 16
- User story 18

---

## Issue 7: End-To-End Agent And Human Smoke Path

### Parent PRD

PARENT_PRD_ISSUE

### Type

AFK

### What to build

Add a full workflow smoke path and lifecycle API contract documentation so both humans and agents can verify the complete v1 workflow.

### Assumptions

- Issues 1-6 are complete.
- This issue does not add new product capabilities.

### Out of scope for this issue

- Do not add webhooks.
- Do not add templates.
- Do not add an in-app AI assistant.
- Do not add new field types or auth roles.

### Acceptance criteria

- [ ] Agent-style API smoke test creates, uploads, adds recipients/fields, sends, polls, signs through test helper, and downloads final PDF — [test or runnable command]
- [ ] Human UI smoke test covers upload, field placement, send, signer completion, and final PDF availability — [test: browser/UI integration test]
- [ ] API documentation or OpenAPI-like contract lists lifecycle endpoints, schemas, idempotency keys, and error codes — [observable: documentation artifact]
- [ ] All PRD validation strategy items are mapped to tests, observable artifacts, or commands — [observable: validation checklist]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

### How to verify

1. Run the agent-style lifecycle smoke test.
2. Run the human UI workflow smoke test.
3. Review the API contract artifact for lifecycle endpoints, schemas, idempotency, and errors.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

### Blocked by

- Blocked by Issue 6

### User stories addressed

- User stories 1-20
