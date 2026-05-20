import {
	createEnvelope,
	EnvelopeActionRequestSchema,
	envelopeLifecycleActions,
	toEnvelopeResponse,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const envelopesEndpoint = createHono();

envelopesEndpoint.post("/", async (c) => {
	const createdBy = c.req.header("x-internal-user-id");
	if (!createdBy) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Missing x-internal-user-id header",
				},
			},
			401,
		);
	}

	const result = await createEnvelope({
		createdBy,
		idempotencyKey: c.req.header("idempotency-key") ?? undefined,
	});

	return c.json({ data: toEnvelopeResponse(result.envelope) }, result.reused ? 200 : 201);
});

envelopesEndpoint.post("/:id/actions", async (c) => {
	const body = await c.req.json();
	const parsed = EnvelopeActionRequestSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_ACTION",
					message: "Invalid envelope lifecycle action",
					validValues: [...envelopeLifecycleActions],
				},
			},
			400,
		);
	}

	return c.json(
		{
			error: {
				code: "ACTION_NOT_IMPLEMENTED",
				message: "Envelope lifecycle action is not implemented in this slice",
				validValues: [...envelopeLifecycleActions],
			},
		},
		501,
	);
});

export default envelopesEndpoint;
