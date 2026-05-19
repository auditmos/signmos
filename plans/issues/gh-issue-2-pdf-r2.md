## Parent PRD

#5

## Type

AFK

## What to build

Allow an authenticated internal user or API client to attach one source PDF to a draft envelope, store it in R2, enforce PDF/size validation, and persist source document metadata and hash.

## Assumptions

- Issue #6 is complete.
- R2 binding and local test strategy are available.

## Out of scope for this issue

- Do not add PDF preview UI.
- Do not add fields, recipients, signing links, or final PDF generation.

## Acceptance criteria

- [ ] Valid PDF under 10 MB uploads to R2 and links to the draft envelope — [test: API/storage integration test]
- [ ] Non-PDF and over-limit uploads are rejected with stable machine-readable errors — [test: validation test]
- [ ] Source PDF hash and R2 object key are persisted — [observable: database row plus R2 object]
- [ ] Repeating upload with the same idempotency key does not create duplicate document records — [test: idempotency integration test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Apply migrations from #6 and this issue.
2. Run the upload/storage integration tests.
3. Confirm a test PDF object exists in the configured R2 test bucket or local mock.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #6

## User stories addressed

- User story 2
- User story 18
- User story 19
- User story 20
