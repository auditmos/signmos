import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { EnvelopeFieldEditor } from "@/components/envelopes/field-editor";

export const Route = createFileRoute("/envelope-fields")({
	validateSearch: z.object({
		envelopeId: z.string().optional(),
		recipientId: z.string().optional(),
		name: z.string().optional(),
		email: z.string().optional(),
	}),
	component: EnvelopeFieldsRoute,
});

function EnvelopeFieldsRoute() {
	const search = Route.useSearch();
	const envelopeId = search.envelopeId ?? "00000000-0000-4000-8000-000000000001";
	const recipient = {
		id: search.recipientId ?? "20000000-0000-4000-8000-000000000001",
		name: search.name ?? "Ada Lovelace",
		email: search.email ?? "ada@example.com",
	};

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<div>
					<h1 className="text-2xl font-semibold">Envelope fields</h1>
					<p className="text-sm text-muted-foreground">
						Place signature and date fields with page coordinates.
					</p>
				</div>
				<EnvelopeFieldEditor envelopeId={envelopeId} recipients={[recipient]} />
			</div>
		</div>
	);
}
