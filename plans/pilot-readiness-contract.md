# Pilot Readiness Contract

Issue #21 hardens the no-account signing pilot for humans and future agents. This artifact is the canonical lifecycle contract, smoke-runbook, UI state evidence map, and PRD validation map.

Owner signoff gate: pending until the owner completes the pilot-readiness walkthrough and approves closing #21.

## Agent API Contract

All lifecycle endpoints are under `/api`. Success responses use `{ "data": ... }`. Known failures use `{ "error": { "code": string, "message": string, ... } }`; validation and state errors include recovery metadata such as `fields`, `validValues`, `validFieldTypes`, `allowedActions`, `limit`, `limitBytes`, `scope`, `resetAt`, or `verificationUrl` when applicable.

Stable primitives:

- Envelope statuses: `awaiting_verification`, `draft`, `sent`, `changes_requested`, `completed`, `declined`, `expired`, `deleted`.
- Recipient statuses: `pending`, `sent`, `completed`, `declined`.
- Field types: `signature`, `date`.
- Signature profile kinds: `drawn`, `typed`.
- Envelope lifecycle action request values: `send`, `cancel`, `expire`, `delete`.
- Idempotency header: `Idempotency-Key`; the implementation also accepts lowercase `idempotency-key`.
- Deterministic test-time header: `x-now`.

## Endpoint Contract

| Endpoint | Request schema | Success `data` schema | Auth and retry contract | Main error codes |
| --- | --- | --- | --- | --- |
| `POST /api/envelopes/sender-start` | `SenderStartRequest`: `{ name, email, turnstileToken }` | `SenderStartResponse`: `{ envelopeId, status: "awaiting_verification", sender, allowedActions, verification: { email, expiresAt, fallbackUrl } }` | Public with Turnstile. Accepts `Idempotency-Key` for safe retries. | `INVALID_SENDER_START`, `TURNSTILE_FAILED`, `RATE_LIMITED` |
| `GET /api/envelopes/sender-verifications/{token}` | Path token; optional `x-now`. | `SenderVerificationResponse`: `{ envelopeId, status: "draft", senderSessionToken, sender, allowedActions, verifiedAt }` | Public magic link. Repeated valid opens return a verified sender session for the envelope. | `SENDER_VERIFICATION_NOT_FOUND`, `EXPIRED_SENDER_VERIFICATION` |
| `POST /api/envelopes` | Header `x-internal-user-id`; no body. | `EnvelopeResponse`: `{ id, status, createdBy, createdAt }` | Internal/dev sender boundary. Accepts `Idempotency-Key`. | `UNAUTHORIZED` |
| `POST /api/envelopes/{id}/source-pdf` | Body is PDF bytes with `content-type: application/pdf`. | `SourceDocumentResponse`: `{ id, envelopeId, r2Key, version, sha256, byteSize, contentType, uploadedBy, uploadedAt }` | Requires `x-internal-user-id` or verified `x-sender-session-token`. Accepts `Idempotency-Key`; revision is allowed only from `changes_requested`. | `UNAUTHORIZED`, `INVALID_SOURCE_PDF`, `SOURCE_PDF_TOO_LARGE`, `DUPLICATE_SOURCE_PDF`, `ENVELOPE_NOT_DRAFT` |
| `POST /api/envelopes/{id}/recipients` | `AddRecipientsRequest`: `{ recipients: [{ name, email }] }`, 1-10 entries. | `RecipientResponse[]`: `{ id, envelopeId, name, email, status, createdAt }[]` | Requires `x-internal-user-id`. Retrying after success should reconcile from state instead of duplicating blindly. | `UNAUTHORIZED`, `INVALID_RECIPIENTS` |
| `POST /api/envelopes/{id}/signature-profiles` | `SignatureProfileCreateRequest`: drawn `{ kind: "drawn", label, svgPath, selected? }` or typed `{ kind: "typed", label, typedText, typedFont?, selected? }`. | `SignatureProfileResponse`: `{ id, envelopeId, createdBy, kind, label, svgPath, typedText, typedFont, selected, createdAt }` | Requires `x-internal-user-id`. Retry is state-safe because profiles are envelope-scoped and selected explicitly. | `UNAUTHORIZED`, `INVALID_SIGNATURE_PROFILE` |
| `POST /api/envelopes/{id}/fields` | `AddFieldsRequest`: `{ fields: [{ recipientId, type, page, x, y, width, height }] }`. | `EnvelopeFieldResponse[]`: `{ id, envelopeId, recipientId, type, page, x, y, width, height, createdAt }[]` | Requires `x-internal-user-id`; only valid while `draft`. | `UNAUTHORIZED`, `INVALID_FIELDS`, `ENVELOPE_NOT_DRAFT` |
| `POST /api/envelopes/{id}/fields/defaults` | `DefaultFieldPlacementRequest`: `{ recipientIds, page? }`, 1-10 recipient IDs. | `EnvelopeFieldResponse[]` with bottom-right signature/date placements. | Requires `x-internal-user-id`; same field-state contract as explicit placement. | `UNAUTHORIZED`, `INVALID_DEFAULT_FIELDS` |
| `POST /api/envelopes/{id}/actions` | `EnvelopeActionRequest`: `{ action: "send" | "cancel" | "expire" | "delete" }`. | Send returns `SendEnvelopeResult`; controls return `{ envelopeId, status, allowedActions }`. | Requires `x-internal-user-id`. Repeating after success is recoverable through status and `allowedActions`; invalid repeats return state errors. | `UNAUTHORIZED`, `INVALID_ACTION`, `ENVELOPE_ACTION_BLOCKED` |
| `POST /api/envelopes/{id}/recipients/{recipientId}/resend` | Path envelope and recipient IDs. | `ResendInvitationResult`: `{ recipientId, email, emailSendCount }` | Requires `x-internal-user-id`; creates a fresh invitation record without duplicating recipients. | `UNAUTHORIZED` |
| `GET /api/envelopes/{id}/status` | Path envelope ID. | `{ envelopeId, status, finalPdfAvailable, allowedActions }` | Public polling surface for pilot tests; no mutation. | N/A for known lifecycle errors |
| `GET /api/envelopes/{id}/retention` | Header `x-internal-user-id`; optional `x-now`. | `{ envelopeId, status, retentionEligibleAt, retentionEligible }` | Sender/internal read. | `UNAUTHORIZED` |
| `GET /api/envelopes/{id}/final-pdf` | Query `senderSessionToken` or header `x-sender-session-token`. | PDF response with `content-type: application/pdf`. | Requires verified sender process link; no mutation. | `FINAL_PDF_FORBIDDEN`, `FINAL_PDF_NOT_FOUND` |
| `GET /api/signing/verifications/{token}` | Path token; optional `x-now`. | `{ envelopeId, recipientId, status: "verified", signingLink: { token, url }, verifiedAt }` | Public partner magic link. | `PARTNER_VERIFICATION_NOT_FOUND`, `EXPIRED_PARTNER_VERIFICATION` |
| `GET /api/signing/{token}` | Path signing token; optional `x-now`. | `SignerSession`: `{ envelopeId, recipientId, sourceDocument: { version, contentType, downloadUrl }, fields }` | Requires verified, unexpired partner token. | `TOKEN_NOT_FOUND`, `ENVELOPE_DELETED`, `ENVELOPE_EXPIRED`, `EXPIRED_TOKEN`, `PARTNER_VERIFICATION_REQUIRED` |
| `GET /api/signing/{token}/source-pdf` | Path signing token; optional `x-now`. | PDF response with `content-type: application/pdf`. | Same access checks as signer session. | `SOURCE_PDF_NOT_FOUND` plus signing access errors |
| `POST /api/signing/{token}/complete` | `CompleteSigningRequest`: `{ signatureName, date }` where date is `YYYY-MM-DD`. | `CompleteSigningResult`: `{ envelopeId, recipientId, recipientStatus: "completed", envelopeStatus }` | Verified partner token; blocked while `changes_requested`, `expired`, or `deleted`. | `INVALID_SIGNING_COMPLETION`, `SIGNING_BLOCKED` plus signing access errors |
| `POST /api/signing/{token}/change-request` | `ChangeRequestSigningRequest`: `{ comment }`. | `ChangeRequestSigningResult`: `{ envelopeId, recipientId, recipientStatus: "sent", envelopeStatus: "changes_requested", allowedActions }` | Verified partner token; retry after success is recoverable through `changes_requested` status. | `INVALID_CHANGE_REQUEST`, `SIGNING_BLOCKED` plus signing access errors |
| `POST /api/signing/{token}/decline` | `DeclineSigningRequest`: `{ reason, comment? }`. | `DeclineSigningResult`: `{ envelopeId, recipientId, recipientStatus: "declined", envelopeStatus: "declined" }` | Verified partner token; terminal state blocks further signing. | `INVALID_SIGNING_DECLINE` plus signing access errors |
| `GET /api/signing/{token}/final-pdf` | Path signing token; optional `x-now`. | PDF response with `content-type: application/pdf`. | Verified partner process link; unavailable until finalization. | `FINAL_PDF_NOT_FOUND` plus signing access errors |

## Statuses And Allowed Actions

| Status | Meaning | Allowed actions |
| --- | --- | --- |
| `awaiting_verification` | Sender start succeeded; sender email has not been verified. | `verify_sender_email` |
| `draft` | Sender may upload/revise the source PDF, recipients, fields, and send. | `upload_source_pdf`, `add_recipients`, `add_fields`, `send` |
| `sent` | Partner invitation and signing token are active. | `view_signing_status`, `resend_invitation`, `cancel`, `expire`, `delete` |
| `changes_requested` | Partner asked for changes; completion is blocked until revision and resend. | `upload_revised_source_pdf`, `cancel`, `expire`, `delete` |
| `completed` | Final PDF is available. | `download_final_pdf`, `delete` |
| `declined` | Partner declined; no pilot recovery action is exposed. | None |
| `expired` | Envelope or signing link is no longer usable. | `delete` |
| `deleted` | Sender deleted/revoked document access. | None |

## Idempotency And Retry Safety

Use `Idempotency-Key` on these mutating endpoints when an agent may retry after a timeout:

- `POST /api/envelopes/sender-start`
- `POST /api/envelopes`
- `POST /api/envelopes/{id}/source-pdf`

Other mutating operations are retry-safe through explicit state checks:

- `POST /api/envelopes/{id}/actions` returns stable state or `allowedActions` when an action is no longer legal.
- `POST /api/envelopes/{id}/recipients/{recipientId}/resend` creates a new invitation send record without duplicating recipients.
- `POST /api/signing/{token}/complete`, `change-request`, and `decline` are guarded by token verification and envelope status; invalid retries return machine-readable errors.
- Agents should always poll `GET /api/envelopes/{id}/status` after an uncertain mutation before attempting the next action.

## Error Code Catalog

| Code | Meaning | Recovery hint |
| --- | --- | --- |
| `UNAUTHORIZED` | Required sender/internal header is missing. | Add the required process token/header. |
| `INVALID_SENDER_START` | Sender start body is malformed. | Send `name`, `email`, and `turnstileToken`. |
| `TURNSTILE_FAILED` | Public sender start abuse check failed. | Retry only with a fresh valid Turnstile token. |
| `RATE_LIMITED` | IP or email rate limit was hit. | Wait until `resetAt`; do not hammer retries. |
| `SENDER_VERIFICATION_NOT_FOUND` | Sender magic link token is unknown. | Restart sender verification. |
| `EXPIRED_SENDER_VERIFICATION` | Sender verification token expired. | Restart sender verification. |
| `INVALID_ACTION` | Envelope action value is not one of `send`, `cancel`, `expire`, `delete`. | Use `validValues`. |
| `ENVELOPE_ACTION_BLOCKED` | Action is not legal in the current status. | Use returned `allowedActions`. |
| `INVALID_SOURCE_PDF` | Upload was not a valid PDF. | Upload `application/pdf` bytes beginning with a PDF header. |
| `SOURCE_PDF_TOO_LARGE` | Source PDF exceeds the 10 MB pilot limit. | Compress or split outside the pilot. |
| `DUPLICATE_SOURCE_PDF` | Draft already has a source PDF. | Continue preparation, or use revision only after `changes_requested`. |
| `ENVELOPE_NOT_DRAFT` | A draft-only operation was attempted in another status. | Poll status and follow `allowedActions`. |
| `INVALID_RECIPIENTS` | Recipient array is missing, invalid, or over limit. | Send 1-10 valid `{ name, email }` entries. |
| `INVALID_SIGNATURE_PROFILE` | Drawn/typed signature profile body is invalid. | Use valid `drawn` or `typed` shape. |
| `INVALID_FIELDS` | Field recipient, type, page, or geometry is invalid. | Use valid recipient IDs and `signature`/`date`. |
| `INVALID_DEFAULT_FIELDS` | Default placement recipient list is invalid. | Send 1-10 recipient IDs. |
| `PARTNER_VERIFICATION_NOT_FOUND` | Partner verification token is unknown. | Resend invitation or use latest fallback link. |
| `EXPIRED_PARTNER_VERIFICATION` | Partner verification token expired. | Resend invitation. |
| `TOKEN_NOT_FOUND` | Signing token is unknown. | Use latest verified signing link. |
| `PARTNER_VERIFICATION_REQUIRED` | Partner has not opened the verification link. | Open returned `verificationUrl`. |
| `EXPIRED_TOKEN` | Signing token expired by time. | Resend invitation if envelope is still active. |
| `ENVELOPE_EXPIRED` | Envelope has been expired/canceled. | Sender may delete; signer cannot proceed. |
| `ENVELOPE_DELETED` | Sender deleted/revoked document access. | Stop signer flow; no PDF should render. |
| `SOURCE_PDF_NOT_FOUND` | Source object is unavailable. | Sender should re-upload or operator should inspect storage. |
| `INVALID_SIGNING_COMPLETION` | Signature/date completion body is invalid. | Send non-empty `signatureName` and `YYYY-MM-DD` date. |
| `INVALID_CHANGE_REQUEST` | Change request comment is missing. | Send a non-empty comment. |
| `INVALID_SIGNING_DECLINE` | Decline reason is missing. | Send a non-empty reason. |
| `SIGNING_BLOCKED` | Signing action is blocked by current envelope status. | Poll status and follow `allowedActions`. |
| `FINAL_PDF_FORBIDDEN` | Sender final-PDF download lacks verified sender process link. | Add a valid sender session token. |
| `FINAL_PDF_NOT_FOUND` | Final PDF is not generated or storage object is unavailable. | Poll status until `finalPdfAvailable` is true, then retry. |

## Agent Smoke Command

Run this command for the agent/API smoke:

```bash
pnpm test src/hono/api/sender-start.test.ts src/hono/api/source-pdf-upload.test.ts src/hono/api/envelope-fields.test.ts src/hono/api/partner-verification.test.ts src/hono/api/lifecycle-smoke.test.ts src/hono/api/pdf-finalization.test.ts
```

Coverage by that command:

- Creates a no-account sender start and verifies the sender magic link.
- Uploads one valid PDF and verifies invalid/duplicate/oversized upload errors.
- Prepares explicit fields and default bottom-right fields.
- Sends the envelope and verifies partner access.
- Signs, polls status, handles change request, revision, resend, completion, and final PDF download.
- Asserts final PDF data includes signature/date values, certificate text, checksum/hash, and process-link access controls.

## Human Browser Smoke Checklist

Run with `TURNSTILE_TEST_BYPASS=true pnpm dev`, then capture the browser URL and screenshots for the owner walkthrough.

1. Open `/`; start an envelope with sender name/email; confirm loading/submitting state, any validation error, and the verification fallback link.
2. Open the sender verification fallback link; record the returned `envelopeId` and `senderSessionToken`.
3. Open `/source-pdf-upload?envelopeId=<envelopeId>&senderSessionToken=<senderSessionToken>`; upload a real PDF under 10 MB; verify success metadata and a bad-file validation error.
4. Open `/envelope-fields`; create a review envelope, save a drawn or typed signature, and place signature/date fields for sender and partner.
5. Open `/manual-signing-smoke`; run setup; confirm upload, recipient creation, field preparation, send, and partner verification fallback link.
6. Open the partner verification link, then `/signing/<token>`; verify the source PDF preview, assigned fields, empty-state behavior if no fields exist, and expired/deleted messages from test links when available.
7. From the signer page, request changes with a comment; confirm the changes-requested state blocks completion and directs the sender to revise.
8. Re-upload a revised PDF through `/source-pdf-upload`, prepare fields again, resend, verify partner again, complete signing, and poll until `Final PDF is available`.
9. Download the final PDF from the signer or sender process link and verify the browser receives `application/pdf`.

## UI State Coverage

| UI state | Evidence |
| --- | --- |
| Loading | `src/components/signing/signer-page.test.tsx` covers `Loading signing session`; start/upload forms also expose submitting button states. |
| Empty | `src/components/signing/signer-page.test.tsx` covers `No assigned fields` with a clear next action. |
| Validation error | `src/components/sender/start-envelope-page.test.tsx`, `src/components/sender/source-pdf-upload-panel.test.tsx`, and `src/components/sender/signature-profile-panel.test.tsx` cover actionable errors near the relevant action. |
| Expired | `src/components/signing/signer-page.test.tsx` and `src/hono/api/partner-verification.test.ts` cover expired signing-link states without signing controls. |
| Changes requested | `src/components/signing/signer-page.test.tsx`, `src/hono/api/change-request.test.ts`, and `src/hono/api/lifecycle-smoke.test.ts` cover request-comment submission, disabled completion, and `changes_requested` allowed actions. |
| Completed | `src/components/signing/manual-smoke-page.test.tsx`, `src/hono/api/pdf-finalization.test.ts`, and `src/hono/api/lifecycle-smoke.test.ts` cover final PDF availability and download links. |
| Deleted | `src/components/signing/signer-page.test.tsx` and `src/hono/api/envelope-controls.test.ts` cover deleted-document messaging with no PDF/signing controls. |

## PRD Validation Evidence Map

| # | Validation item | Evidence |
| --- | --- | --- |
| 1 | No-account sender start | `src/hono/api/sender-start.test.ts`; `src/components/sender/start-envelope-page.test.tsx` |
| 2 | Sender email verification | `src/hono/api/sender-start.test.ts` |
| 3 | PDF upload | `src/hono/api/source-pdf-upload.test.ts`; `src/hono/api/envelopes.test.ts` |
| 4 | Upload validation UX | `src/components/sender/source-pdf-upload-panel.test.tsx` |
| 5 | Drawn signature | `src/components/sender/signature-profile-panel.test.tsx`; `src/hono/api/signature-profiles.test.ts` |
| 6 | Typed signature generation | `src/components/sender/signature-profile-panel.test.tsx`; `src/hono/api/signature-profiles.test.ts` |
| 7 | Field placement | `src/components/envelopes/field-editor.test.tsx`; `src/hono/api/envelope-fields.test.ts` |
| 8 | Send envelope | `src/hono/api/partner-verification.test.ts`; `src/hono/api/envelope-recipients.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 9 | Partner email verification | `src/hono/api/partner-verification.test.ts` |
| 10 | Partner PDF review | `src/components/signing/signer-page.test.tsx`; `src/hono/api/signing-flow.test.ts` |
| 11 | Partner signing | `src/components/signing/signer-page.test.tsx`; `src/hono/api/signing-flow.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 12 | Change request | `src/components/signing/signer-page.test.tsx`; `src/hono/api/change-request.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 13 | Changes-requested state | `src/hono/api/change-request.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 14 | Revised upload | `src/hono/api/source-pdf-upload.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 15 | Field clearing on revision | `src/hono/api/source-pdf-upload.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 16 | Status visibility | `src/hono/api/sender-start.test.ts`; `src/hono/api/lifecycle-smoke.test.ts`; `src/hono/api/pdf-finalization.test.ts`; `src/hono/api/envelope-controls.test.ts` |
| 17 | Seven-day expiry | `src/hono/api/partner-verification.test.ts`; `src/hono/api/envelope-recipients.test.ts` |
| 18 | Manual cancel/expire | `src/hono/api/envelope-controls.test.ts` |
| 19 | Manual delete | `src/hono/api/envelope-controls.test.ts`; browser smoke screenshot artifact |
| 20 | Deleted recipient message | `src/components/signing/signer-page.test.tsx`; `src/hono/api/envelope-controls.test.ts` |
| 21 | Flattened signatures/dates | `src/hono/api/pdf-finalization.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 22 | Audit certificate/checksum | `src/hono/api/pdf-finalization.test.ts` |
| 23 | Email notifications | `src/hono/api/sender-start.test.ts`; `src/hono/api/partner-verification.test.ts`; `src/hono/api/change-request.test.ts`; `src/hono/api/pdf-finalization.test.ts`; `src/hono/api/envelope-controls.test.ts` |
| 24 | Email fallback | `src/hono/api/sender-start.test.ts`; `src/hono/api/partner-verification.test.ts`; `src/hono/api/pdf-finalization.test.ts` |
| 25 | Audit events | `src/hono/api/sender-start.test.ts`; `src/hono/api/source-pdf-upload.test.ts`; `src/hono/api/partner-verification.test.ts`; `src/hono/api/change-request.test.ts`; `src/hono/api/pdf-finalization.test.ts`; `src/hono/api/envelope-controls.test.ts` |
| 26 | Structured logs/errors | Structured JSON error assertions across API tests; runtime logs remain observable through Worker/dev-server output during HITL smoke. |
| 27 | Turnstile/rate limits | `src/hono/api/sender-start.test.ts` |
| 28 | Retention eligibility | `src/hono/api/envelope-controls.test.ts` |
| 29 | Stable lifecycle API | `src/hono/api/lifecycle-contract.test.ts`; `src/hono/api/lifecycle-smoke.test.ts` |
| 30 | Default field placement | `src/hono/api/envelope-fields.test.ts` |
| 31 | Idempotency | `src/hono/api/sender-start.test.ts`; `src/hono/api/envelopes.test.ts`; `src/hono/api/source-pdf-upload.test.ts` |
| 32 | Machine-readable errors | `src/hono/api/lifecycle-contract.test.ts`; endpoint-specific validation tests listed above |
