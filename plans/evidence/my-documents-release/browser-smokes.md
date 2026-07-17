# My Documents Release Browser Smokes

Date: 2026-07-17

Environment: local Cloudflare/Vite development server at `http://localhost:3000`, development Neon database, local R2 binding, Cloudflare development Turnstile.

Driver: `agent-browser` Chromium session `signmos-release`.

No reusable sender, signer, history-link, history-session, or final-document credential is retained in this artifact. Envelope identifiers below are non-secret references.

## Self-sign — PASS

1. Opened the landing chooser and selected **Sign by myself**.
2. Submitted the sender form and continued through the restricted development sender-link surface.
3. Uploaded `smoke-source.pdf` (51 bytes) to envelope `1bbb91f6-986b-4171-a4c6-9338aacacce2`.
4. Reviewed the source PDF, entered a typed signature, and completed signing.
5. Retrieved the completed PDF through the existing final-document link: HTTP 200, `application/pdf`, 2,976 bytes.

Screenshot: [self-sign-complete.png](self-sign-complete.png)

## Two-party — PASS

1. Returned to the landing chooser and selected **Sign with someone else**.
2. Verified the sender through the restricted development link surface.
3. Uploaded the source PDF, added a partner, saved the sender signature profile, and placed one signature field for each signer on envelope `b55cf2bf-8b2c-4319-877c-a96331429094`.
4. Sent the envelope, retrieved the persisted development partner-verification fallback, verified the partner, reviewed the PDF, and completed the partner signature.
5. Retrieved the completed PDF through the existing final-document link: HTTP 200, `application/pdf`, 3,127 bytes.

Screenshot: [two-party-complete.png](two-party-complete.png)

## My Documents recovery — PASS

1. Started from the chooser, selected **My documents**, submitted the completed partner address, and observed the enumeration-safe accepted copy.
2. Retrieved a link only through the restricted non-production debug surface, opened the scanner-safe confirmation page, and intentionally redeemed it into the HttpOnly session.
3. Loaded catalog page 1, searched `history-smoke`, combined `role=signer` and `group=needs_my_action`, and observed the server request with `page=1`.
4. Opened envelope `45297476-9363-4b23-8a39-eec660d80c81` through **Review and sign**, completed signing without a signer token in the URL, and observed the completed transition.
5. Opened awaiting-verification creator envelope `c3c291c4-ade4-4c05-934b-27d38dd00ffe` through **Resume preparation** and reached the source-PDF preparation state without a sender token.
6. Canceled creator envelope `8ab20c0a-a056-4c80-a058-df7b9bdfc61e`; the row refreshed from Sent to Expired and exposed only Delete.
7. Opened completed detail for envelope `b55cf2bf-8b2c-4319-877c-a96331429094` and retrieved its session-protected PDF: HTTP 200, `application/pdf`, 3,127 bytes.
8. Signed out and observed redirect to `/?task=my-documents`.
9. Redeemed a fresh test link, observed the fixed-expiry boundary with a deterministic future request, reloaded the page, and received `HISTORY_SESSION_EXPIRED` plus the request-new-link recovery action.

Screenshots: [chooser.png](chooser.png), [history-confirmation.png](history-confirmation.png), [history-signing-complete.png](history-signing-complete.png), [history-expired-recovery.png](history-expired-recovery.png)

## Security-stream observation — PASS

The synthetic history identity produced safe-reference rows for link issuance/revocation/redemption, signer source open/completion, creator open/cancel, completed-document open, final-PDF download, sign-out revocation, and session expiry. Link/session events used link or session UUIDs; document events additionally used envelope UUIDs. No raw credential was present in the queried rows.

## Integration defect found and closed

The initial recovery click changed the URL but left the catalog mounted because both `/my-documents` route parents lacked outlets. A RED release contract now requires both parent outlets and index routes. After the route split and generated-tree refresh, the same browser session mounted creator detail, creator resume, and signer recovery correctly.
