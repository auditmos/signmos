import { createFileRoute } from "@tanstack/react-router";
import { AgenticAccessBootstrap } from "@/components/agentic/agentic-access-bootstrap";

export const Route = createFileRoute("/agentic-access")({
	component: AgenticAccessBootstrap,
});
