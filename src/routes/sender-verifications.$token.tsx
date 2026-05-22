import { createFileRoute } from "@tanstack/react-router";
import { SenderVerificationPage } from "@/components/sender/sender-verification-page";

export const Route = createFileRoute("/sender-verifications/$token")({
	component: SenderVerificationRoute,
});

function SenderVerificationRoute() {
	const { token } = Route.useParams();
	return <SenderVerificationPage token={token} />;
}
