## Parent PRD

#5

## Type

AFK

## What to build

Generate and store the completed flattened PDF after all required recipients complete. Embed typed signatures and dates into the source PDF and append an audit summary page generated from immutable audit events.

## Assumptions

- Issue #10 is complete.
- Source PDF retrieval and final PDF upload through R2 are available.

## Out of scope for this issue

- Do not add certified evidence packages.
- Do not add webhooks.
- Do not add advanced field types.

## Acceptance criteria

- [ ] Completing all required recipients triggers completed envelope status and final PDF generation — [test: end-to-end integration test]
- [ ] Final PDF in R2 includes flattened typed signatures and date values at the saved coordinates — [test: PDF content/visual regression or deterministic PDF assertion]
- [ ] Final PDF includes an appended audit summary page generated from immutable audit events — [test: PDF/audit summary assertion]
- [ ] API status indicates final PDF availability and download endpoint returns the completed artifact — [test: lifecycle API test]
- [ ] `pnpm types`, `pnpm test`, and `pnpm lint` pass — [command]

## How to verify

1. Run an end-to-end completion test with all recipients signing.
2. Assert completed status and final R2 object existence.
3. Assert PDF contains rendered field values and audit summary.
4. Run `pnpm types`.
5. Run `pnpm test`.
6. Run `pnpm lint`.

## Blocked by

- Blocked by #10

## User stories addressed

- User story 12
- User story 15
- User story 16
- User story 18
