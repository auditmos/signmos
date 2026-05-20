import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
		if (response.ok) setMessage("Field saved");
	}

	return (
		<form onSubmit={saveField} className="grid gap-4 md:grid-cols-4">
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
			<NumberField id="field-height" label="Height" value={height} min={1} onChange={setHeight} />
			<div className="flex items-end">
				<Button type="submit" className="w-full">
					<Save className="h-4 w-4" />
					Save field
				</Button>
			</div>
			{error && <p className="md:col-span-4 text-sm text-destructive">{error}</p>}
			{message && <p className="md:col-span-4 text-sm text-muted-foreground">{message}</p>}
		</form>
	);
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
