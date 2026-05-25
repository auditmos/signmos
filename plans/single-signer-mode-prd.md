# PRD: Single-Signer Mode And Document History

## Problem Statement

Users sometimes need to sign a PDF by themselves, without inviting a partner signer. The current product is centered on a two-person envelope flow, which makes a simple "upload a PDF and sign it myself" task feel heavier than necessary.

The product should support a default one-person signing mode while preserving the existing no-account, email-verified envelope model. A returning user should also be able to confirm their email and see recent documents connected to that email, including self-signed documents and partner-signing documents.

## Solution

Add a default single-signer mode to the existing signing product. On the landing page, users choose between "Only me" and "Me and another signer"; "Only me" is selected by default. The initiating user enters name and email, confirms the email link, uploads one PDF under the existing size limit, previews the document, signs required signature/date fields that are automatically placed at the bottom-right of the last PDF page, and then downloads the completed signed document from a detail page.

The system continues to use the existing envelope lifecycle and email-link authorization model. A single-signer document is represented as an envelope with one recipient: the initiating user. There is no separate self-signing domain model.

The app also remembers reusable typed and drawn signature content by normalized lowercase email. After a user confirms email ownership, signing pre-fills the previously saved signature preference/content and shows a 30-day history table of documents involving that email. History includes completed, in-progress, and draft envelopes, can be filtered by document state, labels documents as self-signed or signed with a partner, and exposes safe actions such as resume, download completed documents, and creator-only cancel/delete.

## User Stories

1. As a landing-page visitor, I want "Only me" to be the default signing mode, so that the fastest self-sign path is obvious.
2. As a landing-page visitor, I want to switch between "Only me" and "Me and another signer", so that I can choose the right workflow before starting.
3. As a self-signer, I want to enter my name and email before upload, so that the system can identify me without an account.
4. As a self-signer, I want to confirm my email through the existing email-link mechanism before upload, so that saved signatures and documents are only exposed after email ownership is confirmed.
5. As a self-signer, I want to upload one PDF under the current upload limit, so that I can sign a normal document without learning a new flow.
6. As a self-signer, I want clear upload validation, so that unsupported, missing, or oversized files are rejected with actionable feedback.
7. As a self-signer, I want to preview the uploaded PDF before signing, so that I know I am signing the intended document.
8. As a self-signer, I want required signature and date fields automatically placed at the bottom-right of the last PDF page, so that I can sign without manually placing fields from scratch.
9. As a self-signer, I want to use existing field adjustment controls if they can be reused safely, so that I can correct placement without adding a separate editor.
10. As a self-signer, I want the app to remember whether I prefer drawn or typed signatures, so that repeat signing starts with my preferred method.
11. As a self-signer, I want the app to remember reusable typed and drawn signature content, so that repeat signing can prefill my signature.
12. As a returning signer, I want saved signatures to appear only after email confirmation, so that someone who only knows my email cannot use my saved signature.
13. As a returning signer, I want saved signature content to prefill automatically when I sign, so that repeat signing takes fewer steps.
14. As a returning signer, I want newly submitted signature content to update my saved signature, so that the system remembers my latest preference.
15. As a self-signer, I want the app to complete the envelope internally after I sign, so that I do not have to perform a separate visible send step.
16. As a self-signer, I want a detail/status page after signing, so that I can download the completed signed PDF from a clear place.
17. As a signer, I want a secure emailed link to the detail/status page after completion, so that I can return to the signed document later.
18. As an involved signer, I want possession of my secure document link to be enough to open the detail/status page, so that I do not have to re-confirm email every time I use that link.
19. As a confirmed user, I want to see a 30-day history of documents involving my email, so that I can find recent work without an account.
20. As a confirmed user, I want the history window based on creation date, so that the list has predictable inclusion rules.
21. As a confirmed user, I want history to include completed, in-progress, and draft envelopes, so that I can resume unfinished work.
22. As a confirmed user, I want a data-table status filter, so that I can narrow history by state.
23. As a confirmed user, I want each history row labeled as self-signed or signed with a partner, so that I understand the document type at a glance.
24. As a confirmed user, I want to download completed documents from history or their detail pages, so that completed artifacts are easy to retrieve.
25. As a confirmed user, I want to resume in-progress and draft envelopes from history, so that interrupted signing flows are recoverable.
26. As a document creator, I want to cancel or delete my own draft/in-progress envelopes from history, so that I can clean up work I started.
27. As a partner signer, I do not want to be able to cancel or delete someone else's envelope, so that creator control remains clear.
28. As a two-signer initiator, I want the existing partner-signing flow to continue working after the mode selector is added, so that "Me and another signer" remains the current envelope workflow.
29. As an operator, I want single-signer mode to reuse the existing audit/lifecycle records, so that the new mode has parity with current signing evidence without a new audit system.
30. As an implementer, I want user identity keyed by normalized lowercase email for this feature, so that v1 does not require password accounts or a new account table.

## Implementation Decisions

- **Signing mode selector**: the landing page uses a simple radio or segmented control with "Only me" selected by default and "Me and another signer" as the second option.
- **Envelope model**: single-signer mode is a one-recipient envelope. The initiating user is the sole recipient.
- **Two-signer meaning**: "Me and another signer" means the initiating user plus one partner signer, preserving the existing flow unless current implementation details require minor adaptation.
- **Email verification**: initiating users must confirm email before PDF upload. Reuse the existing confirmation mechanism.
- **Upload constraints**: keep the existing single-PDF and 10 MB limit.
- **Self-sign sequence**: email confirmation -> PDF upload -> preview/sign -> completed detail page/download. No visible send step appears in single-signer mode.
- **Default fields**: single-signer mode automatically creates required signature and date fields at the bottom-right of the last PDF page.
- **Field editability**: reuse existing field placement/review controls if they fit the self-sign flow. Do not create a separate field editor solely for v1 unless code inspection shows it is necessary.
- **Signature memory**: store reusable typed and drawn signature content, plus preference, keyed by normalized lowercase email.
- **Signature access control**: saved signatures are revealed and usable only after email confirmation for that session.
- **Signature update behavior**: no saved-signature management UI in v1. The saved content/preference is reused and updated when the confirmed user signs again.
- **History access control**: confirmed users can see documents involving their normalized email. History is not shown before email confirmation.
- **History range**: history shows records created in the last 30 days. This is a UI/query window only and does not alter underlying retention or deletion policies.
- **History contents**: include completed, in-progress, and draft envelopes. Label each row as self-signed or signed with a partner.
- **History actions**: completed rows can lead to detail/download. Draft/in-progress rows can resume. Only the creator can cancel/delete.
- **Document links**: completion emails should link to a detail/status page, not directly trigger a download. Secure signer-specific links can open the detail/download page without an additional email confirmation step.
- **Email delivery**: reuse the current email/send-record/fallback-link behavior. Do not add a new email provider as part of this feature.
- **Audit evidence**: reuse the current audit and lifecycle evidence model. Do not add new legal/audit evidence solely for single-signer mode.

### Major Functional Components

- **Mode-Aware Start**: owns the landing selector, start form branching, and routing into one-signer or two-signer flows.
- **Verified Email Session**: owns email-link confirmation and the post-confirmation gate for upload, saved signatures, and history.
- **Single-Signer Envelope Orchestrator**: adapts the existing envelope lifecycle to one-recipient self-signing with no visible send step.
- **Default Field Placement**: creates bottom-right last-page signature/date fields through the same field model used by the current product.
- **Signature Profile Store**: persists and retrieves typed/drawn reusable signature content by normalized lowercase email.
- **Document History Query**: returns 30-day envelope rows involving the confirmed email, with mode labels, status, and allowed row actions.
- **Document Detail Access**: renders document status and download actions behind signer-specific secure links.
- **Email Link Delivery**: creates or sends verification/completion links using the current delivery abstraction.

## Assumptions

- The existing envelope domain can represent a one-recipient envelope without a parallel self-signing data model.
- The existing email confirmation mechanism can be reused before PDF upload.
- The existing PDF upload validation and storage path already enforces the 10 MB limit or can be reused with minimal changes.
- The existing field model can represent default signature/date fields for the initiating user.
- The existing final PDF generation works when there is only one required signer.
- Lowercased email identity is sufficient for v1; no full account table is required.
- Saved signature content is acceptable to store once email ownership is confirmed, using the same security posture as existing signature profiles.
- Current email behavior may be real email, persisted send records, returned fallback links, or a combination; this PRD does not require adding a new provider.
- History is a convenience/account-like view, not a legal retention mechanism.
- Current retention rules continue to govern underlying records and files.
- The product remains a no-account signing product; password login and account settings are not required for this feature.

## Tradeoffs Considered

- **Separate self-signing model** — rejected because reusing one-recipient envelopes keeps lifecycle, audit, finalization, and access behavior simpler.
- **Upload before email confirmation** — rejected because saved signatures and history should only be available after confirmed email ownership.
- **Manual field placement from scratch** — rejected for the default path because self-signing should be faster than the current preparation workflow.
- **Suggestion-only default signature position** — rejected because the user asked for a default place to put the signature and the one-signer path should require fewer steps.
- **Signature preference only** — rejected because returning users should get actual reusable typed/drawn signature content.
- **Showing saved signatures before confirmation** — rejected because knowing an email address should not reveal or use saved signature content.
- **Direct email download link** — rejected because a detail/status page is clearer and can also support in-progress/history behavior.
- **Deleting records after 30 days** — rejected because the 30-day requirement is a history display window, not a retention policy.
- **Partner-controlled cancellation/deletion** — rejected because only the creator should control envelope cancellation/deletion.
- **New email provider integration** — rejected because the feature should reuse the current delivery abstraction and avoid expanding infrastructure scope.
- **Saved-signature management UI** — rejected for v1 because reuse/update-on-signing is enough for the requested workflow.

## Validation Strategy

1. **Default mode**: UI test loads the landing page and asserts "Only me" is selected by default.
2. **Mode switching**: UI test switches between "Only me" and "Me and another signer" and verifies the chosen mode is submitted or routed correctly.
3. **Self-signer identity input**: form test submits name/email and validates missing or malformed input errors.
4. **Email confirmation gate**: integration test confirms upload, saved signatures, and history are inaccessible before the email link is verified and accessible after verification.
5. **PDF upload**: API/UI test uploads one valid PDF under 10 MB in single-signer mode.
6. **Upload validation**: validation tests reject invalid type, missing file, and over-10 MB files with stable user-facing and JSON errors.
7. **Preview**: browser/component test verifies the uploaded PDF preview renders before signing controls are completed.
8. **Automatic fields**: integration test creates a self-sign envelope and asserts required signature/date fields exist on the last page with bottom-right default geometry.
9. **Field adjustment reuse**: if field controls are exposed, browser test verifies existing adjustment controls persist changed field geometry; if not exposed, acceptance evidence records that v1 uses fixed default fields.
10. **Signature preference**: persistence test saves drawn vs typed preference by normalized lowercase email and retrieves it after confirmation.
11. **Reusable signature content**: persistence test saves and retrieves typed and drawn signature content for the confirmed email.
12. **Signature privacy gate**: access-control test verifies saved signature content is not returned before email confirmation.
13. **Signature prefill**: signing UI test verifies a confirmed returning signer sees the previously saved preference/content prefilled.
14. **Signature update**: signing flow test changes the signature content/preference and verifies the saved profile updates after completion.
15. **No visible send step**: browser test completes single-signer upload/signing without requiring a manual send action.
16. **Detail page**: integration/browser test redirects or links to a detail/status page after signing and shows completed status plus download action.
17. **Completion link delivery**: email/send-record test verifies a signer-specific detail-page link is created after completion.
18. **Secure link access**: access test opens the signer-specific detail link and downloads without additional email confirmation, while invalid/deleted/unauthorized tokens are rejected.
19. **History query**: integration test verifies confirmed email history includes envelopes involving that email and excludes unrelated emails.
20. **30-day creation window**: time-controlled test verifies history includes envelopes created within 30 days and excludes older rows based on creation date.
21. **History states**: history test verifies completed, in-progress, and draft envelopes can appear.
22. **State filter**: UI test filters the history data table by state and verifies rows update correctly.
23. **Mode labels**: UI/data test verifies history rows are labeled self-signed or signed with a partner.
24. **Completed download**: browser/API test verifies completed rows expose a download/detail action and return the final PDF.
25. **Resume actions**: browser test verifies draft and in-progress rows expose resume actions leading to the correct next step.
26. **Creator cancel/delete**: authorization test verifies creators can cancel/delete eligible draft or in-progress envelopes.
27. **Partner cancellation denial**: authorization test verifies partner signers cannot cancel/delete another creator's envelope.
28. **Two-signer continuity**: regression test verifies "Me and another signer" still follows the existing two-person flow and collects partner details where the current flow expects them.
29. **Audit parity**: lifecycle test verifies self-signing appends the same category of audit/lifecycle records as equivalent current signing actions.
30. **Normalized email identity**: unit/integration test verifies mixed-case email variants resolve to the same signature profile and history identity.

Done for this PRD means each implemented slice has tests or observable evidence for its mapped user stories, and code changes are not declared ready until `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass or every skipped check is explicitly reported with the acceptance criteria left unverified.

## Out of Scope

- Password accounts, account settings, teams, organizations, or role-based access control.
- A separate self-signing database model or parallel lifecycle outside envelopes.
- More than one source PDF per envelope.
- Uploading custom signature image files.
- A saved-signature management screen for deleting or manually choosing defaults.
- Changing the product's underlying retention/deletion policy.
- Adding a new email provider or requiring real email delivery if the current environment only records/returns links.
- New legal/audit evidence beyond parity with the existing envelope flow.
- Partner-initiated cancellation/deletion of creator-owned envelopes.
- Multi-partner signing, reusable templates, reminders, webhooks, billing, or analytics.

## Further Notes

This PRD intentionally frames self-signing as a smaller mode of the existing product. Implementation should start by inspecting the current start route, email verification flow, envelope state model, field/default-placement APIs, signature profile persistence, final PDF behavior, and signing/detail routes. If any of those modules cannot support a one-recipient envelope cleanly, the implementation plan should surface that as a scoped architecture decision before coding.
