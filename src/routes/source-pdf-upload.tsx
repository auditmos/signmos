import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SourcePdfUploadPanel } from "@/components/sender/source-pdf-upload-panel";

export const Route = createFileRoute("/source-pdf-upload")({
	validateSearch: z.object({
		envelopeId: z.string().optional(),
		senderSessionToken: z.string().optional(),
		senderName: z.string().optional(),
		senderEmail: z.string().optional(),
		signingMode: z.enum(["only_me", "me_and_another_signer"]).optional(),
		historyAccess: z.literal("true").optional(),
	}),
	component: SourcePdfUploadRoute,
});

function SourcePdfUploadRoute() {
	const search = Route.useSearch();
	const envelopeId = search.envelopeId ?? "";
	const senderSessionToken = search.senderSessionToken ?? "";
	const senderName = search.senderName ?? "";
	const senderEmail = search.senderEmail ?? "";
	const signingMode = search.signingMode ?? "me_and_another_signer";

	return (
		<main className="min-h-dvh bg-background p-6">
			<div className="mx-auto max-w-3xl space-y-6">
				<div>
					<h1 className="text-2xl font-semibold">Source PDF</h1>
					<p className="text-sm text-muted-foreground">
						Upload the PDF that will be prepared for signing.
					</p>
				</div>
				<SourcePdfUploadPanel
					envelopeId={envelopeId}
					senderSessionToken={senderSessionToken}
					senderName={senderName}
					senderEmail={senderEmail}
					signingMode={signingMode}
					historyAccess={search.historyAccess === "true"}
				/>
			</div>
		</main>
	);
}
