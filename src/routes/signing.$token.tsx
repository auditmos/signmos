import { createFileRoute } from "@tanstack/react-router";
import { SignerPage } from "@/components/signing/signer-page";

export const Route = createFileRoute("/signing/$token")({
	component: SigningRoute,
});

function SigningRoute() {
	const { token } = Route.useParams();
	return <SignerPage token={token} />;
}
