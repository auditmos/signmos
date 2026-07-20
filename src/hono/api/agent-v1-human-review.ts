import { agentHumanReviewOperations, getHumanReviewCommandStatus } from "@/db/agentic-access";
import { createAgentHono } from "@/hono/factory";
import { agentError, parsedUuid, requestNow } from "./agent-v1-command-helpers";

const agentHumanReviewEndpoint = createAgentHono();

agentHumanReviewEndpoint.get(agentHumanReviewOperations.commandStatus.relativePath, async (c) => {
	const commandId = parsedUuid(c.req.param("commandId"));
	if (!commandId) return c.json(commandNotFoundError(), 404);
	const result = await getHumanReviewCommandStatus(
		c.get("agenticPrincipal"),
		commandId,
		requestNow(c),
	);
	return result ? c.json(result) : c.json(commandNotFoundError(), 404);
});

function commandNotFoundError() {
	return agentError({
		code: "AGENT_COMMAND_NOT_FOUND",
		message: "Command not found",
		retryable: false,
		allowedActions: [],
		recoveryUrl: "/agent.md",
	});
}

export default agentHumanReviewEndpoint;
