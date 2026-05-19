## Parent PRD

#5

## Type

AFK

## What to build

Add recipient management, parallel envelope sending, expiring signer tokens, Resend invitation email records, and manual resend behavior.

## Assumptions

- Issues #6 and #7 are complete.
- Resend configuration is available in local/test environments or can be mocked in tests.

## Out of scope for this issue

- Do not build signer completion UI.
- Do not add field placement.
- Do not generate completed PDFs.
- Do not add automatic reminders.

## Acceptance criteria

- [ ] API can add up to 10 recipients with valid name/email fields — [test: recipient API test]
- [ ] Recipient count above 10 and invalid emails are rejected with stable errors — [test: validation test]
- [ ] Sending a ready envelope creates active tokens for all recipients in parallel and records `sent_by` identity — [test: integration test]
- [ ] Invitation email send records are persisted for each recipient — [observable: database rows]
- [ ] Manual resend creates a new email send record without duplicating recipients — [test: resend integration test]
- [ ] Expired tokens cannot be used and return an expired-token error — [test: time-controlled token test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Apply migrations through this issue.
2. Run recipient, send, resend, and token-expiry tests.
3. Verify email send records are persisted for all recipients.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #6
- Blocked by #7

## User stories addressed

- User story 3
- User story 6
- User story 13
- User story 14
- User story 18
- User story 19
- User story 20
