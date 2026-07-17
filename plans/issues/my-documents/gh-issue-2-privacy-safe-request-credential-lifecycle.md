## Parent PRD

#36

## Type

AFK — privacy, abuse, expiry, replay, delivery, and recovery outcomes are fully specified and agent-verifiable.

## What to build

Turn the completed-document tracer into the production-safe public access flow from PRD #36. Add validation, Turnstile, both rate-limit scopes, enumeration-safe accepted responses, no-send behavior for unmatched/deleted-only addresses, privacy-safe guidance, strict email normalization, idempotent submission, provider-aware replacement ordering, failed-delivery recording without retry, all link/session recovery states, sign-out, and credential/session security events.

The completed slice must be safe to expose publicly: response shape cannot reveal document existence, credentials cannot be replayed, automatic request retries cannot duplicate side effects, provider failure cannot revoke an older usable link, and every terminal access state has a clear recovery path.

## Assumptions

- #37 provides the hashed credential/session model, scanner-safe POST redemption, completed-document tracer, and history authorization boundary.
- Existing sender-start Turnstile, rate-limit persistence, and email-delivery boundaries can be adapted behind a history-specific operation.
- Email-provider acceptance is synchronous but does not guarantee inbox delivery.

## Out of scope for this issue

- Do not implement the full retained catalog, filenames, role-aware groups, search, filters, or pagination.
- Do not implement creator resume/controls or partner signing through the history session.
- Do not add queues, outboxes, automatic retries, operator retry commands, or delivery administration UI.
- Do not add accounts, analytics, alias linking, retention changes, or new compliance claims.

## Acceptance criteria

- [ ] Empty, whitespace-only, and malformed emails are rejected with accessible field errors before submission — [test: history-request form validation test]
- [ ] Missing/invalid Turnstile is rejected before matching or email work, and the explicit bypass remains test-only — [test: Turnstile integration/configuration test]
- [ ] For both normalized-email and IP scopes, requests 1-5 inside ten minutes are accepted, request 6 is rate-limited, and a request at or after reset is accepted — [test: deterministic dual-scope rate-limit test]
- [ ] Matching, unmatched, and deleted-only accepted requests return the same status/body and never expose match, count, or delivery state — [test: enumeration-safe response parity test]
- [ ] Unmatched and deleted-only accepted requests create no active credential and no email send attempt — [test: unmatched request persistence/email test]
- [ ] The accepted UI state provides spelling, spam, alternate-address, and 90-day retention guidance without implying a match — [test: privacy-safe accepted-state component test]
- [ ] Trimming/lowercasing unifies whitespace and mixed-case variants, while dot and plus-tag aliases remain distinct — [test: email normalization/alias-separation test]
- [ ] Repeating the same idempotency key causes one match evaluation, at most one send attempt, one activation, and no extra revocation — [test: history request idempotency integration test]
- [ ] A deliberate request with a fresh idempotency key creates a fresh pending credential — [test: deliberate replacement request test]
- [ ] Provider acceptance activates the fresh credential and revokes earlier unused credentials for that email in one consistent outcome — [test: accepted replacement ordering test]
- [ ] Provider failure records a failed attempt without a raw credential, leaves older unexpired links usable, returns the generic accepted response, and schedules no retry — [test: failed replacement delivery test; observable: failed delivery record without retry state]
- [ ] Unknown, consumed, expired, and revoked links render non-technical recovery states linked to a preselected "My documents" form — [test: link recovery-state tests]
- [ ] Expired sessions render request-new-link recovery rather than a generic unauthorized page — [test: expired-session recovery test]
- [ ] Sign-out requires same-origin/CSRF protection, revokes only the current server session, clears its cookie, and records revocation — [test: sign-out security integration test]
- [ ] Issuance, redemption, expiry observation, and revocation append safe security events with no raw credentials — [test: credential/session security-audit test]
- [ ] Normal responses, logs, audit rows, and UI expose raw history credentials only where required for the email/confirmation flow or restricted debug/test fallback — [test: credential-leak regression test]
- [ ] Request, confirmation, accepted, recovery, and sign-out states announce status/errors and preserve logical keyboard focus — [test: public access accessibility test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` exit successfully — [command: repository readiness commands]

## How to verify

1. Apply the generated development migration with `pnpm db:migrate:dev` if this issue adds or changes persistence.
2. Run `pnpm test` and confirm the Turnstile, rate-limit, response-parity, normalization, idempotency, replacement, provider-failure, recovery, sign-out, audit, and accessibility suites pass.
3. Exercise matching, unmatched, and deleted-only requests through the public endpoint and compare their accepted status and response bodies.
4. Inspect email-send and credential records to confirm unmatched requests create no send/active link and failed delivery creates no retry.
5. Redeem, consume, expire, revoke, and sign out sessions to verify every recovery state.
6. Inspect logs/audit/persistence and confirm no raw credential leakage.
7. Run `pnpm types`.
8. Run `pnpm lint`.
9. Run `pnpm build`.

## Blocked by

- Blocked by #37

## User stories addressed

- User stories 4-20
- User stories 44-45
- User story 47
