# Issue Drafts: Single-Signer Mode And Document History

> Source PRD: `plans/single-signer-mode-prd.md`

Parent PRD issue: #28 - https://github.com/auditmos/signmos/issues/28

Issues were created on GitHub in dependency order.

## Dependency Order

1. `plans/issues/single-signer-mode/gh-issue-1-mode-aware-start-email-gate.md`
2. `plans/issues/single-signer-mode/gh-issue-2-verified-self-sign-upload-default-fields.md`
3. `plans/issues/single-signer-mode/gh-issue-3-saved-signature-reuse-confirmed-emails.md`
4. `plans/issues/single-signer-mode/gh-issue-4-self-sign-completion-secure-detail-link.md`
5. `plans/issues/single-signer-mode/gh-issue-5-confirmed-email-document-history.md`
6. `plans/issues/single-signer-mode/gh-issue-6-creator-controls-history-authorization.md`

## Slice Summary

| # | GitHub | Title | Type | Blocked by | User stories |
| --- | --- | --- | --- | --- | --- |
| 1 | #29 | Mode-Aware Start And Email Gate | AFK | None | 1, 2, 3, 4, 28, 30 |
| 2 | #30 | Verified Self-Sign Upload With Default Fields | AFK | #29 | 5, 6, 7, 8, 9, 15, 29 |
| 3 | #31 | Saved Signature Reuse For Confirmed Emails | AFK | #29, #30 | 10, 11, 12, 13, 14, 30 |
| 4 | #32 | Self-Sign Completion And Secure Detail Link | AFK | #30, #31 | 16, 17, 18, 24, 29 |
| 5 | #33 | Confirmed Email Document History | AFK | #29, #32 | 19, 20, 21, 22, 23, 24, 25 |
| 6 | #34 | Creator Controls And History Authorization | AFK | #33 | 26, 27, 29 |
