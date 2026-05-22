import type { Context } from "hono";
import {
	createDefaultFieldPlacements,
	createSignatureProfile,
	DefaultFieldPlacementRequestSchema,
	getLatestSelectedSignatureProfile,
	resolveVerifiedSenderSession,
	SignatureProfileCreateRequestSchema,
	toEnvelopeFieldResponse,
	toSignatureProfileResponse,
} from "@/db/envelope";
import { createHono } from "@/hono/factory";

const envelopePreparationEndpoint = createHono();

envelopePreparationEndpoint.post("/:id/signature-profiles", async (c) => {
	const createdBy = await getEnvelopeActor(c, c.req.param("id"));
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

envelopePreparationEndpoint.get("/:id/signature-profiles/selected", async (c) => {
	const createdBy = await getEnvelopeActor(c, c.req.param("id"));
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

	const profile = await getLatestSelectedSignatureProfile(createdBy);
	return c.json({ data: profile ? toSignatureProfileResponse(profile) : null });
});

envelopePreparationEndpoint.post("/:id/fields/defaults", async (c) => {
	const userId = await getEnvelopeActor(c, c.req.param("id"));
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

async function getEnvelopeActor(
	c: Context<{ Bindings: Env }>,
	envelopeId: string,
): Promise<string | null> {
	const internalUserId = c.req.header("x-internal-user-id");
	if (internalUserId) return internalUserId;
	const senderSessionToken = c.req.header("x-sender-session-token");
	if (!senderSessionToken) return null;
	const session = await resolveVerifiedSenderSession(
		senderSessionToken,
		envelopeId,
		new Date(c.req.header("x-now") ?? Date.now()),
	);
	return session?.email ?? null;
}
