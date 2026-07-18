# Agentic Mode Release Browser Smokes

Date: 2026-07-17

Environment: local Cloudflare/Vite application at `http://localhost:3000`, development Neon database, development R2 binding, and Cloudflare development Turnstile.

Driver: isolated `agent-browser` Chromium session `signmos-agentic-release`.

Result: PASS. No reusable Bearer secret, verification credential, management-session value, signer token, or hash is retained in this report or its screenshots.

## Four unselected landing choices — PASS

The initial accessibility tree contained exactly four task buttons and no preselected task: **Sign by myself**, **Sign with someone else**, **My documents**, and **Agentic mode**. Each choice was activated independently and exposed its expected email/Turnstile start surface.

Screenshot: [landing-four-choices.png](landing-four-choices.png)

## Agentic verification and console — PASS

1. Submitted the dedicated Agentic access request through the development Turnstile path and observed enumeration-safe accepted copy.
2. Redeemed a fresh restricted non-production email link into its separate HttpOnly management session without placing the credential in a retained command or artifact.
3. Confirmed the empty console state, full-authority warning, token-name field, explicit acknowledgment, accessible `/agent.md` and `/openapi.json` links, a platform-neutral prompt, and distinct prompt/environment copy controls.
4. Generated one token and observed the one-time secret state without taking a screenshot or retaining its value.
5. Reloaded and observed only safe active-token metadata, then revoked through the confirmation dialog and observed the revoked state. The browser credential was therefore cleaned up before the session ended.

Screenshots: [agentic-console-empty.png](agentic-console-empty.png), [agentic-console-active.png](agentic-console-active.png), [agentic-console-revoked.png](agentic-console-revoked.png)

## Legacy sender, signer, completion, and final PDF — PASS

1. Opened `/manual-signing-smoke` and ran create, PDF upload, recipient preparation, field placement, send, and partner verification from browser controls.
2. Entered the signature and date through labeled controls and completed the signer task.
3. Observed **Final PDF is available**, opened the completed-document page, and confirmed one final-PDF download action.
4. The configured Resend account rejected the synthetic `example.com` recipient. The test-only harness therefore used the explicit non-production delivery bypass; TDD proves the bypass is honored in development and ignored in production (`email-delivery.test.ts`, `signing-flow.test.ts`, and `manual-smoke-page.test.tsx`).

Screenshot: [legacy-completed-document.png](legacy-completed-document.png)

## My Documents compatibility — PASS

The same development infrastructure had already retained browser evidence on 2026-07-17 for self-sign, two-party signing, sender resume, signer recovery, search/filter/paging, creator cancel/delete controls, completed detail, final-PDF download, sign-out, exact expiry recovery, and credential-safe audit rows. That evidence was re-used rather than generating more process credentials: [My Documents browser smokes](../my-documents-release/browser-smokes.md).

Current compatibility is additionally covered by the unchanged history, sender, signer, completed-document, finalization, retention, email, accessibility, and route-release suites included in the final `pnpm test` gate.
