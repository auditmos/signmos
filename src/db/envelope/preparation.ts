import { eq } from "drizzle-orm";
import { getDb } from "@/db/setup";
import { addFields } from "./queries";
import {
	type DefaultFieldPlacementRequest,
	type EnvelopeField,
	type FieldCreateInput,
	type SignatureProfile,
	type SignatureProfileCreateRequest,
	SignatureProfileSchema,
} from "./schema";
import { envelopes, signatureProfiles } from "./table";

const defaultSignatureField = {
	x: 360,
	y: 628,
	width: 180,
	height: 48,
} as const;
const defaultDateField = {
	x: 420,
	y: 688,
	width: 120,
	height: 32,
} as const;
const defaultRecipientStackOffset = 116;

export async function createSignatureProfile(input: {
	envelopeId: string;
	createdBy: string;
	profile: SignatureProfileCreateRequest;
}): Promise<SignatureProfile> {
	const db = getDb();
	const [envelope] = await db
		.select()
		.from(envelopes)
		.where(eq(envelopes.id, input.envelopeId))
		.limit(1);
	if (!envelope) throw new Error("Envelope not found");

	const [profile] = await db
		.insert(signatureProfiles)
		.values({
			envelopeId: input.envelopeId,
			createdBy: input.createdBy,
			kind: input.profile.kind,
			label: input.profile.label,
			svgPath: input.profile.kind === "drawn" ? input.profile.svgPath : null,
			typedText: input.profile.kind === "typed" ? input.profile.typedText : null,
			typedFont: input.profile.kind === "typed" ? input.profile.typedFont : null,
			selected: input.profile.selected,
		})
		.returning();
	if (!profile) throw new Error("Failed to create signature profile");
	return SignatureProfileSchema.parse(profile);
}

export async function createDefaultFieldPlacements(input: {
	envelopeId: string;
	request: DefaultFieldPlacementRequest;
}): Promise<EnvelopeField[]> {
	return addFields(input.envelopeId, {
		fields: buildDefaultFieldPlacements(input.request),
	});
}

function buildDefaultFieldPlacements(request: DefaultFieldPlacementRequest): FieldCreateInput[] {
	return request.recipientIds.flatMap((recipientId, index) => {
		const yOffset = index * defaultRecipientStackOffset;
		return [
			{
				recipientId,
				type: "signature",
				page: request.page,
				x: defaultSignatureField.x,
				y: defaultSignatureField.y - yOffset,
				width: defaultSignatureField.width,
				height: defaultSignatureField.height,
			},
			{
				recipientId,
				type: "date",
				page: request.page,
				x: defaultDateField.x,
				y: defaultDateField.y - yOffset,
				width: defaultDateField.width,
				height: defaultDateField.height,
			},
		];
	});
}
