# Plan: Simple E-Signature Workflow

> Source PRD: `docs/simple-esignature-prd.md`

## Architectural decisions

- **Architecture style**: TanStack Start frontend with Hono API on Cloudflare Workers.
- **Data model**: Neon Postgres/Drizzle owns relational metadata and immutable audit events; R2 owns source and completed PDF artifacts.
- **Key entities**: internal user, envelope, document, recipient, field, signer token, signature value, audit event, idempotency record, email send record.
- **Integrations**: Cloudflare R2 for PDFs, Resend for invitation emails, existing auth foundation if present.
- **Agent contract**: REST/JSON lifecycle endpoints with stable IDs, idempotency keys on mutating operations, bounded responses, and machine-readable errors.
- **Legal posture**: basic e-signature intent only; no certified trust-service claims.
- **Scale target**: PDFs under 10 MB, fewer than 10 recipients per envelope, fewer than 100 envelopes per month.

---

## Phase 1: Envelope Foundation And Agent Contract

**User stories**: 1, 17, 18, 19, 20

### What to build

Create the authenticated envelope foundation: internal users can create draft envelopes through the API, every envelope records creator identity, and mutating API calls establish the idempotency/error conventions that later slices reuse.

### Assumptions carried in

- Neon/Drizzle is reachable in local test configuration.
- Internal auth foundation is either present or this phase adds the smallest viable internal-user identity needed for authenticated envelope creation.

### Out of scope for this phase

- PDF upload, recipients, fields, sending, signer links, and final PDFs.
- Role-based permissions.

### Acceptance criteria

- [ ] Authenticated API client can create a draft envelope with stable JSON response including envelope ID and status `draft` — [test: API integration test]
- [ ] Created envelope persists `created_by` identity and creation timestamp — [observable: database row]
- [ ] Repeating create with the same idempotency key returns the original result without duplicate rows — [test: idempotency integration test]
- [ ] Invalid status/action inputs return machine-readable error JSON with code, message, and valid values — [test: error contract test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 2: PDF Upload And R2 Document Storage

**User stories**: 2, 18, 19, 20

### What to build

Allow internal users and API clients to attach one source PDF to a draft envelope, store it in R2, enforce the 10 MB/PDF-only limits, and persist document metadata and hash.

### Assumptions carried in

- Phase 1 envelope creation, auth, idempotency, and error contracts exist.
- R2 binding and local test strategy are available.

### Out of scope for this phase

- PDF preview UI, field placement, signer access, and final PDF generation.

### Acceptance criteria

- [ ] Valid PDF under 10 MB uploads to R2 and links to the draft envelope — [test: API/storage integration test]
- [ ] Non-PDF and over-limit uploads are rejected with stable machine-readable errors — [test: validation test]
- [ ] Source PDF hash and R2 object key are persisted — [observable: database row plus R2 object]
- [ ] Repeating upload with the same idempotency key does not create duplicate document records — [test: idempotency integration test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 3: Recipients And Parallel Sending Via Resend

**User stories**: 3, 6, 13, 14, 18, 19, 20

### What to build

Add recipient management for draft envelopes, parallel send behavior, expiring signer tokens, invitation emails through Resend, and manual resend.

### Assumptions carried in

- Phase 1 and 2 are complete.
- Resend configuration is available in the target environment.

### Out of scope for this phase

- Signer UI completion, decline/comments, field placement, and final PDF generation.
- Automatic reminders.

### Acceptance criteria

- [ ] API can add up to 10 recipients with valid name/email fields — [test: recipient API test]
- [ ] Recipient count above 10 and invalid emails are rejected with stable errors — [test: validation test]
- [ ] Sending a ready envelope creates active tokens for all recipients in parallel and records `sent_by` identity — [test: integration test]
- [ ] Invitation email send records are persisted for each recipient — [observable: database rows]
- [ ] Manual resend creates a new email send record without duplicating recipients — [test: resend integration test]
- [ ] Expired tokens cannot be used and return an expired-token error — [test: time-controlled token test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 4: Shared Field Model And Visual/API Placement

**User stories**: 4, 5, 18, 19, 20

### What to build

Add signature/date field placement using one shared coordinate model. Internal users can place fields visually on PDF pages, and agents can create the same fields through JSON.

### Assumptions carried in

- Envelopes can hold a source PDF.
- Recipients exist before fields are assigned.

### Out of scope for this phase

- Text, checkbox, initials, autofill, templates, signer completion, and final PDF rendering.

### Acceptance criteria

- [ ] API can create signature and date fields with page/x/y/width/height and recipient assignment — [test: field API test]
- [ ] Visual editor can create and persist the same field records — [test: UI integration test]
- [ ] Invalid field types, page numbers, geometry, and recipient IDs return machine-readable errors with valid field types listed — [test: validation test]
- [ ] Fields cannot be changed after an envelope is sent unless the envelope returns to draft through an explicit supported action — [test: state guard test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 5: Magic-Link Signing, Decline, And Comments

**User stories**: 7, 8, 9, 10, 11, 12, 13

### What to build

Build the no-account signer experience. External recipients open a magic link, review assigned signature/date fields, type a signature, complete signing, or decline with a reason/comment. Internal users and agents can observe status changes.

### Assumptions carried in

- Envelopes, documents, recipients, tokens, and fields are implemented.
- Tokens expire according to the Phase 3 model.

### Out of scope for this phase

- Completed PDF generation and audit summary page.
- Delegation and signer accounts.

### Acceptance criteria

- [ ] Signer can open a valid magic link without internal login and only access their assigned envelope view — [test: signer access integration test]
- [ ] Signer can type a signature and complete required signature/date fields — [test: signer completion test]
- [ ] Completing one recipient updates recipient status while envelope remains sent until all required recipients complete — [test: status transition test]
- [ ] Signer can decline with a reason and optional comment, causing envelope declined status — [test: decline flow test]
- [ ] Comments and signer actions append immutable audit events — [observable: audit event rows]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 6: PDF Finalization And Audit Summary

**User stories**: 12, 15, 16, 18

### What to build

When all required recipients complete, generate a flattened completed PDF with typed signatures and dates embedded, append an audit summary page derived from immutable audit events, store the final artifact in R2, and expose status/download through the lifecycle API.

### Assumptions carried in

- All signing events and field values are persisted before finalization.
- R2 storage and source PDF retrieval are reliable for launch scale.

### Out of scope for this phase

- Advanced evidence packages, certified signing, webhooks, and automatic reminders.

### Acceptance criteria

- [ ] Completing all required recipients triggers completed envelope status and final PDF generation — [test: end-to-end integration test]
- [ ] Final PDF in R2 includes flattened typed signatures and date values at the saved coordinates — [test: PDF content/visual regression or deterministic PDF assertion]
- [ ] Final PDF includes an appended audit summary page generated from immutable audit events — [test: PDF/audit summary assertion]
- [ ] API status indicates final PDF availability and download endpoint returns the completed artifact — [test: lifecycle API test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

---

## Phase 7: End-To-End Agent And Human Smoke Path

**User stories**: 1-20

### What to build

Tighten the whole workflow into a repeatable smoke path for both human UI preparation and agent/API preparation. Document the lifecycle contract enough that an agent can operate without guessing.

### Assumptions carried in

- Phases 1-6 are complete.
- No new product capabilities are added in this phase.

### Out of scope for this phase

- Webhooks, templates, advanced auth roles, additional field types, and in-app AI assistant.

### Acceptance criteria

- [ ] Agent-style API smoke test creates, uploads, adds recipients/fields, sends, polls, signs via test helper, and downloads final PDF — [test or runnable command]
- [ ] Human UI smoke test covers upload, field placement, send, signer completion, and final PDF availability — [test: browser/UI integration test]
- [ ] API documentation or OpenAPI-like contract lists lifecycle endpoints, schemas, idempotency keys, and error codes — [observable: documentation artifact]
- [ ] All PRD validation strategy items are mapped to tests, observable artifacts, or commands — [observable: validation checklist]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]
