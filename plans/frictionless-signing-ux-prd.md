# PRD: Frictionless End-User Signing UX And Security

## Problem Statement

The no-account signing flow is close to usable, but several current behaviors create friction or expose security-sensitive shortcuts to end users. The sender verification screen can reveal the verification link, the public start form needs an abuse check, the sender can receive redundant signing email after already starting and signing the process, the partner signing page limits signature choice, signing dates can drift from the actual signing day, and completed envelopes need a clear final-document destination for both parties.

The goal is to make the human signing flow feel trustworthy and low-friction without expanding the product into accounts, full negotiation threads, or regulated signing claims.

## Solution

Tighten the existing no-account signing workflow around a sender-first flow:

- A sender enters name/email, passes Turnstile, receives a verification email, and sees only a confirmation in the normal UI.
- The sender signs during setup, prepares placeholders for both parties, and sends the envelope.
- Only the partner receives the initial signing email.
- The partner can choose typed or drawn signature, and can optionally remember that signature preference/content by email for future envelopes.
- Signing date is fixed to the current date at signing time and is not editable by signers.
- If the partner disagrees with the document, they can request changes with a comment. V1 stores and shows that first comment; threaded negotiation is deferred.
- When both parties have signed, any relevant signing/final link routes to a completed-document view with a final PDF download, party summary, signed dates, final status, and user-facing audit/history events.
- Both parties receive a completion email containing a link only. The PDF is not attached.
- Final download is available to anyone holding the final download token.

## User Stories

1. As a sender, I want the post-start confirmation screen to say that a verification link was sent, so that I do not see a sensitive verification URL in normal UI.
2. As a developer, I want verification fallback links available only through developer-only debug surfaces or logs, so that local testing remains possible without exposing links to end users.
3. As an operator, I want Cloudflare Turnstile required before sender verification is created, so that the public form is protected from basic abuse.
4. As a developer, I want automated tests to bypass Turnstile while manual browser development uses development Turnstile keys from vars/env, so that tests are stable and manual QA exercises the real integration.
5. As a sender, I want to sign during setup before sending to the partner, so that I do not receive a redundant signing email for a process I initiated.
6. As a partner, I want to receive the signing email after the sender has prepared and signed, so that I can review and act only when the envelope is ready for me.
7. As a sender, I want email notifications when the partner signs or requests changes, so that I know when the envelope moved forward or needs attention.
8. As a partner, I want to choose typed or drawn signature on the signing page, so that I can sign in my preferred way.
9. As a partner, I want the option to remember my signature preference and content by email, so that future signing is faster.
10. As a partner, I want remembered typed signatures to store the typed text and remembered drawn signatures to store the drawn data/image, so that reuse matches my chosen signing style.
11. As a signer, I want the signing date to be fixed to today's date, so that the date reflects the actual signing event and cannot be set in the future.
12. As a partner, I want an easy comment box to request changes instead of signing, so that I can explain what needs to change.
13. As a sender, I want to see the partner's request-changes comment and receive an email notification, so that I can decide what to do next.
14. As either party, I want any signing/final link for a fully signed envelope to open a completed-document view, so that I land on the correct state instead of a stale signing form.
15. As either party, I want the completed-document view to include the final PDF download, party summary, signed dates, final status, and user-facing audit/history events, so that I can understand what happened and retrieve the artifact.
16. As either party, I want a completion email with a link to the completed-document view/download and no PDF attachment, so that the final artifact is accessed through the product instead of email attachments.
17. As a recipient of a final download link, I want anyone holding the final download token to be able to download the signed PDF, so that sharing the final artifact is simple.

## Implementation Decisions

- **Verification link exposure**: the normal end-user confirmation UI must never render an "open verification link" action or raw verification URL.
- **Developer fallback**: local/developer access to verification links is allowed only through developer-only debug surfaces or logs.
- **Turnstile scope**: Turnstile is required only before creating the sender verification link on the public name/email landing form.
- **Turnstile test strategy**: automated tests use an explicit bypass. Manual browser development uses development Turnstile values from vars/env.
- **Sender-first signing**: the sender signs during setup before the partner invitation is sent.
- **Email routing**: the partner receives the initial signing email. The sender does not receive a signing email for their own already-completed signer step.
- **Sender notifications**: the sender receives email when the partner signs or requests changes.
- **Signature storage**: signature preference is global by email. If the user explicitly opts in, store preferred type and reusable content: typed text for typed signatures, drawn data/image for drawn signatures.
- **Consent**: reusable signature content is saved only when the signer explicitly selects a remember option.
- **Signing date**: signer-facing date is fixed to the current date and cannot be edited. Future dates are impossible because no date picker is presented.
- **Change requests**: v1 supports a first request-changes comment visible to the sender. Full negotiation threads and sender replies are out of scope.
- **Completion routing**: fully signed envelopes route to a dedicated completed-document view from signing/final links.
- **Final download access**: final PDF download uses a bearer final download token. Anyone with the token can download.
- **Completion email**: completion emails go to both parties and include a link only, not a PDF attachment.
- **User-facing audit**: completed-document history shows user-facing events only: created, sent, viewed, signed, requested changes/declined, completed.

## Assumptions

- The current product already has envelope lifecycle, signing links, send records, audit events, final PDF storage/download foundations, or active pilot issues that provide them.
- The sender can be represented as one signing party during setup before partner send.
- The partner email address is sufficient as the key for global signature preference in the no-account model.
- Storing reusable signature content is acceptable only with explicit consent and can be deleted or overwritten in later account/profile work.
- Development Turnstile keys are available through vars/env for manual browser testing.
- Automated tests can use an explicit Turnstile bypass without weakening production behavior.
- The first request-changes comment is enough for this UX pass. A full negotiation thread will be planned separately.
- Public bearer final download tokens are acceptable for this pilot despite being less restrictive than signer-specific access links.
- Completion email link delivery is enough; users do not need PDF attachments in email.

## Tradeoffs Considered

- **Showing verification links in the normal UI** - rejected because it turns an email-verification security control into a visible shortcut.
- **Hiding links only in production** - rejected because normal UI should behave like production even during manual browser testing.
- **Requiring Turnstile on every envelope action** - rejected because only the public initiation form is the abuse-prone unauthenticated surface in this pass.
- **Sending the initiator a signing email** - rejected because the initiator has already started and signed the process.
- **Typed-only partner signing** - rejected because partner signing should match the sender's drawn-or-typed choice flexibility.
- **Always saving signature content** - rejected because reusable signature content should require explicit consent.
- **Editable signing date** - rejected because the signing date should represent the actual signing event.
- **Full negotiation thread in v1** - rejected because the immediate need is a clear first request-changes comment and notification.
- **PDF email attachments** - rejected because link-only delivery keeps access and download behavior inside the product.
- **Signer-specific final download only** - rejected because the desired final artifact access model is anyone with the final download token.

## Validation Strategy

1. **Verification confirmation hides link**: UI/component test starts verification and asserts the normal confirmation shows sent-email copy and no raw link or open-link action.
2. **Developer-only fallback**: API/dev-mode test asserts fallback link is available only in a debug/log/test surface and not in the normal UI response rendered to users.
3. **Turnstile gate**: API integration tests assert sender start rejects missing/invalid Turnstile and accepts valid/dev Turnstile configuration.
4. **Turnstile test/dev split**: automated tests assert explicit bypass works only under test configuration; manual browser runbook documents dev keys from vars/env.
5. **Sender signs during setup**: integration test prepares an envelope with sender signature completed before partner send.
6. **Partner receives initial signing email**: email send-record test asserts partner invitation is created and sender self-sign invitation is not created.
7. **Sender partner-action notifications**: email send-record tests assert sender receives partner-signed and partner-requested-changes notifications.
8. **Partner typed/drawn choice**: signer UI/component test lets partner switch between typed and drawn signature modes before completion.
9. **Remember preference option**: signer UI/API test asserts signature profile is saved globally by email only when remember is selected.
10. **Stored content by type**: persistence tests assert remembered typed signatures store typed text and remembered drawn signatures store drawn data/image.
11. **Fixed signing date**: UI test asserts no signer date picker exists; API/domain test asserts signing date is current date and future submitted dates are ignored or rejected.
12. **Request changes comment**: signer flow test asserts partner can submit a required comment instead of signing.
13. **Sender sees request comment**: sender-facing status/API test and email send-record test assert the first request-changes comment is visible to sender and notification is sent.
14. **Completed routing**: route/API tests assert fully signed signing/final links render or redirect to the completed-document view.
15. **Completed view content**: component/API tests assert final PDF download, party summary, signed dates, final status, and user-facing audit/history events are present.
16. **Completion email link only**: email send-record test asserts both parties receive completion email with link and no PDF attachment payload.
17. **Final download token**: download access test asserts the signed PDF can be downloaded with the final token and without signer-specific session/login.

Done means the sliced implementation issues pass their own TDD acceptance criteria and the repo readiness commands pass before any implementation is called ready: `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Out of Scope

- Password accounts, login, organizations, roles, or profile management.
- Full request-changes negotiation threads, sender replies, or multi-message history.
- Partner editing document content directly.
- User-editable signing date, admin/support date overrides, or backdating.
- PDF attachments in completion emails.
- Stronger final-download auth than a bearer final download token.
- Certified/trust-service signing or regulated e-signature compliance claims.
- Public API keys, webhooks, billing, templates, and additional field types.

## Further Notes

This PRD intentionally amends the current pilot's earlier assumption that the sender might not sign before partner review. For this UX pass, the sender-first signing flow is the durable product decision.
