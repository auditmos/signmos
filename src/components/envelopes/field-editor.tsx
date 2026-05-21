import { FileText, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldEditorRecipient {
	id: string;
	name: string;
	email: string;
}

interface EnvelopeFieldEditorProps {
	envelopeId: string;
	recipients: FieldEditorRecipient[];
}

type FieldType = "signature" | "date";

type PlacedField = {
	recipientId: string;
	type: FieldType;
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
};

const pdfPage = {
	width: 612,
	height: 792,
} as const;

export function EnvelopeFieldEditor({ envelopeId, recipients }: EnvelopeFieldEditorProps) {
	const [type, setType] = useState<FieldType>("signature");
	const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
	const [page, setPage] = useState(1);
	const [x, setX] = useState(72);
	const [y, setY] = useState(144);
	const [width, setWidth] = useState(180);
	const [height, setHeight] = useState(48);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [placedFields, setPlacedFields] = useState<PlacedField[]>([]);

	const selectedRecipient = recipients.find((recipient) => recipient.id === recipientId);
	const currentField: PlacedField = { recipientId, type, page, x, y, width, height };

	async function saveField(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setMessage(null);
		const response = await fetch(`/api/envelopes/${envelopeId}/fields`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-internal-user-id": "ui-user",
			},
			body: JSON.stringify({
				fields: [{ recipientId, type, page, x, y, width, height }],
			}),
		});
		if (!response.ok) setError("Unable to save field");
		if (response.ok) {
			setPlacedFields((fields) => [...fields, currentField]);
			setMessage("Field saved");
		}
	}

	return (
		<section className="rounded-lg border bg-card p-5 shadow-sm">
			<div className="mb-5 flex items-start gap-3">
				<FileText className="mt-0.5 size-5 text-muted-foreground" />
				<div>
					<h2 className="text-balance font-semibold text-lg">Field placement</h2>
					<p className="text-muted-foreground text-pretty text-sm">
						Place signature and date fields on a PDF page.
					</p>
				</div>
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<form onSubmit={saveField} className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="field-recipient">Recipient</Label>
						<select
							id="field-recipient"
							value={recipientId}
							onChange={(event) => setRecipientId(event.target.value)}
							className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
						>
							{recipients.map((recipient) => (
								<option key={recipient.id} value={recipient.id}>
									{recipient.name}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="field-type">Type</Label>
						<select
							id="field-type"
							value={type}
							onChange={(event) => setType(event.target.value as FieldType)}
							className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
						>
							<option value="signature">Signature</option>
							<option value="date">Date</option>
						</select>
					</div>
					<NumberField id="field-page" label="Page" value={page} min={1} onChange={setPage} />
					<NumberField id="field-x" label="X" value={x} min={0} onChange={setX} />
					<NumberField id="field-y" label="Y" value={y} min={0} onChange={setY} />
					<NumberField id="field-width" label="Width" value={width} min={1} onChange={setWidth} />
					<NumberField
						id="field-height"
						label="Height"
						value={height}
						min={1}
						onChange={setHeight}
					/>
					<div className="flex items-end">
						<Button type="submit" className="w-full">
							<Save className="size-4" />
							Save field
						</Button>
					</div>
					{error && <p className="text-destructive text-sm sm:col-span-2">{error}</p>}
					{message && <p className="text-muted-foreground text-sm sm:col-span-2">{message}</p>}
				</form>
				<div>
					<fieldset
						aria-label="PDF page preview"
						className="relative aspect-[612/792] w-full overflow-hidden rounded-lg border bg-white text-slate-950 shadow-sm"
					>
						<legend className="sr-only">PDF page preview</legend>
						{placedFields.map((field, index) => (
							<FieldOverlay
								key={`${field.recipientId}-${field.type}-${field.page}-${index}`}
								field={field}
								recipientName={getRecipientName(recipients, field.recipientId)}
								isCurrent={false}
							/>
						))}
						<FieldOverlay
							field={currentField}
							recipientName={selectedRecipient?.name ?? "Recipient"}
							isCurrent={true}
						/>
					</fieldset>
					{placedFields.length === 0 && (
						<p className="mt-3 text-muted-foreground text-sm">Save a field to pin it here.</p>
					)}
				</div>
			</div>
		</section>
	);
}

function FieldOverlay({
	field,
	recipientName,
	isCurrent,
}: {
	field: PlacedField;
	recipientName: string;
	isCurrent: boolean;
}) {
	const isCompact = field.height < 40;
	return (
		<div
			aria-label={isCurrent ? "Current field preview" : `${recipientName} saved field preview`}
			role="img"
			className={cn(
				"absolute flex justify-center overflow-hidden rounded border px-1 tabular-nums",
				isCurrent
					? "border-slate-950 bg-slate-950/10"
					: "border-slate-500 bg-slate-100 text-slate-700",
				isCompact ? "items-center text-[9px]" : "flex-col text-[10px] leading-tight",
			)}
			style={{
				left: `${(field.x / pdfPage.width) * 100}%`,
				top: `${(field.y / pdfPage.height) * 100}%`,
				width: `${(field.width / pdfPage.width) * 100}%`,
				height: `${(field.height / pdfPage.height) * 100}%`,
			}}
		>
			{isCompact ? (
				<span className="truncate font-medium">
					{field.type} · {recipientName}
				</span>
			) : (
				<>
					<span className="truncate font-medium">{field.type}</span>
					<span className="truncate">{recipientName}</span>
				</>
			)}
		</div>
	);
}

function getRecipientName(recipients: FieldEditorRecipient[], recipientId: string): string {
	return recipients.find((recipient) => recipient.id === recipientId)?.name ?? "Recipient";
}

function NumberField({
	id,
	label,
	value,
	min,
	onChange,
}: {
	id: string;
	label: string;
	value: number;
	min: number;
	onChange: (value: number) => void;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type="number"
				min={min}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</div>
	);
}
