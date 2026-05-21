import { z } from "zod";

export type SenderStartEnv = Env & {
	TURNSTILE_SECRET_KEY?: string;
	TURNSTILE_TEST_BYPASS?: string;
};

const TurnstileSiteVerifyResponseSchema = z.object({ success: z.boolean() }).passthrough();

export function isPdf(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 5 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46 &&
		bytes[4] === 0x2d
	);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const hash = await crypto.subtle.digest("SHA-256", buffer);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getRequestIp(
	cfConnectingIp: string | undefined,
	forwardedFor: string | undefined,
): string {
	return cfConnectingIp ?? forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}

export function parseNow(nowHeader: string | undefined): Date {
	return new Date(nowHeader ?? Date.now());
}

export async function verifyTurnstileToken(input: {
	env: SenderStartEnv;
	token: string;
	ip: string;
}): Promise<boolean> {
	if (input.env.TURNSTILE_TEST_BYPASS === "true" && input.token === "test-pass") {
		return true;
	}

	const secret = input.env.TURNSTILE_SECRET_KEY;
	if (!secret) return false;

	const form = new FormData();
	form.append("secret", secret);
	form.append("response", input.token);
	if (input.ip !== "unknown") form.append("remoteip", input.ip);

	const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
		method: "POST",
		body: form,
	});
	if (!response.ok) return false;

	const json: unknown = await response.json();
	const parsed = TurnstileSiteVerifyResponseSchema.safeParse(json);
	return parsed.success && parsed.data.success;
}
