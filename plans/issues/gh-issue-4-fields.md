## Parent PRD

#5

## Type

HITL - requires visual editor UX review before merge.

## What to build

Implement one field-coordinate model for signature/date fields, expose it through lifecycle JSON APIs, and add a visual editor path for internal users to place fields on PDF pages.

## Assumptions

- Issues #7 and #8 are complete.
- Recipients are created before fields are assigned.

## Out of scope for this issue

- Do not add text, checkbox, initials, autofill, or templates.
- Do not build signer completion.
- Do not build final PDF rendering.

## Acceptance criteria

- [ ] API can create signature and date fields with page/x/y/width/height and recipient assignment — [test: field API test]
- [ ] Visual editor can create and persist the same field records — [test: UI integration test]
- [ ] Invalid field types, page numbers, geometry, and recipient IDs return machine-readable errors with valid field types listed — [test: validation test]
- [ ] Fields cannot be changed after an envelope is sent unless the envelope returns to draft through an explicit supported action — [test: state guard test]
- [ ] Visual editor placement is reviewed and accepted — [HITL: design/UX review by repo owner before merge]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Run field API tests.
2. Run UI integration tests for placing fields.
3. Complete the visual editor review checkpoint.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #7
- Blocked by #8

## User stories addressed

- User story 4
- User story 5
- User story 18
- User story 19
- User story 20
