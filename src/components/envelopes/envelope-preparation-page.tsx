import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import { SignatureProfilePanel } from "@/components/sender/signature-profile-panel";
import { Button } from "@/components/ui/button";
import { EnvelopeFieldEditor } from "./field-editor";

export interface PreparationRecipient {
	id: string;
	name: string;
	email: string;
}

interface EnvelopePreparationPageProps {
	envelopeId?: string;
	recipients?: PreparationRecipient[];
}

type PreparationState = {
	envelopeId: string;
	recipients: PreparationRecipient[];
};

type EnvelopeCreateResponse = {
	data?: {
		id?: string;
	};
};

type RecipientsCreateResponse = {
	data?: PreparationRecipient[];
};

const defaultSender = {
	name: "Ada Lovelace",
	emailPrefix: "ada",
};
const defaultPartner = {
	name: "Grace Hopper",
	emailPrefix: "grace",
};

export function EnvelopePreparationPage({ envelopeId, recipients }: EnvelopePreparationPageProps) {
	const [preparation, setPreparation] = useState<PreparationState | null>(
		envelopeId && recipients && recipients.length >= 2 ? { envelopeId, recipients } : null,
	);
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function createReviewEnvelope() {
		setIsCreating(true);
		setError(null);
		try {
			const createdEnvelope = await postJson<EnvelopeCreateResponse>("/api/envelopes", {});
			const createdEnvelopeId = createdEnvelope.data?.id;
			if (!createdEnvelopeId) throw new Error("Envelope response missing id");

			const suffix = Date.now();
			const createdRecipients = await postJson<RecipientsCreateResponse>(
				`/api/envelopes/${createdEnvelopeId}/recipients`,
				{
					recipients: [
						{
							name: defaultSender.name,
							email: `${defaultSender.emailPrefix}.${suffix}@example.com`,
						},
						{
							name: defaultPartner.name,
							email: `${defaultPartner.emailPrefix}.${suffix}@example.com`,
						},
					],
				},
			);
			const reviewRecipients = createdRecipients.data;
			if (!reviewRecipients || reviewRecipients.length < 2) {
				throw new Error("Recipient response missing recipients");
			}
			setPreparation({ envelopeId: createdEnvelopeId, recipients: reviewRecipients });
		} catch {
			setError("Unable to create a review envelope.");
		} finally {
			setIsCreating(false);
		}
	}

	return (
		<div className="min-h-dvh bg-background p-6">
			<div className="mx-auto max-w-5xl space-y-6">
				<div>
					<h1 className="text-balance font-semibold text-2xl">Envelope preparation</h1>
					<p className="text-muted-foreground text-pretty text-sm">
						Create a sender signature profile and place fields for each signer.
					</p>
				</div>
				{preparation ? (
					<>
						<SignatureProfilePanel envelopeId={preparation.envelopeId} />
						<EnvelopeFieldEditor
							envelopeId={preparation.envelopeId}
							recipients={preparation.recipients}
						/>
					</>
				) : (
					<section className="rounded-lg border bg-card p-5 shadow-sm">
						<div className="mb-4">
							<h2 className="text-balance font-semibold text-lg">Review setup</h2>
							<p className="text-muted-foreground text-pretty text-sm">
								Create a draft review envelope before saving signatures or fields.
							</p>
						</div>
						<Button type="button" onClick={createReviewEnvelope} disabled={isCreating}>
							<FilePlus2 className="size-4" />
							{isCreating ? "Creating..." : "Create review envelope"}
						</Button>
						{error && <p className="mt-3 text-destructive text-sm">{error}</p>}
					</section>
				)}
			</div>
		</div>
	);
}

async function postJson<TResponse>(url: string, body: unknown): Promise<TResponse> {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-internal-user-id": "ui-user",
		},
		body: JSON.stringify(body),
	});
	if (!response.ok) throw new Error("Request failed");
	return (await response.json()) as TResponse;
}
