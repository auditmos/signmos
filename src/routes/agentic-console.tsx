import { createFileRoute } from "@tanstack/react-router";
import { AgenticTokenConsole } from "@/components/agentic/agentic-token-console";

export const Route = createFileRoute("/agentic-console")({
	component: AgenticTokenConsole,
});
