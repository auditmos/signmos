import { PenLine, RotateCcw, Save, Type } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignatureProfilePanelProps {
	envelopeId: string;
}

type TypedSignatureFont = "cursive" | "serif" | "sans-serif";

type DrawPoint = {
	x: number;
	y: number;
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

type SignatureProfileResponse = {
	data?: {
		label?: string;
	};
};

const typedSignatureFonts: Array<{ label: string; value: TypedSignatureFont; stack: string }> = [
	{ label: "Script", value: "cursive", stack: "cursive" },
	{ label: "Serif", value: "serif", stack: "serif" },
	{ label: "Clean", value: "sans-serif", stack: "sans-serif" },
];

export function SignatureProfilePanel({ envelopeId }: SignatureProfilePanelProps) {
	const [drawnLabel, setDrawnLabel] = useState("Drawn signature");
	const [drawPoints, setDrawPoints] = useState<DrawPoint[]>([]);
	const [isDrawing, setIsDrawing] = useState(false);
	const [typedLabel, setTypedLabel] = useState("Typed signature");
	const [typedName, setTypedName] = useState("");
	const [typedFont, setTypedFont] = useState<TypedSignatureFont>("cursive");
	const [drawnError, setDrawnError] = useState<string | null>(null);
	const [typedError, setTypedError] = useState<string | null>(null);
	const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

	const drawnPath = toSvgPath(drawPoints);
	const fontStack =
		typedSignatureFonts.find((font) => font.value === typedFont)?.stack ??
		typedSignatureFonts[0].stack;

	async function saveProfile(request: SignatureProfileRequest): Promise<string> {
		const response = await fetch(`/api/envelopes/${envelopeId}/signature-profiles`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-internal-user-id": "ui-user",
			},
			body: JSON.stringify(request),
		});
		if (!response.ok) throw new Error("Unable to save signature profile");
		const payload = (await response.json().catch((): SignatureProfileResponse => ({}))) as
			| SignatureProfileResponse
			| undefined;
		return payload?.data?.label ?? request.label;
	}

	async function saveDrawnProfile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setDrawnError(null);
		setSelectedMessage(null);
		if (!drawnPath) {
			setDrawnError("Draw a signature before saving.");
			return;
		}
		try {
			const label = await saveProfile({
				kind: "drawn",
				label: drawnLabel,
				svgPath: drawnPath,
				selected: true,
			});
			setSelectedMessage(`${label} selected`);
		} catch {
			setDrawnError("Unable to save drawn signature.");
		}
	}

	async function saveTypedProfile(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setTypedError(null);
		setSelectedMessage(null);
		const trimmedName = typedName.trim();
		if (!trimmedName) {
			setTypedError("Type a name before saving.");
			return;
		}
		try {
			const label = await saveProfile({
				kind: "typed",
				label: typedLabel,
				typedText: trimmedName,
				typedFont,
				selected: true,
			});
			setSelectedMessage(`${label} selected`);
		} catch {
			setTypedError("Unable to save typed signature.");
		}
	}

	function startDrawing(event: React.MouseEvent<SVGSVGElement>) {
		setDrawPoints([pointFromEvent(event)]);
		setIsDrawing(true);
	}

	function continueDrawing(event: React.MouseEvent<SVGSVGElement>) {
		if (!isDrawing) return;
		const point = pointFromEvent(event);
		setDrawPoints((points) => [...points, point]);
	}

	function stopDrawing() {
		setIsDrawing(false);
	}

	return (
		<section className="rounded-lg border bg-card p-5 shadow-sm">
			<div className="mb-5">
				<h2 className="text-balance font-semibold text-lg">Signature profile</h2>
				<p className="text-muted-foreground text-pretty text-sm">
					Create a selected signature mark before placing fields.
				</p>
			</div>
			<div className="grid gap-5 lg:grid-cols-2">
				<form onSubmit={saveDrawnProfile} className="space-y-4">
					<div className="flex items-center gap-2 text-sm font-medium">
						<PenLine className="size-4" />
						Drawn signature
					</div>
					<svg
						aria-label="Draw signature"
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
					<div className="space-y-2">
						<Label htmlFor="drawn-profile-label">Drawn profile label</Label>
						<Input
							id="drawn-profile-label"
							value={drawnLabel}
							onChange={(event) => setDrawnLabel(event.target.value)}
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="submit">
							<Save className="size-4" />
							Save drawn signature
						</Button>
						<Button type="button" variant="outline" onClick={() => setDrawPoints([])}>
							<RotateCcw className="size-4" />
							Clear
						</Button>
					</div>
					{drawnError && <p className="text-destructive text-sm">{drawnError}</p>}
				</form>
				<form onSubmit={saveTypedProfile} className="space-y-4">
					<div className="flex items-center gap-2 text-sm font-medium">
						<Type className="size-4" />
						Typed signature
					</div>
					<div
						aria-label="Typed signature preview"
						role="img"
						className={cn(
							"flex h-32 items-center justify-center rounded-lg border bg-background px-4",
							"text-pretty text-3xl",
						)}
						style={{ fontFamily: fontStack }}
					>
						{typedName || "Typed name"}
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="typed-name">Typed name</Label>
							<Input
								id="typed-name"
								value={typedName}
								onChange={(event) => setTypedName(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="typed-font">Typed font</Label>
							<select
								id="typed-font"
								value={typedFont}
								onChange={(event) => setTypedFont(event.target.value as TypedSignatureFont)}
								className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
							>
								{typedSignatureFonts.map((font) => (
									<option key={font.value} value={font.value}>
										{font.label}
									</option>
								))}
							</select>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="typed-profile-label">Typed profile label</Label>
						<Input
							id="typed-profile-label"
							value={typedLabel}
							onChange={(event) => setTypedLabel(event.target.value)}
						/>
					</div>
					<Button type="submit">
						<Save className="size-4" />
						Save typed signature
					</Button>
					{typedError && <p className="text-destructive text-sm">{typedError}</p>}
				</form>
			</div>
			{selectedMessage && (
				<p className="mt-5 rounded-lg border bg-background px-3 py-2 text-muted-foreground text-sm">
					{selectedMessage}
				</p>
			)}
		</section>
	);
}

function pointFromEvent(event: React.MouseEvent<SVGSVGElement>): DrawPoint {
	const bounds = event.currentTarget.getBoundingClientRect();
	return {
		x: Math.max(0, Math.min(320, Math.round(event.clientX - bounds.left))),
		y: Math.max(0, Math.min(128, Math.round(event.clientY - bounds.top))),
	};
}

function toSvgPath(points: DrawPoint[]): string {
	return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}
