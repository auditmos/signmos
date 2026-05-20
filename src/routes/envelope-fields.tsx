import { createFileRoute } from "@tanstack/react-router";
import { EnvelopeFieldEditor } from "@/components/envelopes/field-editor";

export const Route = createFileRoute("/envelope-fields")({
	component: EnvelopeFieldsRoute,
});

function EnvelopeFieldsRoute() {
	return (
		<div className="min-h-screen bg-background p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<div>
					<h1 className="text-2xl font-semibold">Envelope fields</h1>
					<p className="text-sm text-muted-foreground">
						Place signature and date fields with page coordinates.
					</p>
				</div>
				<EnvelopeFieldEditor
					envelopeId="00000000-0000-4000-8000-000000000001"
					recipients={[
						{
							id: "20000000-0000-4000-8000-000000000001",
							name: "Ada Lovelace",
							email: "ada@example.com",
						},
					]}
				/>
			</div>
		</div>
	);
}
