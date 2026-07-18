# Agentic Credential Redaction Scan

Date: 2026-07-18

Result: PASS — zero reusable Bearer, management-session, link, or hash canaries found outside their intended one-time authority boundary.

Named command: `pnpm exec vitest run -t "agent credential redaction"`.

| Surface | Check | Result |
| --- | --- | --- |
| URLs and redirects | Bearer canary never appears in request URLs, response URLs, or Location headers. | PASS |
| Later responses and errors | Identity, not-found, missing-key, and public-contract responses contain no raw token or token hash. | PASS |
| Logs | Console log/info/warn/error instrumentation contains no Bearer canary or hash. | PASS |
| Audit/security events | Rows contain normalized email and safe token ID/name, never raw token/hash. | PASS |
| Analytics hooks | No analytics dependency/hook exists in the release surface. | PASS |
| Emails | Agent document activity records contain no Bearer/session/hash. A verification credential is permitted only inside the intended single-use verification-link email; it is not copied to logs, audit rows, later responses, or retained evidence. | PASS |
| Public `/agent.md` and `/openapi.json` | No live credential, credential query parameter, cookie, process link, or internal identity header. | PASS |
| Release Markdown, fixtures, and screenshots | Recursive byte scan rejects raw `signmos_` secrets, fragment credentials, and 64-hex hashes. | PASS |

The scan intentionally distinguishes delivery of a single-use verification link to its intended email recipient from an operational leak. Bearer secrets and management sessions are never email content.
