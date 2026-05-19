## Parent PRD

#5

## Type

HITL - requires signer experience review before merge.

## What to build

Build the no-account signer experience for valid magic links. Signers can review assigned fields, type a signature, complete date fields, decline with a reason, and leave comments.

## Assumptions

- Issues #8 and #9 are complete.
- Tokens expire according to the model from #8.

## Out of scope for this issue

- Do not add signer accounts.
- Do not add delegation.
- Do not generate completed PDFs.

## Acceptance criteria

- [ ] Signer can open a valid magic link without internal login and only access their assigned envelope view — [test: signer access integration test]
- [ ] Signer can type a signature and complete required signature/date fields — [test: signer completion test]
- [ ] Completing one recipient updates recipient status while envelope remains sent until all required recipients complete — [test: status transition test]
- [ ] Signer can decline with a reason and optional comment, causing envelope declined status — [test: decline flow test]
- [ ] Comments and signer actions append immutable audit events — [observable: audit event rows]
- [ ] Signer experience is reviewed and accepted — [HITL: UX review by repo owner before merge]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Run signer access, completion, status, and decline tests.
2. Verify audit event rows for signing and comments.
3. Complete the signer UX review checkpoint.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #8
- Blocked by #9

## User stories addressed

- User story 7
- User story 8
- User story 9
- User story 10
- User story 11
- User story 12
- User story 13
