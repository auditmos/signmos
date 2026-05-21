import {
	createDefaultFieldPlacements,
	createSignatureProfile,
	DefaultFieldPlacementRequestSchema,
	SignatureProfileCreateRequestSchema,
	toEnvelopeFieldResponse,
	toSignatureProfileResponse,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const envelopePreparationEndpoint = createHono();

envelopePreparationEndpoint.post("/:id/signature-profiles", async (c) => {
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

	const parsed = SignatureProfileCreateRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_SIGNATURE_PROFILE",
					message: "Signature profile must be drawn or typed with a renderable value",
					validKinds: ["drawn", "typed"],
				},
			},
			400,
		);
	}

	const profile = await createSignatureProfile({
		envelopeId: c.req.param("id"),
		createdBy,
		profile: parsed.data,
	});
	return c.json({ data: toSignatureProfileResponse(profile) }, 201);
});

envelopePreparationEndpoint.post("/:id/fields/defaults", async (c) => {
	const userId = c.req.header("x-internal-user-id");
	if (!userId) {
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

	const parsed = DefaultFieldPlacementRequestSchema.safeParse(await c.req.json());
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_DEFAULT_FIELDS",
					message: "Default placement requires 1 to 10 recipient IDs",
					validFieldTypes: ["signature", "date"],
					allowedActions: ["add_fields"],
				},
			},
			400,
		);
	}

	const fields = await createDefaultFieldPlacements({
		envelopeId: c.req.param("id"),
		request: parsed.data,
	});
	return c.json({ data: fields.map(toEnvelopeFieldResponse) }, 201);
});

export default envelopePreparationEndpoint;
