## Parent PRD

#22

## Type

AFK

## What to build

Change the prepared-envelope flow so the sender completes their own signature during setup. Sending the envelope creates a partner invitation only, not a sender self-sign email. Sender notification emails are created when the partner signs or requests changes.

## Assumptions

- The system can represent sender and partner as distinct signing parties.
- Existing email send records can be asserted in tests without sending real email.

## Out of scope for this issue

- Do not add new partner signature UI modes.
- Do not add full request-changes thread or sender replies.
- Do not add final completed-document view.

## Acceptance criteria

- [ ] Sender setup persists sender signature completion before partner send - [test: lifecycle integration test]
- [ ] Sending a prepared envelope creates a partner signing email/send record and no sender self-sign invitation - [test: email routing integration test]
- [ ] Sender receives notification email/send record when partner signs - [test: partner completion notification test]
- [ ] Sender receives notification email/send record when partner requests changes - [test: request-changes notification test]
- [ ] Envelope status and allowed actions reflect that partner is the only pending signer after send - [test: status contract test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

## How to verify

1. Run lifecycle integration tests for sender setup and partner-only pending signing.
2. Run email send-record tests for partner invitation, partner-signed sender notification, and request-changes sender notification.
3. Inspect test email send records and assert no sender self-sign invitation exists.
4. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

None - can start immediately.

## User stories addressed

- User stories 5, 6, 7
