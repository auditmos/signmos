## Parent PRD

#28

Local source: `plans/single-signer-mode-prd.md`

## Type

AFK

## What to build

Complete the one-recipient self-sign envelope after the initiating signer fills the required signature/date fields. After completion, show a document detail/status page with a download action and create the existing-style secure signer-specific link to that detail page. Possession of the secure involved-signer link is enough to open the detail/download page without another email confirmation step.

## Assumptions

- Issue 2 is complete: self-sign envelopes have a source PDF and required fields.
- Issue 3 is complete: signature content can be prefilled and updated, though completion must still work for first-time signers.
- Existing final PDF generation and secure signer token behavior are reused where possible.

## Out of scope for this issue

- Do not implement the 30-day document history table.
- Do not add a new email provider.
- Do not add new legal/audit evidence beyond parity with current envelope lifecycle records.
- Do not implement creator cancel/delete controls from history.

## Acceptance criteria

- [ ] Completing required self-sign signature/date fields moves the one-recipient envelope to completed using the existing lifecycle rules — [test: self-sign completion integration test]
- [ ] Completed self-sign envelopes produce a final signed PDF artifact through the existing finalization path — [test: final PDF integration/assertion test]
- [ ] After completion, the signer reaches or can open a detail/status page showing completed status and a download action — [test: browser/detail page test]
- [ ] Completion creates or records a signer-specific detail-page link using the current email/send-record/fallback-link abstraction — [observable: email send record or fallback-link response]
- [ ] A valid involved-signer secure link opens the detail/download page without requiring another email confirmation — [test: secure detail-link access test]
- [ ] Invalid, expired, deleted, or unrelated signer links are rejected with stable errors and no PDF access — [test: detail-link access-control test]
- [ ] Completed document download returns the final PDF from the detail page — [test: detail download API/browser test]
- [ ] Self-sign completion appends the same category of audit/lifecycle records as equivalent current signing completion — [observable: audit/lifecycle rows]
- [ ] `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build` pass — [command]

## How to verify

1. Run self-sign completion integration tests.
2. Run final PDF artifact tests for one-recipient envelopes.
3. Run browser/detail page tests for completed status and download action.
4. Verify the completion link appears in the email send record or fallback-link response.
5. Run secure-link access-control tests for valid, invalid, expired, deleted, and unrelated links.
6. Assert audit/lifecycle rows for completion and download.
7. Run `pnpm types`, `pnpm test`, `pnpm lint`, and `pnpm build`.

## Blocked by

- Blocked by #30
- Blocked by #31

## User stories addressed

- User story 16
- User story 17
- User story 18
- User story 24
- User story 29
