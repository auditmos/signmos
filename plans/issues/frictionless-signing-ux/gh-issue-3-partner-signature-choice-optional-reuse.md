## Parent PRD

#22

## Type

HITL - requires owner visual review of the partner typed/drawn signature UI and remember-signature consent before merge.

## What to build

Give the partner the same signature choice as the sender: typed or drawn. Add explicit consent to remember signature preference/content globally by email. If remembered, typed signatures store typed text and drawn signatures store drawn data/image for future use.

## Assumptions

- Sender-first signing and email routing are complete.
- Reusable signature content can be keyed by normalized email without accounts.

## Out of scope for this issue

- Do not add account/profile management, signature deletion UI, uploaded signature files, or admin management.
- Do not change sender signature creation unless shared components need a narrow extension for partner reuse.

## Acceptance criteria

- [ ] Partner signing UI allows switching between typed and drawn signature modes - [test: signer UI/component test]
- [ ] Partner can complete signing with typed signature - [test: signing integration test]
- [ ] Partner can complete signing with drawn signature - [test: signing integration test]
- [ ] Remember option is explicit and unchecked state does not update global signature preference/content - [test: consent persistence test]
- [ ] Remembered typed signature stores preferred type and typed text by email - [test: signature preference persistence test]
- [ ] Remembered drawn signature stores preferred type and drawn data/image by email - [test: signature preference persistence test]
- [ ] Existing saved preference is loaded as the partner default on a future envelope for the same email - [test: reuse integration test]
- [ ] Signature-choice UI passes owner visual review before merge - [HITL: owner visual review]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass - [command]

## How to verify

1. Run signer UI/component tests for typed/drawn switching and remember-checkbox behavior.
2. Run signing integration tests for typed and drawn completion.
3. Run persistence tests for remembered and not-remembered signatures.
4. Run reuse test for a later envelope with the same partner email.
5. Complete owner visual review of the partner signature UI.
6. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #24

## User stories addressed

- User stories 8, 9, 10
