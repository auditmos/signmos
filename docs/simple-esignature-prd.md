# PRD: Simple E-Signature Workflow

## Problem Statement

The company needs a lightweight DocuSign-like workflow for sending PDFs to business partners for signature without adopting the legal and operational overhead of a certified e-signature platform. Internal users need to prepare documents, send signing links, track status, and retrieve a completed PDF with a clear audit summary. External partners need a no-account signing experience.

The product must also be friendly to AI agents and automation. Agents should be able to create envelopes, upload PDFs, add recipients and fields, send envelopes, poll status, and download final PDFs through stable REST/JSON endpoints.

## Solution

Build a company-initiated signing system with internal user accounts, external magic-link signing, PDF upload/storage in Cloudflare R2, metadata in the existing Neon Postgres/Drizzle stack, invitation emails through Resend, and a Hono REST API designed around stable JSON schemas.

The legal posture is "basic e-signature intent": the system captures signer intent, timestamps, IP/user-agent, document hashes, and immutable audit events, but it does not claim to be a certified trust-service product or a full legal evidence platform.

## User Stories

1. As an internal user, I want to create a draft envelope, so that I can prepare a document for partner signature.
2. As an internal user, I want to upload a source PDF under 10 MB, so that it can become the document to sign.
3. As an internal user, I want to add up to 10 external recipients by name and email, so that each partner receives a signing request.
4. As an internal user, I want to place signature and date fields visually on PDF pages, so that signers know exactly where to complete the document.
5. As an API client, I want to create the same signature and date fields using page coordinates, so that AI agents can prepare envelopes without browser interaction.
6. As an internal user, I want to send an envelope to all recipients in parallel, so that every signer can act as soon as the envelope is ready.
7. As an external recipient, I want to open a magic link without creating an account, so that I can review and sign quickly.
8. As an external recipient, I want to type my signature name, so that the system can render it into each required signature field.
9. As an external recipient, I want required date fields to be completed during signing, so that the final PDF records the signing date.
10. As an external recipient, I want to decline a signing request with a reason, so that the sender knows why the envelope did not complete.
11. As an external recipient, I want to leave a comment or message, so that I can communicate context or requested changes.
12. As an internal user, I want to see envelope status, so that I know whether the document is draft, sent, completed, declined, or expired.
13. As an internal user, I want signing links to expire, so that old requests cannot be used indefinitely.
14. As an internal user, I want to manually resend a signing invitation, so that I can follow up without creating a new envelope.
15. As an internal user, I want a completed flattened PDF after all required signers finish, so that I can store or share a single final artifact.
16. As an internal user, I want the completed PDF to include an appended audit summary page, so that signer actions are visible with the document.
17. As an internal user, I want every envelope to record who created and sent it, so that internal accountability is preserved.
18. As an API client, I want lifecycle endpoints for create, upload, add recipients, add fields, send, get status, and download final PDF, so that agents can operate the workflow end to end.
19. As an API client, I want stable JSON errors that enumerate valid statuses, field types, and allowed next actions, so that agents can recover without guessing.
20. As an API client, I want mutating endpoints to support idempotency keys, so that retries do not duplicate envelopes, recipients, fields, or sends.

## Implementation Decisions

- **Architecture style**: extend the existing TanStack Start frontend and Hono API on Cloudflare Workers.
- **Database**: use the existing Neon Postgres and Drizzle setup for envelope metadata, recipients, fields, signing events, idempotency records, and audit events.
- **Object storage**: use Cloudflare R2 for uploaded source PDFs and completed flattened PDFs.
- **Email**: use Resend for signing invitations and manual resends.
- **External signer access**: magic-link only; no partner accounts in v1.
- **Internal access**: internal company user accounts are required; the implementation should use the repo's auth foundation if present, or add a minimal internal auth slice before envelope work.
- **Routing**: parallel only; all recipients receive signing links when an envelope is sent.
- **Fields**: v1 supports only signature and date fields.
- **Signature capture**: typed signatures only.
- **Finalization**: after all required signers complete, generate a flattened PDF with visual signatures/dates and append an audit summary page.
- **Agent-friendly API**: REST/JSON lifecycle endpoints with stable IDs, validation schemas, idempotency on mutating operations, machine-readable errors, and bounded responses where listing is introduced.
- **Outward integrations**: no webhooks in v1; agents poll status.
- **Templates**: no reusable templates in v1.

## Deep Modules

- **Envelope Lifecycle**: exposes a narrow state-transition interface for draft, sent, completed, declined, and expired envelopes while hiding persistence and validation details.
- **Document Storage**: owns R2 object keys, upload/download constraints, source/final PDF metadata, and hashes.
- **Field Model**: owns signer-assigned PDF coordinates for signature/date fields and is shared by the visual editor and API.
- **Signer Access**: owns magic-link token creation, expiry, recipient session resolution, and resend behavior.
- **Audit Log**: appends immutable domain events and provides the source for the audit summary page.
- **PDF Finalizer**: consumes source PDF, field values, and audit events to produce the completed PDF artifact.
- **Agent API Contract**: owns lifecycle endpoint schemas, idempotency behavior, and machine-readable error shape.

## Assumptions

- Launch scale is light: PDFs under 10 MB, fewer than 10 recipients per envelope, and fewer than 100 envelopes per month.
- Business partners will tolerate magic-link signing without account creation or email-code verification.
- The company accepts "basic e-signature intent" and does not require certified trust-service signing, advanced identity verification, or regulated retention controls in v1.
- The existing Neon/Drizzle database setup remains the source of truth for relational metadata.
- Cloudflare R2 is available in the target deployment environment and can be bound to the Worker.
- Resend is approved for transactional email sending.
- Internal authentication either exists in the repo or can be added as a prerequisite slice without changing the product scope.
- Agents can poll for status; no webhook delivery is required for v1.
- Typed signatures are acceptable for the intended business-partner workflows.

## Tradeoffs Considered

- **Certified e-signature platform** — rejected for v1 because it adds legal/compliance overhead the company explicitly wants to avoid.
- **Partner accounts** — rejected because magic links are faster for business partners and reduce support burden.
- **Sequential routing** — rejected because parallel signing is sufficient for v1 and simpler to model.
- **Templates** — rejected because each document can be prepared from scratch at launch and template permissions/versioning would add complexity.
- **Drawn signatures** — rejected because typed signatures are simpler, more reliable across devices, and enough for the desired legal posture.
- **Webhooks** — rejected because polling is enough for the initial agent lifecycle API.
- **Text, checkbox, initials, and autofill fields** — rejected because signature/date fields cover the first workflow and keep PDF rendering smaller.
- **Database blob storage** — rejected because R2 is a better fit for larger PDF artifacts.
- **Full in-app AI assistant** — rejected because external-agent-friendly API operations are the v1 priority.

## Validation Strategy

1. **Create draft envelope**: automated API test creates a draft envelope for an authenticated internal user and verifies persisted creator identity.
2. **Upload source PDF**: automated API/storage test uploads a valid PDF under 10 MB, rejects non-PDF and over-limit files, persists R2 object metadata, and records a source document hash.
3. **Add recipients**: automated API test adds up to 10 recipients, rejects invalid emails, and rejects recipient counts above 10.
4. **Visual field placement**: UI test places signature/date fields on a PDF page and verifies saved page/x/y/width/height/recipient assignments.
5. **Coordinate/API field placement**: API test creates equivalent fields through JSON and verifies the same field model is persisted.
6. **Send parallel envelope**: integration test sends an envelope and verifies all recipients receive active signing tokens and invitation email send records.
7. **Magic-link signing access**: integration test opens a signer token without account login and resolves only the intended recipient/envelope.
8. **Typed signature capture**: signer flow test completes a signature field with typed name and persists the signature value and timestamp.
9. **Date field completion**: signer flow test completes date fields and verifies values are rendered into the final PDF.
10. **Decline with reason**: signer flow test declines with a reason and verifies envelope status and audit event.
11. **Signer comments**: signer flow test submits a comment and verifies it is visible to internal users and recorded in the audit log.
12. **Envelope status**: API test verifies valid status transitions and rejects invalid transitions with enumerated machine-readable errors.
13. **Expiring links**: time-controlled test verifies expired tokens cannot sign and return a stable expired-token error.
14. **Manual resend**: API/UI test resends an invitation and verifies a new email send record without duplicating recipients.
15. **Flattened completed PDF**: integration test completes all recipients and verifies a final PDF object exists in R2.
16. **Audit summary page**: PDF finalization test verifies the completed PDF includes an appended audit summary derived from immutable audit events.
17. **Internal accountability**: database/API test verifies created_by and sent_by identities are stored for each envelope lifecycle action.
18. **Lifecycle API**: contract tests cover create, upload, recipients, fields, send, status, and final PDF download endpoints.
19. **Machine-readable errors**: API tests verify validation errors include code, message, field/path where applicable, and valid values for enum failures.
20. **Idempotency**: API tests repeat mutating requests with the same idempotency key and verify no duplicate envelope, recipient, field, or send side effects.

Done means `pnpm types`, `pnpm test`, and `pnpm lint` pass, and the core happy path can be exercised from draft envelope to completed PDF through both UI and API-supported preparation paths.

## Out of Scope

- Certified/trust-service signing, qualified signatures, and advanced identity verification.
- Partner workspaces, partner accounts, or partner-initiated envelopes.
- Role-based internal permissions beyond authenticated internal users.
- Sequential routing, delegation, automatic reminders, and webhooks.
- Templates, conditional fields, text fields, checkbox fields, initials, and signer autofill.
- High-volume search, analytics, billing, tenant customization, or enterprise administration.
- Native in-app AI assistant.

## Further Notes

The repo currently shows Hono, Neon/Drizzle, and Cloudflare Worker foundations. Internal auth and R2 bindings were not visible during discovery inspection, so those should be treated as implementation prerequisites to confirm in the first phase.
