import { getDb } from "@/db/setup";
import { hashAgenticCredential } from "./request";
import { appendAgenticSecurityEvent } from "./security-audit";
import { agenticApiTokens } from "./table";

const tokenSecretBytes = 32;

export interface GeneratedAgenticToken {
	secret: string;
	token: {
		id: string;
		name: string;
		hint: string;
		createdAt: string;
	};
}

export async function generateAgenticToken(input: {
	session: { id: string; email: string };
	name: string;
	requestIp?: string;
}): Promise<GeneratedAgenticToken> {
	const name = input.name.trim();
	const secretBytes = new Uint8Array(tokenSecretBytes);
	crypto.getRandomValues(secretBytes);
	const secretSuffix = toBase64Url(secretBytes);
	const secret = `signmos_${secretSuffix}`;
	const tokenHash = await hashAgenticCredential(secret);
	const tokenHint = `signmos_…${secretSuffix.slice(-4)}`;
	const rows = await getDb()
		.insert(agenticApiTokens)
		.values({
			email: input.session.email,
			name,
			tokenHash,
			tokenHint,
			status: "active",
		})
		.returning();
	const token = rows[0];
	if (!token) throw new Error("Agentic token was not created");
	await appendAgenticSecurityEvent({
		sessionId: input.session.id,
		tokenId: token.id,
		tokenName: token.name,
		email: token.email,
		eventType: "agentic.token.created",
		actorType: "browser",
		requestIp: input.requestIp,
	});
	return {
		secret,
		token: {
			id: token.id,
			name: token.name,
			hint: token.tokenHint,
			createdAt: token.createdAt.toISOString(),
		},
	};
}

function toBase64Url(bytes: Uint8Array): string {
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
