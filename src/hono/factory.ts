import { Hono } from "hono";
import type { AgenticPrincipal } from "@/db/agentic-access";

export const createHono = () => new Hono<{ Bindings: Env }>();

export const createAgentHono = () =>
	new Hono<{ Bindings: Env; Variables: { agenticPrincipal: AgenticPrincipal } }>();
