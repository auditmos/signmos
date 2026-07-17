import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, PenLine, RotateCcw, Save, Type } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignatureProfilePanelProps {
	envelopeId: string;
	senderSessionToken?: string;
	historyAccess?: boolean;
}

type SignatureMode = "typed" | "drawn";
type TypedSignatureFont = "cursive" | "serif" | "sans-serif";

type DrawPoint = {
	x: number;
	y: number;
};

type SignaturePreferenceValues = {
	mode: SignatureMode;
	label: string;
	typedText: string;
	typedFont: TypedSignatureFont;
};

type SignatureProfileRequest =
	| {
			kind: "drawn";
			label: string;
			svgPath: string;
			selected: true;
	  }
	| {
			kind: "typed";
			label: string;
			typedText: string;
			typedFont: TypedSignatureFont;
			selected: true;
	  };

type SignatureProfile = {
	id: string;
	kind: SignatureMode;
	label: string;
	svgPath: string | null;
	typedText: string | null;
	typedFont: string | null;
};

type SignatureProfileResponse = {
	data?: SignatureProfile | null;
};

const typedSignatureFonts: Array<{ label: string; value: TypedSignatureFont; stack: string }> = [
	{ label: "Script", value: "cursive", stack: "cursive" },
	{ label: "Serif", value: "serif", stack: "serif" },
	{ label: "Clean", value: "sans-serif", stack: "sans-serif" },
];

export function SignatureProfilePanel({
	envelopeId,
	senderSessionToken,
	historyAccess = false,
}: SignatureProfilePanelProps) {
	const profileQuery = useQuery({
		queryKey: ["signature-profile", envelopeId, historyAccess ? "history" : senderSessionToken],
		queryFn: () => fetchSelectedSignatureProfile(envelopeId, senderSessionToken, historyAccess),
		staleTime: 30_000,
	});

	return (
		<section className="rounded-lg border bg-card p-5 shadow-sm">
			<div className="mb-5">
				<h2 className="text-balance font-semibold text-lg">Signature preference</h2>
				<p className="text-muted-foreground text-pretty text-sm">
					Choose one signing method. Typed signatures render your name in a selected font; drawn
					signatures reuse the stroke you draw below.
				</p>
			</div>
			{profileQuery.isLoading ? (
				<p className="text-muted-foreground text-sm">Loading saved signature preference.</p>
			) : null}
			{profileQuery.isError ? (
				<p className="mb-4 text-destructive text-sm">Unable to load saved signature preference.</p>
			) : null}
			{!profileQuery.isLoading ? (
				<SignaturePreferenceEditor
					key={profileQuery.data?.id ?? "new-signature-preference"}
					envelopeId={envelopeId}
					senderSessionToken={senderSessionToken}
					historyAccess={historyAccess}
					initialProfile={profileQuery.data ?? null}
				/>
			) : null}
		</section>
	);
}

function SignaturePreferenceEditor({
	envelopeId,
	senderSessionToken,
	historyAccess,
	initialProfile,
}: {
	envelopeId: string;
	senderSessionToken?: string;
	historyAccess: boolean;
	initialProfile: SignatureProfile | null;
}) {
	const [drawPoints, setDrawPoints] = useState<DrawPoint[]>([]);
	const [savedDrawnPath, setSavedDrawnPath] = useState(
		initialProfile?.kind === "drawn" ? (initialProfile.svgPath ?? "") : "",
	);
	const [isDrawing, setIsDrawing] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	const saveMutation = useMutation({
		mutationFn: (request: SignatureProfileRequest) =>
			saveProfile(envelopeId, senderSessionToken, request, historyAccess),
		onSuccess: () => setValidationError(null),
	});
	const form = useForm({
		defaultValues: signaturePreferenceDefaults(initialProfile),
		onSubmit: async ({ value }) => {
			const request = buildSignaturePreferenceRequest(
				value,
				toSvgPath(drawPoints) || savedDrawnPath,
			);
			if (!request.ok) {
				setValidationError(request.message);
				return;
			}
			await saveMutation.mutateAsync(request.value);
		},
	});

	const savedMessage = initialProfile ? `Previous ${initialProfile.kind} signature loaded` : null;
	const selectedLabel = saveMutation.data;

	function startDrawing(event: MouseEvent<SVGSVGElement>) {
		setSavedDrawnPath("");
		setDrawPoints([pointFromEvent(event)]);
		setIsDrawing(true);
	}

	function continueDrawing(event: MouseEvent<SVGSVGElement>) {
		if (!isDrawing) return;
		const point = pointFromEvent(event);
		setDrawPoints((points) => [...points, point]);
	}

	function stopDrawing() {
		setIsDrawing(false);
	}

	function clearDrawing() {
		setDrawPoints([]);
		setSavedDrawnPath("");
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				void form.handleSubmit();
			}}
			className="space-y-5"
		>
			<form.Subscribe selector={(state) => state.values}>
				{(values) => {
					const drawnPath = toSvgPath(drawPoints) || savedDrawnPath;
					const fontStack =
						typedSignatureFonts.find((font) => font.value === values.typedFont)?.stack ??
						typedSignatureFonts[0].stack;
					return (
						<>
							<fieldset className="grid gap-3 sm:grid-cols-2">
								<legend className="sr-only">Signature method</legend>
								<SignatureMethodButton
									isActive={values.mode === "typed"}
									icon={<Type className="size-4" />}
									title="Typed"
									description="Best when a clean rendered name is enough."
									onClick={() => {
										form.setFieldValue("mode", "typed");
										setValidationError(null);
									}}
								/>
								<SignatureMethodButton
									isActive={values.mode === "drawn"}
									icon={<PenLine className="size-4" />}
									title="Drawn"
									description="Best when you want a hand-drawn stroke."
									onClick={() => {
										form.setFieldValue("mode", "drawn");
										setValidationError(null);
									}}
								/>
							</fieldset>

							{values.mode === "typed" ? (
								<div className="space-y-4">
									<div
										aria-label="Typed signature preview"
										role="img"
										className={cn(
											"flex h-32 items-center justify-center rounded-lg border bg-background px-4",
											"text-pretty text-3xl",
										)}
										style={{ fontFamily: fontStack }}
									>
										{values.typedText || "Typed name"}
									</div>
									<div className="grid gap-4 sm:grid-cols-2">
										<form.Field name="typedText">
											{(field) => (
												<div className="space-y-2">
													<Label htmlFor="typed-signature-text">Typed signature text</Label>
													<Input
														id="typed-signature-text"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(event) => field.handleChange(event.target.value)}
													/>
												</div>
											)}
										</form.Field>
										<form.Field name="typedFont">
											{(field) => (
												<div className="space-y-2">
													<Label htmlFor="signature-font">Signature font</Label>
													<select
														id="signature-font"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(event) =>
															field.handleChange(event.target.value as TypedSignatureFont)
														}
														className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
													>
														{typedSignatureFonts.map((font) => (
															<option key={font.value} value={font.value}>
																{font.label}
															</option>
														))}
													</select>
												</div>
											)}
										</form.Field>
									</div>
								</div>
							) : (
								<div className="space-y-3">
									<svg
										aria-label="Draw signature pad"
										role="img"
										viewBox="0 0 320 128"
										className="h-32 w-full touch-none rounded-lg border bg-background"
										onMouseDown={startDrawing}
										onMouseMove={continueDrawing}
										onMouseUp={stopDrawing}
										onMouseLeave={stopDrawing}
									>
										<path
											d={drawnPath}
											fill="none"
											stroke="currentColor"
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="3"
											className="text-foreground"
										/>
									</svg>
									<Button type="button" variant="outline" onClick={clearDrawing}>
										<RotateCcw className="size-4" />
										Clear drawing
									</Button>
								</div>
							)}

							<form.Field name="label">
								{(field) => (
									<div className="space-y-2">
										<Label htmlFor="signature-preference-label">Preference name</Label>
										<Input
											id="signature-preference-label"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
										/>
									</div>
								)}
							</form.Field>
						</>
					);
				}}
			</form.Subscribe>

			<div className="flex flex-wrap items-center gap-2">
				<Button type="submit" disabled={saveMutation.isPending}>
					<Save className="size-4" />
					{saveMutation.isPending ? "Saving..." : "Save signature preference"}
				</Button>
				{savedMessage ? (
					<span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
						<CheckCircle2 className="size-4" />
						{savedMessage}
					</span>
				) : null}
			</div>

			{validationError ? <p className="text-destructive text-sm">{validationError}</p> : null}
			{saveMutation.isError ? (
				<p className="text-destructive text-sm">Unable to save signature preference.</p>
			) : null}
			{selectedLabel ? (
				<p className="rounded-lg border bg-background px-3 py-2 text-muted-foreground text-sm">
					{selectedLabel} selected
				</p>
			) : null}
		</form>
	);
}

function SignatureMethodButton({
	isActive,
	icon,
	title,
	description,
	onClick,
}: {
	isActive: boolean;
	icon: ReactNode;
	title: string;
	description: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={isActive}
			aria-label={`Choose ${title.toLowerCase()} signature`}
			onClick={onClick}
			className={cn(
				"flex min-h-24 items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors",
				"hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
				isActive && "border-primary bg-muted/40",
			)}
		>
			<span className="mt-0.5 text-muted-foreground">{icon}</span>
			<span>
				<span className="block font-medium text-sm">{title}</span>
				<span className="mt-1 block text-muted-foreground text-pretty text-sm">{description}</span>
			</span>
		</button>
	);
}

function signaturePreferenceDefaults(profile: SignatureProfile | null): SignaturePreferenceValues {
	if (profile?.kind === "typed") {
		return {
			mode: "typed",
			label: profile.label,
			typedText: profile.typedText ?? "",
			typedFont: parseTypedFont(profile.typedFont),
		};
	}
	if (profile?.kind === "drawn") {
		return {
			mode: "drawn",
			label: profile.label,
			typedText: "",
			typedFont: "cursive",
		};
	}
	return {
		mode: "typed",
		label: "Typed signature",
		typedText: "",
		typedFont: "cursive",
	};
}

function buildSignaturePreferenceRequest(
	values: SignaturePreferenceValues,
	drawnPath: string,
): { ok: true; value: SignatureProfileRequest } | { ok: false; message: string } {
	const label =
		values.label.trim() || (values.mode === "typed" ? "Typed signature" : "Drawn signature");
	if (values.mode === "typed") {
		const typedText = values.typedText.trim();
		if (!typedText) return { ok: false, message: "Type a signature before saving." };
		return {
			ok: true,
			value: {
				kind: "typed",
				label,
				typedText,
				typedFont: values.typedFont,
				selected: true,
			},
		};
	}
	if (!drawnPath) return { ok: false, message: "Draw a signature before saving." };
	return {
		ok: true,
		value: {
			kind: "drawn",
			label,
			svgPath: drawnPath,
			selected: true,
		},
	};
}

async function fetchSelectedSignatureProfile(
	envelopeId: string,
	senderSessionToken: string | undefined,
	historyAccess = false,
): Promise<SignatureProfile | null> {
	const response = await fetch(`/api/envelopes/${envelopeId}/signature-profiles/selected`, {
		headers: authHeaders(senderSessionToken, historyAccess),
	});
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) throw new Error("Unable to load signature preference");
	if (!isSignatureProfileResponse(payload)) return null;
	return payload.data ?? null;
}

async function saveProfile(
	envelopeId: string,
	senderSessionToken: string | undefined,
	request: SignatureProfileRequest,
	historyAccess = false,
): Promise<string> {
	const response = await fetch(`/api/envelopes/${envelopeId}/signature-profiles`, {
		method: "POST",
		headers: authHeaders(senderSessionToken, historyAccess),
		body: JSON.stringify(request),
	});
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) throw new Error("Unable to save signature profile");
	return isSignatureProfileResponse(payload) && payload.data?.label
		? payload.data.label
		: request.label;
}

function isSignatureProfileResponse(value: unknown): value is SignatureProfileResponse {
	if (!value || typeof value !== "object" || !("data" in value)) return false;
	const data = value.data;
	return data === null || data === undefined || (typeof data === "object" && "kind" in data);
}

function parseTypedFont(value: string | null): TypedSignatureFont {
	return typedSignatureFonts.some((font) => font.value === value)
		? (value as TypedSignatureFont)
		: "cursive";
}

function pointFromEvent(event: MouseEvent<SVGSVGElement>): DrawPoint {
	const bounds = event.currentTarget.getBoundingClientRect();
	const relativeX = event.clientX - bounds.left;
	const relativeY = event.clientY - bounds.top;
	const x = bounds.width > 0 ? (relativeX / bounds.width) * 320 : relativeX;
	const y = bounds.height > 0 ? (relativeY / bounds.height) * 128 : relativeY;
	return {
		x: Math.max(0, Math.min(320, Math.round(x))),
		y: Math.max(0, Math.min(128, Math.round(y))),
	};
}

function toSvgPath(points: DrawPoint[]): string {
	return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
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
