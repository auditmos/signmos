# PRD: No-Account E-Signature Pilot

## Problem Statement

People need a simple way to sign a PDF with a partner without creating accounts or learning a heavyweight e-signature product. The current product has useful lifecycle pieces, but the flow still feels fragmented and not ready for external customer pilots with real documents.

The first pilot must make the core workflow understandable and trustworthy: upload a PDF, verify identity by email, define a signature, place signature/date fields, send a partner link, allow the partner to sign or request changes, and give both parties access to the completed signed PDF. It must also establish foundations for future agentic workflows: stable structured APIs, explicit state transitions, idempotent mutations, audit events, and errors that agents can recover from without guessing.

## Solution

Build a production-pilot signing workflow on the existing TanStack Start, Hono, Cloudflare Workers, Neon Postgres, Drizzle, R2, and Resend architecture.

The v1 pilot uses no password accounts. A sender starts with name/email, verifies ownership through an email magic link, uploads a PDF, prepares fields for both parties, and sends the envelope. The partner verifies by email before signing. Either party can complete assigned fields, while the partner can request changes instead of signing. A change request pauses the envelope, lets the sender upload a revised PDF, clears previous fields, and supports resending.

When every required party signs, the system generates a completed PDF with flattened signatures/dates plus an appended audit certificate page containing signing events and a document checksum/hash. Both parties access the final PDF through their verified process links and receive email notifications.

The legal posture is basic e-signature intent for general business documents that may contain PII. The pilot does not claim certified trust-service signing, regulated-industry compliance, or enterprise-grade identity verification.

## User Stories

1. As a sender, I want to start an envelope with only my name and email, so that I do not need to create an account.
2. As a sender, I want to verify my email through a magic link before sending, so that the system can identify me without passwords.
3. As a sender, I want to upload one PDF, so that it becomes the document to sign.
4. As a sender, I want clear upload validation, so that I understand when a file is not a usable PDF or is too large.
5. As a sender, I want to define my signature by drawing it, so that the signature represents my hand-drawn intent.
6. As a sender, I want to type my name and generate a signature-like mark, so that I can create a professional signature without drawing.
7. As a sender, I want to place signature and date fields on the PDF for both parties, so that each person knows where to sign.
8. As a sender, I want to send the prepared envelope to my partner, so that they can review and act on it.
9. As a partner, I want to verify my email before signing, so that my signature is attributable to a confirmed email address.
10. As a partner, I want to review the PDF before signing, so that I can confirm the content is acceptable.
11. As a partner, I want to complete assigned signature/date fields, so that I can sign the document.
12. As a partner, I want to request changes with a comment instead of signing, so that the sender can fix the PDF content.
13. As a sender, I want change requests to put the envelope into a clear changes-requested state, so that I know the current document should not be completed.
14. As a sender, I want to upload a revised PDF after a change request, so that the same envelope flow can continue with corrected content.
15. As a sender, I want revised PDF upload to clear existing fields, so that old coordinates or values are not accidentally applied to changed content.
16. As either party, I want to see clear status such as draft, awaiting verification, sent, changes requested, completed, declined, expired, or deleted, so that I understand what can happen next.
17. As a sender, I want signing links to expire after 7 days, so that old links cannot be used indefinitely.
18. As a sender, I want to manually cancel or expire an envelope, so that I can stop an in-flight signing process.
19. As a sender, I want to delete an envelope and remove stored PDFs before retention expiry, so that I control sensitive uploaded documents.
20. As a partner, I want a deleted-envelope message if the sender deletes the document, so that I know why my link no longer shows the PDF.
21. As either party, I want the completed PDF to contain all signatures and dates, so that the signed artifact is self-contained.
22. As either party, I want the completed PDF to include an audit/certificate page with a checksum/hash, so that the document has a simple tamper-evidence control.
23. As either party, I want email notifications for verification, sending, change requests, completion, expiry, and deletion where relevant, so that I do not have to poll manually.
24. As an operator, I want email sending to use Resend when configured and expose fallback links in development/recovery flows, so that pilot operations do not block on local email delivery.
25. As an operator, I want audit events stored in the database for key lifecycle actions, so that I can answer who did what and when.
26. As an operator, I want structured server logs/errors, so that pilot issues can be diagnosed without full observability tooling.
27. As an operator, I want Cloudflare Turnstile and rate limits by IP and email, so that no-account flows are protected from basic abuse.
28. As an operator, I want uploaded and completed documents retained for 90 days after completion or expiry unless manually deleted earlier, so that retention is predictable.
29. As an API client, I want stable JSON lifecycle endpoints, so that future agents can create, upload, prepare, send, and monitor envelopes.
30. As an API client, I want a default field-placement mode, so that an agent can place common signature/date fields without brittle PDF coordinate manipulation.
31. As an API client, I want mutating operations to be idempotent, so that retries do not duplicate envelopes, recipients, fields, sends, or revision actions.
32. As an API client, I want machine-readable errors that enumerate valid states/actions, so that agents can recover safely.

## Implementation Decisions

- **Architecture style**: harden the existing TanStack Start frontend and Hono API on Cloudflare Workers.
- **Runtime and storage**: Cloudflare Workers remains the production runtime, Neon Postgres/Drizzle owns relational state, and Cloudflare R2 stores source and completed PDF artifacts.
- **Identity model**: no password accounts in v1. Sender and partner identity is email-based and verified through magic links.
- **Sender authorization**: the verified sender session is the authority for envelope preparation, send, cancel/expire, revision upload, and deletion.
- **Partner authorization**: the partner verifies email before viewing/signing and can only access the assigned envelope experience.
- **Email provider**: Resend is the transactional email provider for pilot; local/dev can expose links as fallback.
- **Signature capture**: support drawn signatures and typed-name generated signature marks; no uploaded signature images in v1.
- **Routing**: sender prepares fields for both parties before sending. The sender is not required to sign before partner review.
- **Change requests**: partner comments can move an envelope to changes requested. Revised PDF upload clears all existing fields and requires placement again.
- **Status model**: user-facing states include draft, awaiting verification, sent, changes requested, completed, declined, expired, and deleted.
- **Expiration**: signing links/envelopes expire after 7 days by default, with manual cancel/expire available to the sender.
- **Retention**: PDFs and envelope data are retained for 90 days after completion or expiry unless manually deleted earlier by the sender.
- **Final artifact**: completed PDFs include flattened signatures/dates plus an appended audit/certificate page with checksum/hash and event summary.
- **Audit model**: immutable audit events are persisted for upload, verification, send, view, sign, comment/change request, revision, cancel, expire, delete, and final PDF download.
- **Abuse controls**: Cloudflare Turnstile protects public no-account initiation; rate limits apply by IP and email.
- **Agent foundation**: APIs should be structured, idempotent, explicit about allowed transitions, and future-ready for customer API keys and a standalone agent-friendly CLI.
- **Public API keys**: design for future customer-facing API keys, but do not expose API-key auth in the v1 pilot.
- **Billing**: no payment or billing in v1.

## Deep Modules

- **Identity And Verification**: owns sender/partner email verification, magic-link sessions, expiry, and access checks behind a small verified-identity interface.
- **Envelope Lifecycle**: owns allowed state transitions for draft, awaiting verification, sent, changes requested, completed, declined, expired, and deleted.
- **Document Storage**: owns R2 object keys, upload/download constraints, source/final PDF metadata, deletion, retention eligibility, and hashes.
- **Signature Profile**: owns drawn signatures, typed-name generated signature marks, and the renderable signature asset used by PDF finalization.
- **Field Placement**: owns signer-assigned PDF coordinates and default placement rules shared by UI and APIs.
- **Email Delivery**: owns Resend integration, template selection, send records, and fallback link exposure.
- **Audit Log**: appends immutable domain events and provides inputs for the final audit/certificate page.
- **PDF Finalizer**: consumes source PDF, fields, signature values, dates, document hash, and audit events to produce the completed artifact.
- **Agent API Contract**: owns stable JSON schemas, idempotency behavior, machine-readable error shape, and future API-key compatibility.
- **Abuse And Retention Controls**: owns Turnstile verification, rate limits, expiry jobs/actions, manual deletion, and retention eligibility.

## Assumptions

- The first external pilot targets real users and real general-business PDFs, not regulated HIPAA/PCI workflows.
- Documents may contain PII, so access control, auditability, deletion, and retention matter even without formal compliance claims.
- Pilot scale fits the existing architecture: low document volume, one PDF per envelope, and simple two-party signing as the primary workflow.
- Users will accept email magic links instead of passwords when the flow is visibly simpler.
- Requiring email verification for both parties is acceptable despite the extra click because signature attribution matters.
- Resend is approved for transactional pilot email.
- Cloudflare Turnstile is available for the public initiation surface.
- A 7-day expiry and 90-day retention default are acceptable for pilot users.
- Sender-controlled deletion is enough for v1; partner deletion requests can be handled operationally outside the product.
- Public API keys and a standalone agent CLI are future work, but v1 API choices must not conflict with them.
- A moderate professional UI is sufficient for the pilot; a single polished guided flow is not required yet.

## Tradeoffs Considered

- **Password accounts** — rejected for v1 because simplicity and no-account initiation are the main product promise.
- **No partner verification** — rejected because possession of a link alone is weaker attribution for real documents.
- **Uploaded signature images** — rejected because cropping, transparency, storage, and abuse handling add scope without being necessary for the pilot.
- **Sender must sign before sending** — rejected because the partner may need to request document changes before anyone signs.
- **Preserving fields across revised PDFs** — rejected because revised content can shift and make old coordinates misleading.
- **Separate final-download links** — rejected because the same verified process links are simpler and easier to reason about.
- **Manual-only email sending** — rejected because verification and notifications are core to the pilot; fallback links remain for dev/recovery.
- **Full public API keys in v1** — rejected because they expand the security surface before the human pilot workflow is ready.
- **Single guided flow before pilot** — rejected because separate professional screens are acceptable if the workflow is understandable.
- **Indefinite retention** — rejected because no-account PII workflows need predictable deletion boundaries.
- **Full observability platform** — rejected for v1 because audit events plus structured logs are sufficient for the first pilot.
- **Billing** — rejected because payment would distract from validating the signing workflow.

## Validation Strategy

1. **No-account sender start**: automated API/UI test starts an envelope with name/email and no password account.
2. **Sender email verification**: time-controlled test verifies a sender magic link activates the sender session and rejects expired/invalid links.
3. **PDF upload**: upload tests accept one valid PDF and reject invalid type, missing content, and over-limit payloads with stable errors.
4. **Upload validation UX**: UI test shows actionable upload error states without raw server traces.
5. **Drawn signature**: component test captures a drawn signature and persists a renderable representation.
6. **Typed signature generation**: component test generates a signature-like mark from typed text and persists the selected mark.
7. **Field placement**: UI/API tests persist signature/date fields with page, geometry, recipient assignment, and field type.
8. **Send envelope**: integration test sends a prepared envelope after sender verification and records send/audit/email events.
9. **Partner email verification**: integration test requires partner email verification before signing access is granted.
10. **Partner PDF review**: signer UI test renders the PDF and assigned fields for the verified partner.
11. **Partner signing**: signer flow test completes required signature/date fields and records attribution.
12. **Change request**: signer flow test submits a comment/change request and moves the envelope to changes requested.
13. **Changes-requested state**: API/status test exposes changes requested and blocks completion until revision/resend.
14. **Revised upload**: integration test uploads a revised PDF in the same envelope flow after changes requested.
15. **Field clearing on revision**: test verifies revised PDF upload clears old fields and requires new placement.
16. **Status visibility**: API/UI tests expose draft, awaiting verification, sent, changes requested, completed, declined, expired, and deleted states with allowed next actions.
17. **Seven-day expiry**: time-controlled test verifies links/envelopes expire after 7 days and signing is blocked.
18. **Manual cancel/expire**: API/UI test lets sender cancel/expire and blocks further signing.
19. **Manual delete**: API/UI/storage test lets sender delete an envelope and removes or revokes PDF access.
20. **Deleted recipient message**: signer-link test shows "This document was deleted by the sender" with no PDF access.
21. **Flattened signatures/dates**: PDF finalization test asserts the final artifact contains visible signature/date values at saved fields.
22. **Audit certificate/checksum**: PDF test asserts an appended audit/certificate page includes event summary and checksum/hash.
23. **Email notifications**: email integration tests verify Resend payloads or fallback send records for verification, send, change request, completion, expiry, and deletion.
24. **Email fallback**: dev/test mode returns or records recovery links without requiring Resend network calls.
25. **Audit events**: database tests assert immutable audit rows for all required lifecycle events.
26. **Structured logs/errors**: API tests assert known failures return structured error JSON; log tests or observability hooks cover server-side error metadata.
27. **Turnstile/rate limits**: tests verify Turnstile validation hooks and IP/email rate-limit rejection paths on public initiation and email-triggering actions.
28. **Retention eligibility**: time-controlled test marks completed/expired documents eligible for deletion 90 days after terminal state.
29. **Stable lifecycle API**: contract tests cover create, upload, verify, prepare, send, status, change request, revise, complete, cancel, delete, and download flows.
30. **Default field placement**: API test creates default bottom-right signature/date fields without explicit coordinates.
31. **Idempotency**: retry tests confirm idempotency keys prevent duplicate side effects for mutating operations.
32. **Machine-readable errors**: validation tests assert errors include code, message, field/path where applicable, and valid values/allowed actions for state failures.

Done for the pilot means all acceptance tests for the implemented slices pass, `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass before declaring the implementation ready, and a manual browser smoke can complete upload -> verify sender -> prepare fields -> verify partner -> sign/request changes -> revise -> complete -> download final PDF.

## Out of Scope

- Password accounts, organizations, workspaces, and role-based access control.
- Public API keys and standalone agent CLI.
- Certified/trust-service signatures, qualified signatures, notarization, and regulated-data compliance guarantees.
- Uploaded signature image files.
- Multi-document envelopes, templates, reusable recipient groups, automatic reminders, webhooks, billing, and analytics.
- Partner-initiated deletion controls beyond loss of access after sender deletion.
- A single end-to-end polished guided wizard; separate professional screens are acceptable for the pilot.

## Further Notes

The first build window target is 4-6 weeks. The highest-risk gaps are the fragmented user flow, identity verification, real email delivery, audit/final PDF trust signals, deletion/retention controls, and agent-friendly API foundations.
