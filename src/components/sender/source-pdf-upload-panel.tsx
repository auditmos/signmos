import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	type SourcePdfStatus,
	UploadSourcePdfForm,
	useSourcePdfQuery,
} from "./source-pdf-upload-controls";

export interface SourcePdfUploadPanelProps {
	envelopeId: string;
	senderSessionToken: string;
	senderName?: string;
	senderEmail?: string;
}

type SenderVerificationSuccess = {
	data: {
		envelopeId: string;
		sender: {
			name: string;
			email: string;
		};
	};
};

type RecipientResponse = {
	id: string;
	envelopeId: string;
	name: string;
	email: string;
};

type RecipientsSuccess = { data: RecipientResponse[] };
type ApiError = { error: { message: string } };

type RecipientFormValues = {
	senderName: string;
	senderEmail: string;
	partnerName: string;
	partnerEmail: string;
};

type RecipientsResult = { recipients: RecipientResponse[]; prepareUrl: string };

export function SourcePdfUploadPanel(props: SourcePdfUploadPanelProps) {
	return (
		<div className="space-y-5">
			<UploadSourcePdfForm {...props} />
			<AddRecipientsForm {...props} />
		</div>
	);
}

function AddRecipientsForm({
	envelopeId,
	senderSessionToken,
	senderName: verifiedSenderName = "",
	senderEmail: verifiedSenderEmail = "",
}: SourcePdfUploadPanelProps) {
	const hasSenderProps = Boolean(verifiedSenderName && verifiedSenderEmail);
	const senderQuery = useQuery({
		queryKey: ["sender-verification", envelopeId, senderSessionToken],
		queryFn: () => fetchVerifiedSender(senderSessionToken, envelopeId),
		enabled: Boolean(senderSessionToken) && !hasSenderProps,
		staleTime: Number.POSITIVE_INFINITY,
	});
	const sourcePdfQuery = useSourcePdfQuery(envelopeId, senderSessionToken);
	const sessionSender = senderQuery.data?.sender;
	const senderRecipientName = verifiedSenderName || sessionSender?.name || "";
	const senderRecipientEmail = verifiedSenderEmail || sessionSender?.email || "";
	const hasVerifiedSenderDetails = Boolean(senderRecipientName && senderRecipientEmail);
	const sourcePdfReady = sourcePdfQuery.data?.status === "ready";
	const sourcePdfError =
		sourcePdfQuery.error instanceof Error ? sourcePdfQuery.error.message : null;
	const recipientsMutation = useMutation({
		mutationFn: (values: RecipientFormValues) =>
			addRecipientPair({
				envelopeId,
				senderSessionToken,
				senderName: senderRecipientName || values.senderName,
				senderEmail: senderRecipientEmail || values.senderEmail,
				partnerName: values.partnerName,
				partnerEmail: values.partnerEmail,
			}),
	});
	const recipientsForm = useForm({
		defaultValues: {
			senderName: "",
			senderEmail: "",
			partnerName: "",
			partnerEmail: "",
		},
		onSubmit: ({ value }) => recipientsMutation.mutateAsync(value),
	});
	const recipientError =
		recipientsMutation.error instanceof Error ? recipientsMutation.error.message : null;

	return (
		<form
			aria-label="Add recipients"
			className="rounded-lg border bg-card p-5"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!sourcePdfReady) return;
				void recipientsForm.handleSubmit();
			}}
		>
			<div className="space-y-5">
				<div>
					<h2 className="font-semibold text-lg">Recipients</h2>
					<p className="text-muted-foreground text-sm">
						{hasVerifiedSenderDetails
							? "Add the partner before preparing fields."
							: "Add the sender and partner before preparing fields."}
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					{senderQuery.isLoading ? (
						<p className="text-muted-foreground text-sm sm:col-span-2">Loading sender details.</p>
					) : null}
					{hasVerifiedSenderDetails ? (
						<SenderSummary name={senderRecipientName} email={senderRecipientEmail} />
					) : (
						<>
							<recipientsForm.Field name="senderName">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="sender-name">Sender name</Label>
										<Input
											id="sender-name"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											required
										/>
									</div>
								)}
							</recipientsForm.Field>
							<recipientsForm.Field name="senderEmail">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="sender-email">Sender email</Label>
										<Input
											id="sender-email"
											type="email"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											required
										/>
									</div>
								)}
							</recipientsForm.Field>
						</>
					)}
					<recipientsForm.Field name="partnerName">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="partner-name">Partner name</Label>
								<Input
									id="partner-name"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
								/>
							</div>
						)}
					</recipientsForm.Field>
					<recipientsForm.Field name="partnerEmail">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor="partner-email">Partner email</Label>
								<Input
									id="partner-email"
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									required
								/>
							</div>
						)}
					</recipientsForm.Field>
				</div>

				{recipientError ? (
					<Alert variant="destructive" role="alert">
						<AlertTitle>Recipients failed</AlertTitle>
						<AlertDescription>{recipientError}</AlertDescription>
					</Alert>
				) : null}

				<SourcePdfRequirementAlert status={sourcePdfQuery.data} errorMessage={sourcePdfError} />

				{recipientsMutation.data ? <RecipientsAdded result={recipientsMutation.data} /> : null}

				<RecipientActions
					isPending={recipientsMutation.isPending}
					isDisabled={senderQuery.isLoading || sourcePdfQuery.isLoading || !sourcePdfReady}
					result={recipientsMutation.data}
				/>
			</div>
		</form>
	);
}

function SourcePdfRequirementAlert({
	status,
	errorMessage,
}: {
	status?: SourcePdfStatus;
	errorMessage: string | null;
}) {
	if (status?.status === "missing") {
		return (
			<Alert variant="destructive" role="alert">
				<AlertTitle>Source PDF required</AlertTitle>
				<AlertDescription>{status.message}</AlertDescription>
			</Alert>
		);
	}
	if (errorMessage) {
		return (
			<Alert variant="destructive" role="alert">
				<AlertTitle>Source PDF check failed</AlertTitle>
				<AlertDescription>{errorMessage}</AlertDescription>
			</Alert>
		);
	}
	return null;
}

function RecipientActions({
	isPending,
	isDisabled,
	result,
}: {
	isPending: boolean;
	isDisabled: boolean;
	result?: RecipientsResult;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button type="submit" disabled={isPending || isDisabled}>
				<UserPlus className="mr-2 size-4" />
				{isPending ? "Adding..." : "Add recipients"}
			</Button>
			{result ? (
				<Button asChild variant="outline">
					<a href={result.prepareUrl}>
						Continue to prepare fields
						<ArrowRight className="ml-2 size-4" />
					</a>
				</Button>
			) : null}
		</div>
	);
}

function SenderSummary({ name, email }: { name: string; email: string }) {
	return (
		<div className="space-y-1 rounded-md border bg-muted/30 p-3 sm:col-span-2">
			<p className="font-medium text-sm">Sender</p>
			<p className="text-sm">{name}</p>
			<p className="text-muted-foreground text-sm">{email}</p>
		</div>
	);
}

function RecipientsAdded({ result }: { result: RecipientsResult }) {
	return (
		<Alert>
			<AlertTitle>Recipients added</AlertTitle>
			<AlertDescription>
				{result.recipients[0]?.email} and {result.recipients[1]?.email}
			</AlertDescription>
		</Alert>
	);
}

function isSenderVerificationSuccess(value: unknown): value is SenderVerificationSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return Boolean(data && typeof data === "object" && "sender" in data);
}

function isRecipientsSuccess(value: unknown): value is RecipientsSuccess {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	return Array.isArray(value.data);
}

function isApiError(value: unknown): value is ApiError {
	if (!value || typeof value !== "object" || !("error" in value)) return false;
	const error = value.error;
	return Boolean(error && typeof error === "object" && "message" in error);
}

async function fetchVerifiedSender(
	senderSessionToken: string,
	envelopeId: string,
): Promise<SenderVerificationSuccess["data"]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/sender-session`, {
		headers: { "x-sender-session-token": senderSessionToken },
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isSenderVerificationSuccess(json) || json.data.envelopeId !== envelopeId) {
		throw new Error("Unable to load sender details");
	}
	return json.data;
}

async function addRecipientPair(input: {
	envelopeId: string;
	senderSessionToken: string;
	senderName: string;
	senderEmail: string;
	partnerName: string;
	partnerEmail: string;
}): Promise<RecipientsResult> {
	const response = await fetch(`/api/envelopes/${input.envelopeId}/recipients`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-sender-session-token": input.senderSessionToken,
		},
		body: JSON.stringify({
			recipients: [
				{ name: input.senderName, email: input.senderEmail },
				{ name: input.partnerName, email: input.partnerEmail },
			],
		}),
	});
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok || !isRecipientsSuccess(json) || json.data.length < 2) {
		const message = isApiError(json) ? json.error.message : "Unable to add recipients";
		throw new Error(message);
	}
	return {
		recipients: json.data,
		prepareUrl: buildPrepareUrl(input.envelopeId, input.senderSessionToken, json.data),
	};
}

function buildPrepareUrl(
	envelopeId: string,
	senderSessionToken: string,
	recipients: RecipientResponse[],
): string {
	const [sender, partner] = recipients;
	if (!sender || !partner) return "/envelope-fields";
	const params = new URLSearchParams({
		envelopeId,
		recipientId: sender.id,
		name: sender.name,
		email: sender.email,
		partnerRecipientId: partner.id,
		partnerName: partner.name,
		partnerEmail: partner.email,
		senderSessionToken,
	});
	return `/envelope-fields?${params.toString()}`;
}
