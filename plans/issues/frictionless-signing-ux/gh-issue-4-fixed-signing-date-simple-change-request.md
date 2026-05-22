## Parent PRD

#22

## Type

AFK

## What to build

Remove signer date editing from the normal flow and set signing date from the current server/application date. Keep partner disagreement as a simple request-changes action with a required comment, visible to the sender and sent through notification email.

## Assumptions

- Sender-first signing and email routing are complete.
- Time can be controlled in tests through an existing header, fake clock, or injectable clock boundary.
- The product has or will keep a changes-requested lifecycle state.

## Out of scope for this issue

- Do not add full negotiation thread, sender replies, partner document editing, or admin/support date overrides.

## Acceptance criteria

- [ ] Signer UI does not render an editable signing-date picker/input - [test: signer UI/component test]
- [ ] Signing completion stores today's date from the controlled clock - [test: time-controlled signing test]
- [ ] Future submitted dates cannot be persisted from signer input - [test: API/domain validation test]
- [ ] Partner can request changes with a required comment instead of signing - [test: change-request integration test]
- [ ] Sender-facing status/API exposes the first request-changes comment - [test: sender status/API test]
- [ ] Sender receives a request-changes notification email/send record with the comment context - [test: email send-record test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

## How to verify

1. Run signer UI/component tests that assert no date picker/input is visible.
2. Run time-controlled signing tests and future-date rejection/ignore tests.
3. Run change-request integration tests with required comment validation.
4. Run sender status/API and email send-record tests for request-changes comment visibility and notification.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #24

## User stories addressed

- User stories 11, 12, 13
