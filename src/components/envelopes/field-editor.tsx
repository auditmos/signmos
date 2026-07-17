import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import type { MouseEvent, PointerEvent } from "react";
import { useRef } from "react";
import {
	buildNextSignatureField,
	type EnvelopeFieldResponse,
	type FieldEditorRecipient,
	FieldPlacementWorkspace,
	type PlacedField,
	pdfPage,
	signatureDimensions,
} from "./field-placement-workspace";

interface EnvelopeFieldEditorProps {
	envelopeId: string;
	recipients: FieldEditorRecipient[];
	senderSessionToken?: string;
	historyAccess?: boolean;
}

const defaultFieldValues: PlacedField = {
	recipientId: "",
	type: "signature",
	page: 1,
	x: 72,
	y: 144,
	width: signatureDimensions.width,
	height: signatureDimensions.height,
};

export function EnvelopeFieldEditor({
	envelopeId,
	recipients,
	senderSessionToken,
	historyAccess = false,
}: EnvelopeFieldEditorProps) {
	const previewRef = useRef<HTMLFieldSetElement | null>(null);
	const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
	const queryClient = useQueryClient();
	const fieldsQuery = useQuery({
		queryKey: fieldQueryKey(envelopeId, senderSessionToken, historyAccess),
		queryFn: () => fetchFields(envelopeId, senderSessionToken, historyAccess),
		staleTime: 30_000,
	});
	const placedFields = fieldsQuery.data ?? [];
	const signatureRecipientIds = new Set(
		placedFields.filter((field) => field.type === "signature").map((field) => field.recipientId),
	);
	const allSignaturesPlaced =
		recipients.length > 0 &&
		recipients.every((recipient) => signatureRecipientIds.has(recipient.id));
	const saveMutation = useMutation({
		mutationFn: (field: PlacedField) =>
			saveField(envelopeId, senderSessionToken, field, historyAccess),
		onSuccess: (fields) => {
			queryClient.setQueryData<EnvelopeFieldResponse[]>(
				fieldQueryKey(envelopeId, senderSessionToken, historyAccess),
				(existing = []) => [...existing, ...fields],
			);
		},
	});
	const form = useForm({
		defaultValues: {
			...defaultFieldValues,
			recipientId: recipients[0]?.id ?? defaultFieldValues.recipientId,
		},
		onSubmit: async ({ value }) => {
			const field = buildNextSignatureField(value, recipients, signatureRecipientIds, placedFields);
			if (!field) return;
			await saveMutation.mutateAsync(field);
		},
	});

	function startDragging(
		event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>,
		field: PlacedField,
	) {
		const point = pointFromPreview(event, previewRef.current);
		dragOffsetRef.current = {
			x: point.x - field.x,
			y: point.y - field.y,
		};
		if ("pointerId" in event) event.currentTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}

	function continueDragging(
		event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>,
		field: PlacedField,
	) {
		if (!dragOffsetRef.current) return;
		const point = pointFromPreview(event, previewRef.current);
		form.setFieldValue(
			"x",
			clamp(Math.round(point.x - dragOffsetRef.current.x), 0, pdfPage.width - field.width),
		);
		form.setFieldValue(
			"y",
			clamp(Math.round(point.y - dragOffsetRef.current.y), 0, pdfPage.height - field.height),
		);
	}

	function stopDragging() {
		dragOffsetRef.current = null;
	}

	return (
		<section className="rounded-lg border bg-card p-5 shadow-sm">
			<div className="mb-5 flex items-start gap-3">
				<FileText className="mt-0.5 size-5 text-muted-foreground" />
				<div>
					<h2 className="text-balance font-semibold text-lg">Signature placement</h2>
					<p className="text-muted-foreground text-pretty text-sm">
						Place one signature box for each signer. Completed signers are locked so duplicates
						cannot be added.
					</p>
				</div>
			</div>
			{fieldsQuery.isLoading ? (
				<p className="mb-4 text-muted-foreground text-sm">Loading existing placements.</p>
			) : null}
			{fieldsQuery.isError ? (
				<p className="mb-4 text-destructive text-sm">Unable to load existing placements.</p>
			) : null}
			<form.Subscribe selector={(state) => state.values}>
				{(values) => (
					<FieldPlacementWorkspace
						values={values}
						recipients={recipients}
						signatureRecipientIds={signatureRecipientIds}
						placedFields={placedFields}
						sourcePdfPreviewUrl={buildSourcePdfPreviewUrl(
							envelopeId,
							senderSessionToken,
							historyAccess,
						)}
						allSignaturesPlaced={allSignaturesPlaced}
						isSaving={saveMutation.isPending}
						isSaveError={saveMutation.isError}
						previewRef={previewRef}
						onSelectRecipient={(recipientId) => form.setFieldValue("recipientId", recipientId)}
						onSubmit={() => void form.handleSubmit()}
						onStartDragging={startDragging}
						onContinueDragging={continueDragging}
						onStopDragging={stopDragging}
					/>
				)}
			</form.Subscribe>
		</section>
	);
}

async function fetchFields(
	envelopeId: string,
	senderSessionToken: string | undefined,
	historyAccess = false,
): Promise<EnvelopeFieldResponse[]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/fields`, {
		headers: authHeaders(senderSessionToken, historyAccess),
	});
	const payload = (await response.json().catch(() => ({}))) as {
		data?: EnvelopeFieldResponse[];
	};
	if (!response.ok || !Array.isArray(payload.data)) {
		throw new Error("Unable to load fields");
	}
	return payload.data;
}

async function saveField(
	envelopeId: string,
	senderSessionToken: string | undefined,
	field: PlacedField,
	historyAccess = false,
): Promise<EnvelopeFieldResponse[]> {
	const response = await fetch(`/api/envelopes/${envelopeId}/fields`, {
		method: "POST",
		headers: authHeaders(senderSessionToken, historyAccess),
		body: JSON.stringify({ fields: [field] }),
	});
	const payload = (await response.json().catch(() => ({}))) as {
		data?: EnvelopeFieldResponse[];
	};
	if (!response.ok || !Array.isArray(payload.data)) throw new Error("Unable to save field");
	return payload.data;
}

function pointFromPreview(
	event: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>,
	preview: HTMLFieldSetElement | null,
): { x: number; y: number } {
	const bounds = preview?.getBoundingClientRect();
	if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
		return { x: event.clientX, y: event.clientY };
	}
	return {
		x: (event.clientX - bounds.left) * (pdfPage.width / bounds.width),
		y: (event.clientY - bounds.top) * (pdfPage.height / bounds.height),
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function fieldQueryKey(
	envelopeId: string,
	senderSessionToken: string | undefined,
	historyAccess = false,
) {
	return ["envelope-fields", envelopeId, historyAccess ? "history" : senderSessionToken] as const;
}

function authHeaders(
	senderSessionToken: string | undefined,
	historyAccess = false,
): Record<string, string> {
	if (historyAccess) {
		return { "Content-Type": "application/json", "x-history-session-access": "true" };
	}
	if (senderSessionToken) {
		return {
			"Content-Type": "application/json",
			"x-sender-session-token": senderSessionToken,
		};
	}
	return {
		"Content-Type": "application/json",
		"x-internal-user-id": "ui-user",
	};
}

export function buildSourcePdfPreviewUrl(
	envelopeId: string,
	senderSessionToken: string | undefined,
	historyAccess = false,
): string {
	const params = new URLSearchParams();
	if (historyAccess) params.set("historyAccess", "true");
	else if (senderSessionToken) params.set("senderSessionToken", senderSessionToken);
	const query = params.size > 0 ? `?${params.toString()}` : "";
	return `/api/envelopes/${envelopeId}/source-pdf/content${query}#toolbar=0&navpanes=0&scrollbar=0&page=1`;
}
