# Plan: Frictionless End-User Signing UX And Security

> Source PRD: `plans/frictionless-signing-ux-prd.md`
>
> GitHub PRD issue: #22 - https://github.com/auditmos/signmos/issues/22

## Architectural decisions

- **Architecture style**: keep the existing TanStack Start frontend with Hono API on Cloudflare Workers.
- **Identity model**: no password accounts; sender and partner remain email-link based.
- **Sender flow**: sender signs during setup before partner invitation.
- **Verification security**: normal UI does not expose verification links; developer-only fallback is allowed through debug/log/test surfaces.
- **Abuse controls**: Turnstile protects only public sender start in this pass; tests use an explicit bypass and manual dev uses Turnstile development keys from vars/env.
- **Data model**: keep envelope lifecycle state in the envelope domain; add or extend global signature preference keyed by email when implementation reaches signature reuse.
- **Email**: partner receives initial signing email; sender receives partner-signed and partner-requested-changes notifications; completion emails go to both parties with link only.
- **Final access**: final download uses a bearer final download token.
- **Audit/history**: completed-document UI shows user-facing document events only.

---

## Phase 1: Secure Sender Start Confirmation

**User stories**: 1, 2, 3, 4

### What to build

Make sender start safe and abuse-resistant. The public name/email form requires Turnstile before creating verification, the normal confirmation screen only tells the sender to check email, and verification fallback links remain available only to developer/test surfaces.

### Assumptions carried in

- Sender start and verification email/fallback behavior already exist or are being built by the pilot foundation.
- Turnstile can be called through an adapter or boundary that tests can bypass explicitly.

### Out of scope for this phase

- Partner signing, sender signing, final PDF access, signature preference storage, and completion routing.
- Rate-limit redesign beyond behavior already present in the pilot.

### Acceptance criteria

- [ ] Normal sender confirmation renders sent-email confirmation and no raw verification URL or open-link action - [test: sender-start UI/component test]
- [ ] Verification fallback URL is available only through test/developer debug/log surface, not normal UI - [test: API/dev-mode boundary test]
- [ ] Sender start rejects missing or invalid Turnstile before creating verification/email send records - [test: API integration test]
- [ ] Automated tests can use an explicit Turnstile bypass without requiring network calls - [test: Turnstile adapter test]
- [ ] Manual browser dev path is documented to use Turnstile development keys from vars/env - [observable: README or runbook note]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

---

## Phase 2: Sender-First Signing And Email Routing

**User stories**: 5, 6, 7

### What to build

Change the prepared-envelope flow so the sender completes their own signature during setup. Sending the envelope creates a partner invitation only, not a sender self-sign email. Sender notification emails are created when the partner signs or requests changes.

### Assumptions carried in

- The system can represent sender and partner as distinct signing parties.
- Existing email send records can be asserted in tests without sending real email.

### Out of scope for this phase

- New partner signature UI modes.
- Full request-changes thread.
- Final completed-document view.

### Acceptance criteria

- [ ] Sender setup persists sender signature completion before partner send - [test: lifecycle integration test]
- [ ] Sending a prepared envelope creates a partner signing email/send record and no sender self-sign invitation - [test: email routing integration test]
- [ ] Sender receives notification email/send record when partner signs - [test: partner completion notification test]
- [ ] Sender receives notification email/send record when partner requests changes - [test: request-changes notification test]
- [ ] Envelope status and allowed actions reflect that partner is the only pending signer after send - [test: status contract test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

---

## Phase 3: Partner Signature Choice With Optional Reuse

**User stories**: 8, 9, 10

### What to build

Give the partner the same signature choice as the sender: typed or drawn. Add explicit consent to remember signature preference/content globally by email. If remembered, typed signatures store typed text and drawn signatures store drawn data/image for future use.

### Assumptions carried in

- Phase 2 establishes the partner as the active signer after send.
- Reusable signature content can be keyed by normalized email without accounts.

### Out of scope for this phase

- Account/profile management, signature deletion UI, uploaded signature files, and admin management.
- Changing sender signature creation unless shared components need a narrow extension for partner reuse.

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

---

## Phase 4: Fixed Signing Date And Simple Change Request

**User stories**: 11, 12, 13

### What to build

Remove signer date editing from the normal flow and set signing date from the current server/application date. Keep partner disagreement as a simple request-changes action with a required comment, visible to the sender and sent through notification email.

### Assumptions carried in

- Time can be controlled in tests through an existing header, fake clock, or injectable clock boundary.
- The product already has or will keep a changes-requested lifecycle state.

### Out of scope for this phase

- Full negotiation thread, sender replies, partner document editing, and admin/support date overrides.

### Acceptance criteria

- [ ] Signer UI does not render an editable signing-date picker/input - [test: signer UI/component test]
- [ ] Signing completion stores today's date from the controlled clock - [test: time-controlled signing test]
- [ ] Future submitted dates cannot be persisted from signer input - [test: API/domain validation test]
- [ ] Partner can request changes with a required comment instead of signing - [test: change-request integration test]
- [ ] Sender-facing status/API exposes the first request-changes comment - [test: sender status/API test]
- [ ] Sender receives a request-changes notification email/send record with the comment context - [test: email send-record test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

---

## Phase 5: Completed-Document View And Final Link Delivery

**User stories**: 14, 15, 16, 17

### What to build

Route fully signed envelopes to a dedicated completed-document view from any relevant signing/final link. The view shows final PDF download, party summary, signed dates, final status, and user-facing audit/history events. Completion emails go to both parties with link only, and final PDF download works for anyone with the final download token.

### Assumptions carried in

- Final PDF generation/storage exists or is available from the pilot finalization work.
- Audit events include enough user-facing data to render completed-document history.

### Out of scope for this phase

- PDF email attachments, login-gated final download, admin-only security audit events, and advanced evidence packages.

### Acceptance criteria

- [ ] Fully signed signing/final links render or redirect to completed-document view - [test: route/API integration test]
- [ ] Completed view includes final PDF download, party summary, signed dates, final status, and user-facing audit/history events - [test: completed view component/API test]
- [ ] User-facing audit/history excludes technical security events from normal UI - [test: audit filtering test]
- [ ] Completion email/send records are created for both parties with completed-view/download link and no PDF attachment payload - [test: email payload test]
- [ ] Final PDF download succeeds with final download token and no signer-specific login/session - [test: final token download test]
- [ ] Completed-document UI passes owner visual review before merge - [HITL: owner visual review]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]
