import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentHistoryPanel } from "./document-history-panel";
import {
	addRecipientPair,
	buildPrepareUrl,
	deleteRecipientRequest,
	fetchRecipients,
	fetchVerifiedSender,
	findSenderRecipient,
	isRecipientActionDisabled,
	type RecipientFormValues,
	type RecipientResponse,
	recipientsQueryKey,
	updateRecipientRequest,
} from "./source-pdf-recipients";
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
	signingMode?: "only_me" | "me_and_another_signer";
}

export function SourcePdfUploadPanel(props: SourcePdfUploadPanelProps) {
	return (
		<div className="space-y-5">
			<UploadSourcePdfForm {...props} />
			{props.signingMode === "only_me" ? null : <AddRecipientsForm {...props} />}
			<DocumentHistoryPanel
				envelopeId={props.envelopeId}
				senderSessionToken={props.senderSessionToken}
			/>
		</div>
	);
}

function AddRecipientsForm({
	envelopeId,
	senderSessionToken,
	senderName: verifiedSenderName = "",
	senderEmail: verifiedSenderEmail = "",
}: SourcePdfUploadPanelProps) {
	const queryClient = useQueryClient();
	const [isEditingPartner, setIsEditingPartner] = useState(false);
	const hasSenderProps = hasSenderDetails(verifiedSenderName, verifiedSenderEmail);
	const senderQuery = useQuery({
		queryKey: ["sender-verification", envelopeId, senderSessionToken],
		queryFn: () => fetchVerifiedSender(senderSessionToken, envelopeId),
		enabled: shouldFetchVerifiedSender(senderSessionToken, hasSenderProps),
		staleTime: Number.POSITIVE_INFINITY,
	});
	const sourcePdfQuery = useSourcePdfQuery(envelopeId, senderSessionToken);
	const sessionSender = senderQuery.data?.sender;
	const senderRecipientName = verifiedSenderName || sessionSender?.name || "";
	const senderRecipientEmail = verifiedSenderEmail || sessionSender?.email || "";
	const hasVerifiedSenderDetails = hasSenderDetails(senderRecipientName, senderRecipientEmail);
	const sourcePdfReady = sourcePdfQuery.data?.status === "ready";
	const sourcePdfError =
		sourcePdfQuery.error instanceof Error ? sourcePdfQuery.error.message : null;
	const recipientsQuery = useQuery({
		queryKey: recipientsQueryKey(envelopeId, senderSessionToken),
		queryFn: () => fetchRecipients(envelopeId, senderSessionToken),
		enabled: shouldFetchRecipients(envelopeId, senderSessionToken, sourcePdfReady),
		staleTime: 30_000,
	});
	const recipientsMutation = useMutation({
		mutationFn: (values: RecipientFormValues) =>
			addRecipientPair({
				envelopeId,
				senderSessionToken,
				existingRecipients: currentRecipients,
				senderName: senderRecipientName || values.senderName,
				senderEmail: senderRecipientEmail || values.senderEmail,
				partnerName: values.partnerName,
				partnerEmail: values.partnerEmail,
			}),
		onSuccess: (result) => {
			queryClient.setQueryData(
				recipientsQueryKey(envelopeId, senderSessionToken),
				result.recipients,
			);
		},
	});
	const updateMutation = useMutation({
		mutationFn: (values: RecipientFormValues) => {
			if (!partnerRecipient) throw new Error("Recipient is missing");
			return updateRecipientRequest({
				envelopeId,
				senderSessionToken,
				recipientId: partnerRecipient.id,
				name: values.partnerName,
				email: values.partnerEmail,
			});
		},
		onSuccess: (recipient) => {
			queryClient.setQueryData<RecipientResponse[]>(
				recipientsQueryKey(envelopeId, senderSessionToken),
				(existing = []) => replaceRecipient(existing, recipient),
			);
			setIsEditingPartner(false);
		},
	});
	const deleteMutation = useMutation({
		mutationFn: (recipientId: string) =>
			deleteRecipientRequest({ envelopeId, senderSessionToken, recipientId }),
		onSuccess: (recipient) => {
			queryClient.setQueryData<RecipientResponse[]>(
				recipientsQueryKey(envelopeId, senderSessionToken),
				(existing = []) => removeRecipient(existing, recipient.id),
			);
			setIsEditingPartner(false);
		},
	});
	const recipientsForm = useForm({
		defaultValues: {
			senderName: "",
			senderEmail: "",
			partnerName: "",
			partnerEmail: "",
		},
		onSubmit: ({ value }) =>
			submitRecipientForm(
				value,
				Boolean(isEditingPartner && partnerRecipient),
				updateMutation.mutateAsync,
				recipientsMutation.mutateAsync,
			),
	});
	const recipientError = firstErrorMessage(
		recipientsMutation.error,
		updateMutation.error,
		deleteMutation.error,
	);
	const currentRecipients = recipientsQuery.data ?? [];
	const senderRecipient = findSenderRecipient(currentRecipients, senderRecipientEmail);
	const partnerRecipient = findPartnerRecipient(currentRecipients, senderRecipient);
	const { prepareRecipients, prepareUrl } = buildPrepareDetails(
		envelopeId,
		senderSessionToken,
		senderRecipient,
		partnerRecipient,
	);
	const isMutating = hasPendingMutation(
		recipientsMutation.isPending,
		updateMutation.isPending,
		deleteMutation.isPending,
	);
	const canSubmit = canSubmitRecipientForm(sourcePdfReady, partnerRecipient, isEditingPartner);

	return (
		<form
			aria-label="Add recipients"
			className="rounded-lg border bg-card p-5"
			onSubmit={(event) => {
				handleRecipientSubmit(event, canSubmit, recipientsForm.handleSubmit);
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
					{recipientsQuery.isLoading ? (
						<p className="text-muted-foreground text-sm sm:col-span-2">Loading recipients.</p>
					) : null}
					{partnerRecipient && !isEditingPartner ? (
						<PartnerSummary
							recipient={partnerRecipient}
							isPending={isMutating}
							onEdit={() => {
								recipientsForm.setFieldValue("partnerName", partnerRecipient.name);
								recipientsForm.setFieldValue("partnerEmail", partnerRecipient.email);
								setIsEditingPartner(true);
							}}
							onDelete={() => deleteMutation.mutate(partnerRecipient.id)}
						/>
					) : (
						<>
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
						</>
					)}
				</div>

				{recipientError ? (
					<Alert variant="destructive" role="alert">
						<AlertTitle>Recipients failed</AlertTitle>
						<AlertDescription>{recipientError}</AlertDescription>
					</Alert>
				) : null}

				<SourcePdfRequirementAlert status={sourcePdfQuery.data} errorMessage={sourcePdfError} />

				{partnerRecipient ? (
					<RecipientsAdded recipients={prepareRecipients} prepareUrl={prepareUrl} />
				) : null}

				<RecipientActions
					isPending={isMutating}
					isDisabled={isRecipientActionDisabled({
						isSenderLoading: senderQuery.isLoading,
						isSourcePdfLoading: sourcePdfQuery.isLoading,
						isRecipientsLoading: recipientsQuery.isLoading,
						sourcePdfReady,
						partnerRecipient,
						isEditingPartner,
					})}
					isEditing={Boolean(isEditingPartner && partnerRecipient)}
					prepareUrl={prepareUrl}
				/>
			</div>
		</form>
	);
}

function hasSenderDetails(name: string, email: string) {
	return Boolean(name && email);
}

function shouldFetchVerifiedSender(senderSessionToken: string, hasSenderProps: boolean) {
	return Boolean(senderSessionToken) && !hasSenderProps;
}

function shouldFetchRecipients(
	envelopeId: string,
	senderSessionToken: string,
	sourcePdfReady: boolean,
) {
	return Boolean(envelopeId && senderSessionToken && sourcePdfReady);
}

function replaceRecipient(existing: RecipientResponse[], recipient: RecipientResponse) {
	return existing.map((current) => (current.id === recipient.id ? recipient : current));
}

function removeRecipient(existing: RecipientResponse[], recipientId: string) {
	return existing.filter((current) => current.id !== recipientId);
}

function submitRecipientForm(
	values: RecipientFormValues,
	isEditingPartner: boolean,
	updateRecipient: (values: RecipientFormValues) => Promise<RecipientResponse>,
	addRecipients: (values: RecipientFormValues) => Promise<{ recipients: RecipientResponse[] }>,
) {
	return isEditingPartner ? updateRecipient(values) : addRecipients(values);
}

function firstErrorMessage(...errors: unknown[]) {
	for (const error of errors) {
		if (error instanceof Error) return error.message;
	}
	return null;
}

function findPartnerRecipient(
	recipients: RecipientResponse[],
	senderRecipient: RecipientResponse | null,
) {
	return recipients.find((recipient) => recipient.id !== senderRecipient?.id) ?? null;
}

function buildPrepareDetails(
	envelopeId: string,
	senderSessionToken: string,
	senderRecipient: RecipientResponse | null,
	partnerRecipient: RecipientResponse | null,
) {
	if (!senderRecipient || !partnerRecipient) {
		return { prepareRecipients: [], prepareUrl: null };
	}
	const prepareRecipients = [senderRecipient, partnerRecipient];
	return {
		prepareRecipients,
		prepareUrl: buildPrepareUrl(envelopeId, senderSessionToken, prepareRecipients),
	};
}

function hasPendingMutation(...pendingStates: boolean[]) {
	return pendingStates.some(Boolean);
}

function canSubmitRecipientForm(
	sourcePdfReady: boolean,
	partnerRecipient: RecipientResponse | null,
	isEditingPartner: boolean,
) {
	return sourcePdfReady && (!partnerRecipient || isEditingPartner);
}

function handleRecipientSubmit(
	event: FormEvent<HTMLFormElement>,
	canSubmit: boolean,
	handleSubmit: () => Promise<void>,
) {
	event.preventDefault();
	event.stopPropagation();
	if (canSubmit) void handleSubmit();
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
	isEditing,
	prepareUrl,
}: {
	isPending: boolean;
	isDisabled: boolean;
	isEditing: boolean;
	prepareUrl: string | null;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button type="submit" disabled={isPending || isDisabled}>
				<UserPlus className="mr-2 size-4" />
				{isPending ? "Saving..." : isEditing ? "Save recipient" : "Add recipients"}
			</Button>
			{prepareUrl ? (
				<Button asChild variant="outline">
					<a href={prepareUrl}>
						Continue to prepare fields
						<ArrowRight className="ml-2 size-4" />
					</a>
				</Button>
			) : null}
		</div>
	);
}

function PartnerSummary({
	recipient,
	isPending,
	onEdit,
	onDelete,
}: {
	recipient: RecipientResponse;
	isPending: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<div className="space-y-3 rounded-md border bg-muted/30 p-3 sm:col-span-2">
			<div>
				<p className="font-medium text-sm">Partner</p>
				<p className="text-sm">{recipient.name}</p>
				<p className="text-muted-foreground text-sm">{recipient.email}</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={isPending}>
					<Pencil className="mr-2 size-4" />
					Edit recipient
				</Button>
				<Button type="button" size="sm" variant="outline" onClick={onDelete} disabled={isPending}>
					<Trash2 className="mr-2 size-4" />
					Delete recipient
				</Button>
			</div>
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

function RecipientsAdded({
	recipients,
	prepareUrl,
}: {
	recipients: RecipientResponse[];
	prepareUrl: string | null;
}) {
	const [sender, partner] = recipients;
	return (
		<Alert>
			<AlertTitle>Recipients added</AlertTitle>
			<AlertDescription>
				{sender?.email} and {partner?.email}
				{prepareUrl ? null : ". Add a partner before preparing fields."}
			</AlertDescription>
		</Alert>
	);
}
