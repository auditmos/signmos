# Human Review Browser Smoke

Date: 2026-07-20  
Environment: configured local Vite/Cloudflare Worker, development Neon, development R2  
Identity: synthetic normalized email `human-review-62@example.com`

## Result

PASS for the fallback/passwordless browser boundary, queue discovery, exact review, explicit approval, terminal focus, Agent polling, and final PDF. A real Resend inbox was deliberately bypassed; safe provider delivery/content remains automated integration evidence in `human-review.test.ts`.

## Observations

1. Generated a temporary named personal token through the development Agentic email-link fixture. The raw token remained only in browser memory and was not printed or written to an artifact.
2. The Agent browser created a self-sign document, uploaded a 35-byte PDF fixture, placed default fields, and requested completion. The protected mutation returned HTTP `202 pending_human_review`; the document status reported `finalPdfAvailable: false`.
3. Opening the opaque review locator without a My Documents session redirected to `/?task=my-documents&returnTo=<same review>`. The development passwordless fixture redeemed for the matching normalized email and returned to the exact same review.
4. The review showed revision 1, document name, initiating token name, exact typed-signature payload, signature/date field coordinates, plain-language consequence, expiry, and three unselected actions. The bound source PDF returned HTTP 200 with `application/pdf`.
5. **Not now** returned to My Documents without execution. The matching-email **Pending human reviews** queue contained the same request; reopening it preserved the exact context.
6. **Approve and execute** produced the announced terminal text `Approved and executed.` and moved focus to the `OUTPUT` status element.
7. The originating token's command poll returned HTTP 200 with `status: completed` and `notificationStatus: fallback`. Document status then reported `finalPdfAvailable: true`; final download returned HTTP 200, `application/pdf`, and 2,969 bytes.
8. The temporary personal token was revoked successfully and removed from browser memory. The browser session and development server were closed, and the temporary non-production Worker bypass flags were removed. The completed synthetic document remains under normal retention controls.

## Retained artifacts

- `browser-review-before-approval.png` — exact document/action/payload/field context and unselected controls.
- `browser-my-documents-queue.png` — matching-email pending-review queue after **Not now**.
- `browser-review-approved.png` — terminal approved/executed state.

No screenshot contains a Bearer token, passwordless credential, browser session cookie, token hash, or approval secret.
