## Parent PRD

#22

## Type

AFK

## What to build

Make sender start safe and abuse-resistant. The public name/email form requires Turnstile before creating verification, the normal confirmation screen only tells the sender to check email, and verification fallback links remain available only to developer/test surfaces.

## Assumptions

- Sender start and verification email/fallback behavior already exist or are being built by the pilot foundation.
- Turnstile can be called through an adapter or boundary that tests can bypass explicitly.

## Out of scope for this issue

- Do not add partner signing, sender signing, final PDF access, signature preference storage, or completion routing.
- Do not redesign rate limits beyond behavior already present in the pilot.

## Acceptance criteria

- [ ] Normal sender confirmation renders sent-email confirmation and no raw verification URL or open-link action - [test: sender-start UI/component test]
- [ ] Verification fallback URL is available only through test/developer debug/log surface, not normal UI - [test: API/dev-mode boundary test]
- [ ] Sender start rejects missing or invalid Turnstile before creating verification/email send records - [test: API integration test]
- [ ] Automated tests can use an explicit Turnstile bypass without requiring network calls - [test: Turnstile adapter test]
- [ ] Manual browser dev path is documented to use Turnstile development keys from vars/env - [observable: README or runbook note]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

## How to verify

1. Run sender-start UI/component tests.
2. Run sender-start API tests for Turnstile accepted/rejected paths.
3. Confirm test/dev fallback links are not rendered in the normal confirmation UI.
4. Confirm the manual browser runbook or README names the dev Turnstile vars/env path.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

None - can start immediately.

## User stories addressed

- User stories 1, 2, 3, 4
