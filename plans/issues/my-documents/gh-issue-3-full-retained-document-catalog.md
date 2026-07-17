## Parent PRD

#36

## Type

AFK — catalog membership, projection, grouping, ordering, search, filtering, pagination, and accessibility are specified by objective matrices and tests.

## What to build

Replace the minimal and legacy 30-day/fixed-limit history behavior with the full session-authorized catalog from PRD #36. Persist original filenames per source revision, use the latest active filename, keep pre-upload drafts discoverable, include every retained matching non-deleted lifecycle state and role, explain retention, derive role-aware groups and exact statuses, prioritize actionable work, and provide authorized server-side search, filters, and numbered pagination.

The result must query the complete retained matching set without a hidden candidate cap and without revealing unrelated envelopes.

## Assumptions

- #38 provides a production-safe normalized-email session and public access flow.
- Existing source revisions, recipients, lifecycle states, audit events, deletion, and retention remain authoritative.
- Latest meaningful activity can be derived from user-facing lifecycle data or represented by a canonical activity timestamp without changing the PRD ordering rule.

## Out of scope for this issue

- Do not implement creator verification equivalence, creator controls, or partner verification/signing through history.
- Do not change retention, execute retention cleanup, restore deleted documents, or provide permanent archival guarantees.
- Do not add folders, tags, favorites, bulk actions, export-all, OCR, PDF-content search, or a separate search service.

## Acceptance criteria

- [ ] Source upload/revision persistence records the original filename without weakening existing PDF validation, hash, R2, idempotency, or revision guards — [test: filename persistence/upload regression test]
- [ ] Multiple revisions display the latest active revision's original filename — [test: latest-revision title test]
- [ ] A matching pre-upload draft appears as "Untitled document" with created date and a non-secret short reference — [test: untitled draft catalog test]
- [ ] Matching retained envelopes older than 30 days are returned with no independent creation-date cutoff — [test: deterministic older-than-30-days catalog test]
- [ ] Creator, signer, and creator-and-signer roles appear across awaiting verification, draft, sent, changes requested, completed, declined, and expired; unrelated/deleted rows are excluded — [test: full role/status catalog matrix]
- [ ] Participant names/emails are projected and searchable only for authorized rows — [test: participant projection authorization test]
- [ ] Rows map correctly to Drafts, Needs my action, Waiting on others, Completed, and Closed from role, recipient state, status, and allowed actions — [test: role-aware group matrix]
- [ ] Every row exposes exact lifecycle status and server-derived allowed actions — [test: exact-status/action contract test]
- [ ] Actionable rows come first; remaining rows use meaningful lifecycle activity, creation fallback, and deterministic identity tie-break — [test: action-first stable-ordering test]
- [ ] History-security events do not affect meaningful-activity ordering — [test: security-event ordering-exclusion test]
- [ ] Case-insensitive server search matches latest filename, participant name, and participant email only after authorization — [test: authorized search integration test]
- [ ] Role, group, and exact-status filters combine without changing session authorization — [test: combined filter integration test]
- [ ] Numbered pages contain 25 rows with page/page-size/total metadata; more than 25 rows produce stable non-overlapping pages and all rows are reachable — [test: multi-page pagination test]
- [ ] The catalog has no hidden fixed maximum that silently truncates authorized results — [test: result-set boundary test beyond prior limits]
- [ ] The UI explains the existing 90-day completed/expired retention policy without promising permanent storage — [test: retention-copy component test]
- [ ] An envelope deleted after page load is omitted on refresh and rejected by direct catalog-derived reads — [test: deleted-after-list catalog race test]
- [ ] Search, filters, pagination, labels, groups, statuses, loading, empty, and error states are accessible by keyboard and assistive technology — [test: catalog accessibility test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` exit successfully — [command: repository readiness commands]

## How to verify

1. Generate and apply the development migration using the repository database-generation and migration commands; do not edit generated migration files manually.
2. Run `pnpm test` and confirm filename, catalog matrix, ordering, search/filter, pagination, deletion-race, and accessibility tests pass.
3. Seed more than 25 matching envelopes spanning every supported role/status, including records older than 30 days, multiple source revisions, a pre-upload draft, an unrelated row, and a deleted row.
4. Request each page and combined filter/search case and verify totals, stable ordering, authorization, and complete reachability.
5. Confirm the UI shows latest filenames, untitled fallback, parties, groups, exact statuses, and retention copy.
6. Run `pnpm types`.
7. Run `pnpm lint`.
8. Run `pnpm build`.

## Blocked by

- Blocked by #38

## User stories addressed

- User stories 22-33
- User story 37
- User story 42
- User story 47
