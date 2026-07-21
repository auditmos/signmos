# Signmos Production Deployment

This is the operator runbook for the OpenAI Build Week judge candidate at
`https://signmos.com`. It prepares issue #61; it does not prove that a live
deployment or either judge workflow has passed.

Cloudflare treats the Worker as the origin through an apex Custom Domain. The
production configuration deliberately disables `workers.dev` and version
preview ingress so email links, judges, and retained evidence use one origin.

## Ownership and judging window

- **Owner:** Individual submitter and Signmos repository/Cloudflare
  administrator.
- **Availability responsibility:** From the first production deployment through
  **2026-08-05 17:00 PDT** (**2026-08-06 02:00 CEST**).
- **Check cadence:** Check the public endpoints at the start and end of each
  active workday, after any release or infrastructure change, and immediately
  before the Devpost submission is finalized.
- **Evidence location:** Record only the deployed Git SHA, timestamps, public
  URLs, and pass/fail results in issue #61. Never paste secrets, personal tokens,
  email credentials, or magic links into GitHub or Devpost.

## One-time infrastructure prerequisites

1. `signmos.com` is an active zone in the Cloudflare account used by Wrangler.
   The apex must not have a conflicting CNAME. Cloudflare creates the Custom
   Domain DNS record and certificate when the production Worker is deployed.
2. Cloudflare SSL/TLS mode is Full or Full (strict), never Flexible. Do not add
   a redirect rule that sends `signmos.com` back to itself.
3. The `signmos-documents-production` R2 bucket exists in the same account.
4. A production Neon database has the committed migrations applied.
5. Resend has a verified sender that can deliver the passwordless and
   human-review messages used by judges.
6. Cloudflare Turnstile has production keys authorized for `signmos.com`.

Keep `.production.vars` local and ignored by Git. It must contain nonempty
values for every secret declared under `env.production.secrets.required` in
`wrangler.jsonc`, including these non-secret routing values:

```dotenv
CLOUDFLARE_ENV="production"
APP_BASE_URL="https://signmos.com"
```

Cloudflare account credentials belong in the operator environment or CI secret
store, never `.production.vars`. The deploy script passes the vars file to
Wrangler without printing values. Because `--deploy` synchronizes Worker
secrets, review the local file before approving that command.

## Build and deployment

From a working tree that contains the intended candidate:

```bash
./scripts/deploy-production.sh --dry-run
```

The dry run sets `CLOUDFLARE_ENV=production` for the Vite build and asks Wrangler
to validate the generated `dist/server/wrangler.json`. It does not change remote
Cloudflare state and may be used while iterating locally.

Commit the final candidate and ensure `git status --short` is empty. Then run:

```bash
./scripts/deploy-production.sh --deploy
```

The live path refuses a dirty tree, validates the local production variables,
checks Cloudflare authentication and the production R2 bucket, builds and dry
runs first, synchronizes named Worker secrets without printing their values,
deploys with a `git:<full-sha>` message, and checks the three public endpoints.
It prints the exact deployed SHA for retention in issue #61.

Production uses real email verification and Turnstile. The normal API/UI never
returns verification shortcuts, and production debug fallback links remain disabled.
Do not add an allowlist, shared judge credential, paywall, or
production test bypass to make the demonstration easier.

## Required post-deploy verification

The script's HTTP checks are necessary but not enough to close #61:

1. Open `https://signmos.com/` in a clean, signed-out desktop Chromium session.
   Follow the README judge path with the synthetic PDF and an inbox you control;
   receive the real email, complete signing, and download the final PDF.
2. Confirm `https://signmos.com/agent.md` and
   `https://signmos.com/openapi.json` are public and describe the deployed
   `/api/v1` surface.
3. Create a temporary personal token through Agentic mode. Export it locally—do
   not paste it into a prompt or URL—then run:

   ```bash
   SIGNMOS_BASE_URL=https://signmos.com pnpm agentic:smoke
   ```

4. Complete the matching-human approval in the browser, retain the smoke result,
   revoke the temporary token, and clear `SIGNMOS_TOKEN` from the shell.
5. Verify rate-limit headers, real notification delivery, clean-browser access,
   and the absence of undocumented allowlists or payment requirements. Record
   pass/fail evidence and the deployed SHA in issue #61.

## Monitoring and recovery

For each availability check, request `/`, `/agent.md`, and `/openapi.json` and
confirm real email delivery with a synthetic access request when no recent
end-to-end check exists. Use Cloudflare Worker logs and the provider dashboards
for diagnosis, but do not copy request credentials into retained evidence.

If the candidate is unhealthy:

1. Stop further deployment changes and record the public symptom and timestamp.
2. Inspect Worker logs, Custom Domain/certificate state, R2 binding availability,
   Neon connectivity, Resend delivery, and Turnstile hostname configuration.
3. Roll back the Worker code when the prior version is known-good:

   ```bash
   pnpm exec wrangler rollback --config wrangler.jsonc --env production
   ```

4. Re-run the public endpoint checks plus the affected human or Agentic flow.
   Record the recovered version/SHA and result in issue #61.

Do not advertise a `workers.dev` fallback. If `signmos.com` cannot be restored,
the submission owner must treat judge access as blocked rather than silently
changing the documented candidate.
