import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EnvelopePreparationPage } from "@/components/envelopes/envelope-preparation-page";

export const Route = createFileRoute("/envelope-fields")({
	validateSearch: z.object({
		envelopeId: z.string().optional(),
		recipientId: z.string().optional(),
		name: z.string().optional(),
		email: z.string().optional(),
		partnerRecipientId: z.string().optional(),
		partnerName: z.string().optional(),
		partnerEmail: z.string().optional(),
		senderSessionToken: z.string().optional(),
	}),
	component: EnvelopeFieldsRoute,
});

function EnvelopeFieldsRoute() {
	const search = Route.useSearch();
	const hasReviewEnvelope =
		search.envelopeId &&
		search.recipientId &&
		search.name &&
		search.email &&
		search.partnerRecipientId &&
		search.partnerName &&
		search.partnerEmail;

	return (
		<EnvelopePreparationPage
			envelopeId={search.envelopeId}
			senderSessionToken={search.senderSessionToken}
			recipients={
				hasReviewEnvelope
					? [
							{
								id: search.recipientId,
								name: search.name,
								email: search.email,
							},
							{
								id: search.partnerRecipientId,
								name: search.partnerName,
								email: search.partnerEmail,
							},
						]
					: undefined
			}
		/>
	);
}
