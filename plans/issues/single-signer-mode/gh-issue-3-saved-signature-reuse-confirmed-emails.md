## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Persist reusable typed and drawn signature content, plus the user's preferred signature mode, keyed by normalized lowercase email. Saved signature content must only be returned after email confirmation. A confirmed returning signer should see their saved preference/content prefilled, and newly submitted signing content should update the saved profile.

## Assumptions

- Issue 1 is complete: normalized initiating-user email and verified email sessions exist.
- Issue 2 is complete: the self-sign path reaches a signing screen with required fields.
- Existing signature profile storage/rendering should be reused where it fits.

## Out of scope for this issue

- Do not add a saved-signature management screen.
- Do not add uploaded signature image files.
- Do not build document history or final document detail pages.
- Do not introduce accounts or passwords.

## Acceptance criteria

- [ ] Typed signature content and typed/drawn preference can be saved for a normalized lowercase email — [test: signature profile persistence test]
- [ ] Drawn signature content and typed/drawn preference can be saved for a normalized lowercase email — [test: signature profile persistence test]
- [ ] Mixed-case variants of the same email resolve to the same saved signature profile — [test: normalized-email signature test]
- [ ] Saved signature content is not returned before the relevant email is confirmed — [test: signature privacy access-control test]
- [ ] After email confirmation, a returning signer sees the previously saved preference/content prefilled in the signing UI — [test: signing UI prefill test]
- [ ] Completing signing with changed signature content or mode updates the stored reusable signature profile — [test: signing flow update test]
- [ ] Existing signature profile behavior used by the two-signer flow is not regressed — [test: two-signer signature regression test]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run signature profile persistence tests for typed and drawn content.
2. Run normalized-email tests with mixed-case addresses.
3. Run access-control tests for unconfirmed vs confirmed saved-signature requests.
4. Run signing UI tests for returning-user prefill and update-on-completion behavior.
5. Run existing two-signer signature regression coverage.
6. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #29
- Blocked by #30

## User stories addressed

- User story 10
- User story 11
- User story 12
- User story 13
- User story 14
- User story 30
