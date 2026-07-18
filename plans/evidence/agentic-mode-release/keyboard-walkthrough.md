# Agentic Mode Keyboard And Accessibility Walkthrough

Date: 2026-07-17

Result: PASS.

| Surface | Keyboard/accessibility observation | Evidence |
| --- | --- | --- |
| Landing chooser | The accessibility tree exposed one level-one heading followed by exactly four named buttons. Each of the four buttons was focused and activated with `Enter`; each opened its expected labeled email input without preselecting another task. | Browser walkthrough; `landing-agentic-accessibility.test.tsx` |
| Agentic access request | Email input, Turnstile gate, and submit control had accessible names; accepted copy remained enumeration-safe. | Browser walkthrough; Agentic access component tests |
| Empty token console | Token name, full-authority acknowledgment, public guide link, OpenAPI link, and generation action were keyboard-addressable. | `agentic-console-empty.png`; `agentic-token-console.test.tsx` |
| Copy controls | The platform-neutral prompt copy and `$SIGNMOS_TOKEN` environment setup copy were separate named buttons; the prompt contained no credential. | `agentic-token-console.test.tsx`; agent API contract release test |
| Token creation and revocation | The one-time creation state was read without retaining the secret; reload exposed safe metadata only. Revocation used a named trigger and confirmation dialog, and focus remained within operable controls. | `agentic-console-active.png`; `agentic-console-revoked.png`; token-console accessibility tests |
| Legacy signing | Setup, verification, labeled signature/date fields, completion, completed-document navigation, and final-PDF action were keyboard-semantic buttons, inputs, or links. | Browser smoke; `manual-smoke-page.test.tsx`; signer accessibility suites |
| My Documents | Retained keyboard evidence covers filters, paging, row actions, detail, signing, creator controls, final download, sign-out, and expired-session recovery. | [My Documents keyboard walkthrough](../my-documents-release/keyboard-walkthrough.md) |

No keyboard step required a pointer-only target, unlabeled form control, platform-specific agent name, or secret pasted into prompt text.
