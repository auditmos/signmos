import { z } from "zod";
import { AgentDocumentErrorSchema } from "@/db/agentic-access/schema";
import { agentApiRateLimitPolicy } from "@/hono/api/agent-rate-limit-policy";

export function agentRateLimitErrorResponse() {
	return {
		description: "Measured per-token or defensive per-IP request limit exceeded",
		headers: {
			"RateLimit-Limit": integerHeader("Active fixed-window request limit"),
			"RateLimit-Remaining": integerHeader("Requests remaining in the active window"),
			"RateLimit-Reset": integerHeader("UTC epoch seconds when the active window resets"),
			"Retry-After": integerHeader("Seconds to wait before retrying"),
		},
		content: { "application/json": { schema: z.toJSONSchema(AgentDocumentErrorSchema) } },
	};
}

export const agentRateLimitGuidance = `
## Polling and rate limits

The measured personal/pilot policy uses a fixed 60-second window: ${agentApiRateLimitPolicy.token.limit} requests per token and ${agentApiRateLimitPolicy.ip.limit} requests per source IP. Every successful authenticated response includes RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset. These are safety limits, not throughput or latency promises.

On 429, stop requests for the Retry-After duration. For lifecycle polling, start at two seconds, use exponential backoff up to 30 seconds, add jitter, and stop when allowedActions reaches the goal or a terminal error says retryable is false. Never parallelize polling merely to consume the available limit.
`;

function integerHeader(description: string) {
	return { description, schema: { type: "integer", minimum: 0 } };
}
