## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Add a mode-aware start path for the signing product. The landing page defaults to "Only me", lets users switch to "Me and another signer", collects initiating user name/email, and reuses the existing email-link confirmation gate before PDF upload. The two-signer path must continue to follow the current partner-signing workflow.

## Assumptions

- The existing sender start and email confirmation mechanism is the authority for initiating-user verification.
- The existing no-account envelope lifecycle remains the product model.
- Lowercased email identity is sufficient for this feature; do not add password accounts or a user/account table.

## Out of scope for this issue

- Do not build PDF upload, preview, signing, final PDF download, document history, or saved-signature reuse.
- Do not add a new email provider.
- Do not redesign the two-signer flow beyond adding the mode selector and preserving its current behavior.

## Acceptance criteria

- [ ] Landing page renders "Only me" and "Me and another signer" as a simple mode selector with "Only me" selected by default — [test: landing page component/UI test]
- [ ] Switching the selector changes the mode that is submitted or routed without losing entered name/email values — [test: landing page component/UI test]
- [ ] Single-signer start accepts initiating user name/email and creates or reuses the appropriate verified-email start state — [test: API or route integration test]
- [ ] Single-signer upload/history/signature access is blocked before the initiating email link is verified — [test: email-gate integration test]
- [ ] Valid initiating-user email confirmation unlocks the next self-sign step; invalid/expired links return stable machine-readable errors — [test: verification token integration test]
- [ ] "Me and another signer" continues to route into the existing two-person flow and collects partner details wherever the current flow expects them — [test: two-signer regression test]
- [ ] Email identity is normalized to lowercase for the start/session identity used by this feature — [test: normalized-email unit or integration test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run the landing page component/UI tests for default mode and mode switching.
2. Run verification-gate integration tests for unverified, verified, invalid, and expired email-link states.
3. Run the two-signer regression test to confirm the existing partner flow still starts correctly.
4. Run the normalized-email test for mixed-case email inputs.
5. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

None - can start immediately.

## User stories addressed

- User story 1
- User story 2
- User story 3
- User story 4
- User story 28
- User story 30
