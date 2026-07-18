# Agentic API Measured Calibration

Date: 2026-07-18

Result: PASS — representative measurements retained before numeric Agent API limits were selected.

Command: `pnpm agentic:calibrate` with a temporary development Agentic token, `SIGNMOS_BASE_URL=http://localhost:3000`, and 10 samples. Exit: 0.

Infrastructure: local Cloudflare/Vite Worker at `http://localhost:3000`, configured development Neon Postgres, development R2 binding, and generated 1,307-byte valid PDF self-sign fixtures. The temporary credential was generated through the non-production email-link fixture and stored only in a mode-0600 temporary environment file.

The runner emitted one flushed heartbeat per lifecycle sample plus cleanup. Ten completed calibration documents were deleted after observation. The temporary token was retained only until the release smoke completed, then revoked through its management session.

## Observations

Sample size: 10 per required operation class.

| Operation class | Samples | Min ms | p50 ms | p95 ms | Max ms | Mean ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| catalog read | 10 | 153.40 | 211.34 | 410.79 | 410.79 | 230.33 |
| status read | 10 | 629.86 | 737.41 | 816.18 | 816.18 | 735.33 |
| JSON mutation | 10 | 285.39 | 290.38 | 448.69 | 448.69 | 313.04 |
| PDF upload | 10 | 341.85 | 350.74 | 378.69 | 378.69 | 353.87 |
| PDF download | 10 | 207.90 | 242.67 | 324.86 | 324.86 | 252.87 |
| polling read | 10 | 573.34 | 640.91 | 678.85 | 678.85 | 643.75 |

Observed slowest p95: 816.18 ms for status reads. As a simple sequential reference only, `60,000 / 816.18 = 73.51` such operations per minute. This is not a concurrency benchmark, capacity guarantee, or SLA.

## Selected policy and rationale

| Scope | Fixed window | Threshold | Calibration-grounded rationale |
| --- | ---: | ---: | --- |
| Per token | 60 seconds | 30 requests | One request per two seconds is 40.8% of the slowest observed sequential p95 reference and matches the documented initial polling interval while leaving headroom for mixed database/R2 work. |
| Defensive per IP | 60 seconds | 150 requests | Exactly five active tokens at the per-token ceiling; this is an abuse ceiling, not a backend-throughput claim. |

Tests seed the fixed-window counter and assert below-limit, exact-limit, and above-limit behavior without spending user CPU on hundreds of requests. `agent measured rate-limit boundaries` verifies stable `429`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` behavior.

## Scaling assumptions

- Measurements are sequential personal/pilot traffic; no bulk, latency, concurrency, memory, or throughput guarantee is inferred.
- The same status route represents polling. Clients must still use two-second initial polling, exponential backoff to 30 seconds, jitter, and terminal-state stopping.
- Recalibrate on staging or after material database/R2/runtime changes before changing thresholds.
