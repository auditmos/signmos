import { createFileRoute } from "@tanstack/react-router";
import { SignerPage } from "@/components/signing/signer-page";

export const Route = createFileRoute("/my-documents/$envelopeId/sign")({
	component: RecoveredSignerRoute,
});

function RecoveredSignerRoute() {
	const { envelopeId } = Route.useParams();
	return <SignerPage historyEnvelopeId={envelopeId} />;
}
