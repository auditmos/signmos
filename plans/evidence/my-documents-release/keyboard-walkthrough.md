# My Documents Deterministic Keyboard Walkthrough

Date: 2026-07-17

Result: PASS

The walkthrough uses the same order on every release run: Tab through the current state, activate the primary action with Enter/Space, confirm focus after asynchronous transitions, and use Escape for modal cancellation.

| State | Deterministic check | Result |
| --- | --- | --- |
| Landing chooser | Three named buttons are reachable in document order and activate without pointer-only behavior. | PASS |
| Request form | Email has a programmatic label; submit and back actions are buttons; validation/status uses alert or live output. | PASS |
| Accepted state | Generic accepted copy is announced without adding match/delivery-specific controls. | PASS |
| Link confirmation | Named confirmation button is keyboard operable; GET remains non-consuming and POST is intentional. | PASS |
| Link/session recovery | Recovery heading receives programmatic focus and **Request a new link** is a named link. | PASS |
| Catalog | Heading, sign-out, filters, rows, and row actions appear in logical order with visible focus styles. | PASS |
| Search and filters | Search/select controls have labels; Apply moves focus to the live result count after refresh. | PASS |
| Pagination | Numbered page buttons expose `aria-current=page`; automated 26-row coverage verifies page 2 reachability. | PASS |
| Creator dialogs | Tab remained inside the open dialog; Escape closed it; focus returned to **Cancel history-smoke.pdf**. | PASS |
| Signer transition | Source review, typed/drawn choice, signature input, alternate actions, and completion are named controls. | PASS |
| Completed detail/download | Back navigation, Completed heading, Parties region, and Download signed PDF are keyboard reachable. | PASS |
| Sign-out | Named button performs same-origin POST; signed-out status is live/focusable before redirect. | PASS |
| Expired session | **Session expired** heading and **Request a new link** recovery action are exposed after reload. | PASS |

Automated companions: `history-tracer-accessibility.test.tsx`, `history-catalog-controls.test.tsx`, `history-creator-controls.test.tsx`, `recovered-signer-accessibility.test.tsx`, and `history-document-detail-page.test.tsx`.
