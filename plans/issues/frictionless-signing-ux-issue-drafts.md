# Dispatch Drafts: Frictionless End-User Signing UX And Security

> Parent PRD: `plans/frictionless-signing-ux-prd.md`
>
> Carved plan: `plans/frictionless-signing-ux.md`
>
> GitHub issues created on 2026-05-22.

## Created Issues

- Parent PRD: #22 - https://github.com/auditmos/signmos/issues/22
- #23 - Secure sender start confirmation
- #24 - Sender-first signing and email routing
- #25 - Partner signature choice with optional reuse
- #26 - Fixed signing date and simple change request
- #27 - Completed-document view and final link delivery

## Proposed Breakdown

1. **#23 Secure sender start confirmation** - Type: AFK - Blocked by: None - User stories: 1, 2, 3, 4
2. **#24 Sender-first signing and email routing** - Type: AFK - Blocked by: None - User stories: 5, 6, 7
3. **#25 Partner signature choice with optional reuse** - Type: HITL - Blocked by: #24 - User stories: 8, 9, 10
4. **#26 Fixed signing date and simple change request** - Type: AFK - Blocked by: #24 - User stories: 11, 12, 13
5. **#27 Completed-document view and final link delivery** - Type: HITL - Blocked by: #25, #26 - User stories: 14, 15, 16, 17

## GitHub Creation Notes

Issues were created from the bodies below and mirrored as individual files in `plans/issues/frictionless-signing-ux/`.

---

## Issue 1: Secure Sender Start Confirmation

### Parent PRD

#22

### Type

AFK

### What to build

Make sender start safe and abuse-resistant. The public name/email form requires Turnstile before creating verification, the normal confirmation screen only tells the sender to check email, and verification fallback links remain available only to developer/test surfaces.

### Assumptions

- Sender start and verification email/fallback behavior already exist or are being built by the pilot foundation.
- Turnstile can be called through an adapter or boundary that tests can bypass explicitly.

### Out of scope for this issue

- Do not add partner signing, sender signing, final PDF access, signature preference storage, or completion routing.
- Do not redesign rate limits beyond behavior already present in the pilot.

### Acceptance criteria

- [ ] Normal sender confirmation renders sent-email confirmation and no raw verification URL or open-link action - [test: sender-start UI/component test]
- [ ] Verification fallback URL is available only through test/developer debug/log surface, not normal UI - [test: API/dev-mode boundary test]
- [ ] Sender start rejects missing or invalid Turnstile before creating verification/email send records - [test: API integration test]
- [ ] Automated tests can use an explicit Turnstile bypass without requiring network calls - [test: Turnstile adapter test]
- [ ] Manual browser dev path is documented to use Turnstile development keys from vars/env - [observable: README or runbook note]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

### How to verify

1. Run sender-start UI/component tests.
2. Run sender-start API tests for Turnstile accepted/rejected paths.
3. Confirm test/dev fallback links are not rendered in the normal confirmation UI.
4. Confirm the manual browser runbook or README names the dev Turnstile vars/env path.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

None - can start immediately.

### User stories addressed

- User stories 1, 2, 3, 4

---

## Issue 2: Sender-First Signing And Email Routing

### Parent PRD

#22

### Type

AFK

### What to build

Change the prepared-envelope flow so the sender completes their own signature during setup. Sending the envelope creates a partner invitation only, not a sender self-sign email. Sender notification emails are created when the partner signs or requests changes.

### Assumptions

- The system can represent sender and partner as distinct signing parties.
- Existing email send records can be asserted in tests without sending real email.

### Out of scope for this issue

- Do not add new partner signature UI modes.
- Do not add full request-changes thread or sender replies.
- Do not add final completed-document view.

### Acceptance criteria

- [ ] Sender setup persists sender signature completion before partner send - [test: lifecycle integration test]
- [ ] Sending a prepared envelope creates a partner signing email/send record and no sender self-sign invitation - [test: email routing integration test]
- [ ] Sender receives notification email/send record when partner signs - [test: partner completion notification test]
- [ ] Sender receives notification email/send record when partner requests changes - [test: request-changes notification test]
- [ ] Envelope status and allowed actions reflect that partner is the only pending signer after send - [test: status contract test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

### How to verify

1. Run lifecycle integration tests for sender setup and partner-only pending signing.
2. Run email send-record tests for partner invitation, partner-signed sender notification, and request-changes sender notification.
3. Inspect test email send records and assert no sender self-sign invitation exists.
4. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

None - can start immediately.

### User stories addressed

- User stories 5, 6, 7

---

## Issue 3: Partner Signature Choice With Optional Reuse

### Parent PRD

#22

### Type

HITL - requires owner visual review of the partner typed/drawn signature UI and remember-signature consent before merge.

### What to build

Give the partner the same signature choice as the sender: typed or drawn. Add explicit consent to remember signature preference/content globally by email. If remembered, typed signatures store typed text and drawn signatures store drawn data/image for future use.

### Assumptions

- Sender-first signing and email routing are complete.
- Reusable signature content can be keyed by normalized email without accounts.

### Out of scope for this issue

- Do not add account/profile management, signature deletion UI, uploaded signature files, or admin management.
- Do not change sender signature creation unless shared components need a narrow extension for partner reuse.

### Acceptance criteria

- [ ] Partner signing UI allows switching between typed and drawn signature modes - [test: signer UI/component test]
- [ ] Partner can complete signing with typed signature - [test: signing integration test]
- [ ] Partner can complete signing with drawn signature - [test: signing integration test]
- [ ] Remember option is explicit and unchecked state does not update global signature preference/content - [test: consent persistence test]
- [ ] Remembered typed signature stores preferred type and typed text by email - [test: signature preference persistence test]
- [ ] Remembered drawn signature stores preferred type and drawn data/image by email - [test: signature preference persistence test]
- [ ] Existing saved preference is loaded as the partner default on a future envelope for the same email - [test: reuse integration test]
- [ ] Signature-choice UI passes owner visual review before merge - [HITL: owner visual review]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

### How to verify

1. Run signer UI/component tests for typed/drawn switching and remember-checkbox behavior.
2. Run signing integration tests for typed and drawn completion.
3. Run persistence tests for remembered and not-remembered signatures.
4. Run reuse test for a later envelope with the same partner email.
5. Complete owner visual review of the partner signature UI.
6. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #24

### User stories addressed

- User stories 8, 9, 10

---

## Issue 4: Fixed Signing Date And Simple Change Request

### Parent PRD

#22

### Type

AFK

### What to build

Remove signer date editing from the normal flow and set signing date from the current server/application date. Keep partner disagreement as a simple request-changes action with a required comment, visible to the sender and sent through notification email.

### Assumptions

- Sender-first signing and email routing are complete.
- Time can be controlled in tests through an existing header, fake clock, or injectable clock boundary.
- The product has or will keep a changes-requested lifecycle state.

### Out of scope for this issue

- Do not add full negotiation thread, sender replies, partner document editing, or admin/support date overrides.

### Acceptance criteria

- [ ] Signer UI does not render an editable signing-date picker/input - [test: signer UI/component test]
- [ ] Signing completion stores today's date from the controlled clock - [test: time-controlled signing test]
- [ ] Future submitted dates cannot be persisted from signer input - [test: API/domain validation test]
- [ ] Partner can request changes with a required comment instead of signing - [test: change-request integration test]
- [ ] Sender-facing status/API exposes the first request-changes comment - [test: sender status/API test]
- [ ] Sender receives a request-changes notification email/send record with the comment context - [test: email send-record test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

### How to verify

1. Run signer UI/component tests that assert no date picker/input is visible.
2. Run time-controlled signing tests and future-date rejection/ignore tests.
3. Run change-request integration tests with required comment validation.
4. Run sender status/API and email send-record tests for request-changes comment visibility and notification.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #24

### User stories addressed

- User stories 11, 12, 13

---

## Issue 5: Completed-Document View And Final Link Delivery

### Parent PRD

#22

### Type

HITL - requires owner visual review of the completed-document view before merge.

### What to build

Route fully signed envelopes to a dedicated completed-document view from any relevant signing/final link. The view shows final PDF download, party summary, signed dates, final status, and user-facing audit/history events. Completion emails go to both parties with link only, and final PDF download works for anyone with the final download token.

### Assumptions

- Partner signature choice with optional reuse is complete.
- Fixed signing date and simple change request behavior is complete.
- Final PDF generation/storage exists or is available from the pilot finalization work.
- Audit events include enough user-facing data to render completed-document history.

### Out of scope for this issue

- Do not add PDF email attachments, login-gated final download, admin-only security audit events, or advanced evidence packages.

### Acceptance criteria

- [ ] Fully signed signing/final links render or redirect to completed-document view - [test: route/API integration test]
- [ ] Completed view includes final PDF download, party summary, signed dates, final status, and user-facing audit/history events - [test: completed view component/API test]
- [ ] User-facing audit/history excludes technical security events from normal UI - [test: audit filtering test]
- [ ] Completion email/send records are created for both parties with completed-view/download link and no PDF attachment payload - [test: email payload test]
- [ ] Final PDF download succeeds with final download token and no signer-specific login/session - [test: final token download test]
- [ ] Completed-document UI passes owner visual review before merge - [HITL: owner visual review]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

### How to verify

1. Run route/API tests for completed-envelope link handling.
2. Run completed view component/API tests for download link, party summary, signed dates, status, and user-facing history.
3. Run audit filtering tests.
4. Run completion email payload tests and assert no PDF attachment.
5. Run final token download access tests.
6. Complete owner visual review of the completed-document view.
7. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

### Blocked by

- Blocked by #25
- Blocked by #26

### User stories addressed

- User stories 14, 15, 16, 17
