## Parent PRD

#5

## Type

AFK

## What to build

Add a full workflow smoke path and lifecycle API contract documentation so both humans and agents can verify the complete v1 workflow.

## Assumptions

- Issues #6 through #11 are complete.
- This issue does not add new product capabilities.

## Out of scope for this issue

- Do not add webhooks.
- Do not add templates.
- Do not add an in-app AI assistant.
- Do not add new field types or auth roles.

## Acceptance criteria

- [ ] Agent-style API smoke test creates, uploads, adds recipients/fields, sends, polls, signs through test helper, and downloads final PDF — [test or runnable command]
- [ ] Human UI smoke test covers upload, field placement, send, signer completion, and final PDF availability — [test: browser/UI integration test]
- [ ] API documentation or OpenAPI-like contract lists lifecycle endpoints, schemas, idempotency keys, and error codes — [observable: documentation artifact]
- [ ] All PRD validation strategy items are mapped to tests, observable artifacts, or commands — [observable: validation checklist]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Run the agent-style lifecycle smoke test.
2. Run the human UI workflow smoke test.
3. Review the API contract artifact for lifecycle endpoints, schemas, idempotency, and errors.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #11

## User stories addressed

- User stories 1-20
