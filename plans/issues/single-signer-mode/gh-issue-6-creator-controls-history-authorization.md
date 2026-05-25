## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Add creator-only cancel/delete controls for eligible draft and in-progress envelopes from the confirmed-email history experience. Partner signers can view, resume, sign, or download documents according to existing access rules, but cannot cancel or delete envelopes they did not create.

## Assumptions

- Issue 5 is complete: confirmed-email history can list draft, in-progress, and completed documents with row actions.
- Existing lifecycle controls define which envelope states can be canceled or deleted safely.
- Existing deletion/retention behavior remains the authority for stored files and records.

## Out of scope for this issue

- Do not add partner-initiated cancellation or deletion.
- Do not change the 30-day history window.
- Do not change retention/deletion policy beyond invoking existing safe lifecycle actions.
- Do not add account settings or admin controls.

## Acceptance criteria

- [ ] Creator-owned eligible draft/in-progress history rows expose cancel/delete actions — [test: creator history actions UI test]
- [ ] Creator cancel/delete actions invoke existing lifecycle controls and update the row status or remove/revoke access according to current behavior — [test: creator lifecycle action integration test]
- [ ] Creator cancel/delete actions append existing audit/lifecycle records — [observable: audit/lifecycle rows]
- [ ] Partner signer history rows do not expose cancel/delete actions for envelopes created by another email — [test: partner history actions UI test]
- [ ] Partner signer attempts to call cancel/delete directly for another creator's envelope are rejected with stable authorization errors — [test: partner authorization API test]
- [ ] Completed rows do not expose unsafe cancel/delete actions unless already supported by existing lifecycle rules — [test: completed row action test]
- [ ] Existing resume, sign, and download actions from history continue to work after creator controls are added — [test: history regression test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run history UI tests for creator vs partner row actions.
2. Run lifecycle integration tests for creator cancel/delete.
3. Assert audit/lifecycle rows for creator actions.
4. Run direct API authorization tests for partner cancel/delete attempts.
5. Run history regression tests for resume, sign, and download actions.
6. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #33

## User stories addressed

- User story 26
- User story 27
- User story 29
