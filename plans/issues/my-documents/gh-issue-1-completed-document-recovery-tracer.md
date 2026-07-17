## Parent PRD

#36

## Type

AFK — the slice has no subjective checkpoint; an agent can verify every criterion through public-boundary tests, persisted credential/session records, and repository commands.

## What to build

Implement the first narrow end-to-end "My documents" recovery path from PRD #36. A visitor starts from an unselected three-card landing page, requests access for an email known to own a completed document, receives a metadata-free single-use link, confirms redemption with an intentional POST, receives a fixed eight-hour history session, sees the completed document, opens its details, and downloads the final PDF without exposing any existing bearer token.

This is a local/test tracer across UI, HTTP, email, persistence, identity, authorization, completed-document detail, and R2 download. Keep it from production exposure until the privacy and abuse controls in the next issue are implemented.

## Assumptions

- Existing completed-document artifacts, participant records, final PDF storage, and process-link behavior remain authoritative.
- The existing email abstraction and developer/test fallback can deliver the history link.
- The no-account envelope lifecycle and both signing modes already work and are not redesigned here.
- Production rollout stays gated until #38 is merged.

## Out of scope for this issue

- Do not implement unmatched-email behavior, public rate-limit boundaries, replacement-link ordering, delivery-failure recovery, or complete troubleshooting copy.
- Do not implement non-completed catalog states, filenames, role-aware groups, search, filters, or pagination.
- Do not add creator controls, sender-verification equivalence, or partner-verification equivalence.
- Do not migrate or revoke existing sender, signer, verification, or completed-document credentials.
- Do not add accounts, analytics, retention changes, email retry infrastructure, or new compliance claims.

## Acceptance criteria

- [ ] The landing page initially shows three equal actions with no selected task; choosing "My documents" reveals an email-only form and returning to the chooser hides it safely — [test: landing task-chooser component test]
- [ ] The two signing choices still submit their existing signing modes through the unchanged sender-start contract — [test: landing signing-mode regression test]
- [ ] A matching completed-document request creates one pending history credential stored only as a one-way hash and produces one metadata-free access email — [test: request/email/persistence integration test]
- [ ] The email includes only the link, 30-minute expiry, and ignore-if-unrequested guidance, with no filename, party, status, or result count — [test: history email payload test]
- [ ] Repeated GET requests render the confirmation state without consuming or verifying the credential — [test: scanner-safe non-consuming confirmation test]
- [ ] One intentional same-origin POST consumes the credential, creates one session, and prevents concurrent or repeated redemption from creating another session — [test: atomic single-use redemption integration test]
- [ ] Redemption succeeds immediately before the 30-minute expiry boundary and fails at and after expiry — [test: deterministic token-expiry boundary test]
- [ ] Successful redemption stores only a session hash and returns a production cookie with Secure, HttpOnly, and SameSite=Lax attributes — [test: session persistence and cookie contract test]
- [ ] The session works immediately before eight hours, fails at and after eight hours, and intermediate reads do not extend expiry — [test: deterministic fixed-session-expiry test]
- [ ] A valid session lists the representative completed document only when the normalized email is a creator or recipient and rejects an unrelated envelope identifier — [test: minimal history authorization integration test]
- [ ] Completed detail and final PDF download work through history-session authorization without a bearer credential in responses, redirects, URLs, or client-visible state — [test: session-protected completed-document integration test]
- [ ] The pre-existing completed-document process link continues to work under its prior contract — [test: completed-link compatibility regression test]
- [ ] The chooser, request form, confirmation, completed row, detail, and download are keyboard operable with programmatic labels and visible focus — [test: tracer accessibility component test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` exit successfully — [command: repository readiness commands]

## How to verify

1. Apply the generated development migration with `pnpm db:migrate:dev`.
2. Run the landing chooser, history credential/session, completed-document authorization, cookie, expiry, and accessibility tests with `pnpm test`.
3. Start the application with the existing test Turnstile bypass and developer email fallback.
4. Seed or create one completed envelope for a known email, request "My documents," open the debug/test email link, confirm redemption, open the completed row, and download the PDF.
5. Inspect persisted link/session rows and confirm only hashes are stored.
6. Repeat the GET and POST redemption steps to confirm GET is harmless and POST is single-use.
7. Attempt the same detail/download with an unrelated envelope and confirm access is rejected.
8. Run `pnpm types`.
9. Run `pnpm lint`.
10. Run `pnpm build`.

## Blocked by

None — can start immediately.

## User stories addressed

- User stories 1-3
- User stories 9-13
- User story 21
- User story 34
- User story 39
- User story 44
- User story 47
