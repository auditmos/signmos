## Parent PRD

#36

## Type

AFK — creator equivalence, resume paths, lifecycle actions, confirmations, denial cases, and audit evidence are objectively specified.

## What to build

Extend the catalog into the complete creator recovery path from PRD #36. A verified history session can activate and resume a matching awaiting-verification sender draft, resume draft preparation or requested changes, review sent status, and invoke only lifecycle-permitted creator cancel/delete actions. Every action must re-check normalized-email role and envelope state through the authorization gateway, and destructive actions require separate consequence-specific confirmations.

The creator must be able to recover without any envelope-specific sender link, while signer-only and unrelated sessions remain unable to control the envelope.

## Assumptions

- #39 supplies creator roles, exact statuses, role-aware groups, server-derived allowed actions, and stable catalog navigation.
- Existing sender verification, preparation, revision, status, cancel, delete, audit, and deletion behavior remain authoritative.
- History identity must exactly match the stored normalized creator email before sender-verification equivalence is permitted.

## Out of scope for this issue

- Do not grant creator actions to a signer who is not the creator.
- Do not implement partner-verification equivalence or partner signing through history.
- Do not add lifecycle transitions, undelete/restore, bulk actions, or retention changes.
- Do not require a fresh email link for each destructive action.

## Acceptance criteria

- [ ] Opening an awaiting-verification draft as its matching creator records equivalent sender verification, applies the valid transition, and resumes preparation — [test: creator verification-equivalence integration test]
- [ ] Different-email, signer-only, expired/revoked-session, and deleted-envelope cases cannot trigger sender equivalence — [test: creator equivalence denial matrix]
- [ ] Draft and changes-requested rows resume the correct preparation/revision path through history authorization without exposing a sender token — [test: creator resume browser/API test]
- [ ] Sent creator rows open a session-protected status review with server-derived actions — [test: creator status-review integration test]
- [ ] Creator-perspective groups update correctly after verification, upload, send, change request, cancel, and completion — [test: creator lifecycle grouping test]
- [ ] Only creator-owned rows expose lifecycle-permitted cancel/delete; signer-only rows and invalid states do not — [test: creator row-action authorization test]
- [ ] Direct cancel/delete by signer-only or unrelated sessions returns stable authorization/state errors — [test: creator-control API denial test]
- [ ] Cancel/delete requires same-origin/CSRF protection and re-checks role/state at mutation time — [test: creator mutation CSRF/stale-state test]
- [ ] Cancel and delete use distinct consequence-specific dialogs with keyboard cancellation, focus trap, and focus restoration — [test: destructive-dialog behavior/accessibility test]
- [ ] Confirmed cancel/delete invokes the existing lifecycle operation exactly once and refreshes/removes the row according to resulting state — [test: creator-control idempotency/UI integration test]
- [ ] Verification equivalence, resume/open, cancel, and delete append safe audit evidence without raw history credentials — [test: creator recovery audit test]
- [ ] Deleting a listed envelope immediately blocks detail, source/final PDF, resume, status, and further mutation paths — [test: creator deletion revocation race test]
- [ ] Existing sender-specific process links retain their previous behavior for unaffected envelopes — [test: sender-link compatibility regression test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` exit successfully — [command: repository readiness commands]

## How to verify

1. Run `pnpm test` and confirm creator equivalence, denial matrix, resume/status, grouping, controls, CSRF, dialogs, audit, deletion race, and sender-link compatibility suites pass.
2. Create representative creator rows for awaiting verification, draft, sent, changes requested, completed, expired, deleted, and signer-only cases.
3. Redeem one matching history session and exercise every server-returned creator action.
4. Attempt the same operations with signer-only, unrelated, expired, and stale sessions and verify structured denial.
5. Delete a previously loaded envelope and retry every read/mutation boundary.
6. Inspect domain/security audit evidence and confirm no raw history credential is present.
7. Run `pnpm types`.
8. Run `pnpm lint`.
9. Run `pnpm build`.

## Blocked by

- Blocked by #39

## User stories addressed

- User story 23
- User story 26
- User stories 28-30
- User stories 34-35
- User stories 37-38
- User stories 40-42
- User story 45
- User story 47
