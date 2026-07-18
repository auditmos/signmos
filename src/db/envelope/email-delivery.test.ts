import { isResendConfigured } from "./email-delivery";

const configured = {
	RESEND_API_KEY: "re_configured",
	RESEND_FROM_EMAIL: "signing@signmos.test",
	RESEND_REPLY_TO_EMAIL: "reply@signmos.test",
};

describe("development email delivery fixture", () => {
	it("allows an explicit non-production fallback without weakening production delivery", () => {
		expect(
			isResendConfigured({
				...configured,
				CLOUDFLARE_ENV: "development",
				EMAIL_DELIVERY_TEST_BYPASS: "true",
			}),
		).toBe(false);
		expect(
			isResendConfigured({
				...configured,
				CLOUDFLARE_ENV: "production",
				EMAIL_DELIVERY_TEST_BYPASS: "true",
			}),
		).toBe(true);
	});
});
