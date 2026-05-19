## Parent PRD

#5

## Type

AFK

## What to build

Implement the authenticated draft envelope foundation and establish the agent-friendly API conventions for lifecycle endpoints: stable JSON, idempotency for mutating operations, and machine-readable errors.

## Assumptions

- Neon/Drizzle is the database foundation.
- If internal auth is missing, this issue may add the smallest viable internal-user identity layer needed to create authenticated envelopes.

## Out of scope for this issue

- Do not add PDF upload.
- Do not add recipients, fields, signing, emails, or final PDF generation.
- Do not add role-based internal permissions.

## Acceptance criteria

- [ ] Authenticated API client can create a draft envelope with stable JSON response including envelope ID and status `draft` — [test: API integration test]
- [ ] Created envelope persists `created_by` identity and creation timestamp — [observable: database row]
- [ ] Repeating create with the same idempotency key returns the original result without duplicate rows — [test: idempotency integration test]
- [ ] Invalid status/action inputs return machine-readable error JSON with code, message, and valid values — [test: error contract test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Run database migrations for the local test environment.
2. Run the API integration tests for envelope creation and idempotency.
3. Run `pnpm types`.
4. Run `pnpm test`.
5. Run `pnpm lint`.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 1
- User story 17
- User story 18
- User story 19
- User story 20
