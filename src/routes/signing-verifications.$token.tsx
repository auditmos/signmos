import { createFileRoute } from "@tanstack/react-router";
import { SigningVerificationPage } from "@/components/signing/signing-verification-page";

export const Route = createFileRoute("/signing-verifications/$token")({
	component: SigningVerificationRoute,
});

function SigningVerificationRoute() {
	const { token } = Route.useParams();
	return <SigningVerificationPage token={token} />;
}
