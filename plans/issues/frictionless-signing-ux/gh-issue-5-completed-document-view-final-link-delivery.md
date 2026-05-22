## Parent PRD

#22

## Type

HITL - requires owner visual review of the completed-document view before merge.

## What to build

Route fully signed envelopes to a dedicated completed-document view from any relevant signing/final link. The view shows final PDF download, party summary, signed dates, final status, and user-facing audit/history events. Completion emails go to both parties with link only, and final PDF download works for anyone with the final download token.

## Assumptions

- Partner signature choice with optional reuse is complete.
- Fixed signing date and simple change request behavior is complete.
- Final PDF generation/storage exists or is available from the pilot finalization work.
- Audit events include enough user-facing data to render completed-document history.

## Out of scope for this issue

- Do not add PDF email attachments, login-gated final download, admin-only security audit events, or advanced evidence packages.

## Acceptance criteria

- [ ] Fully signed signing/final links render or redirect to completed-document view - [test: route/API integration test]
- [ ] Completed view includes final PDF download, party summary, signed dates, final status, and user-facing audit/history events - [test: completed view component/API test]
- [ ] User-facing audit/history excludes technical security events from normal UI - [test: audit filtering test]
- [ ] Completion email/send records are created for both parties with completed-view/download link and no PDF attachment payload - [test: email payload test]
- [ ] Final PDF download succeeds with final download token and no signer-specific login/session - [test: final token download test]
- [ ] Completed-document UI passes owner visual review before merge - [HITL: owner visual review]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

## How to verify

1. Run route/API tests for completed-envelope link handling.
2. Run completed view component/API tests for download link, party summary, signed dates, status, and user-facing history.
3. Run audit filtering tests.
4. Run completion email payload tests and assert no PDF attachment.
5. Run final token download access tests.
6. Complete owner visual review of the completed-document view.
7. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #25
- Blocked by #26

## User stories addressed

- User stories 14, 15, 16, 17
