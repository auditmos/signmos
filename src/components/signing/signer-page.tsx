import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignerField {
	id: string;
	type: "signature" | "date";
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface SignerSession {
	envelopeId: string;
	recipientId: string;
	fields: SignerField[];
}

interface SigningError {
	message: string;
	verificationUrl?: string;
}

interface SignerPageProps {
	token: string;
}

export function SignerPage({ token }: SignerPageProps) {
	const [session, setSession] = useState<SignerSession | null>(null);
	const [signatureName, setSignatureName] = useState("");
	const [date, setDate] = useState("");
	const [reason, setReason] = useState("");
	const [comment, setComment] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<SigningError | null>(null);

	useEffect(() => {
		let active = true;
		fetch(`/api/signing/${token}`)
			.then(
				(response) =>
					response.json() as Promise<{
						data?: SignerSession;
						error?: SigningError;
					}>,
			)
			.then((body) => {
				if (!active) return;
				setError(body.error ?? null);
				setSession(body.data ?? null);
			});
		return () => {
			active = false;
		};
	}, [token]);

	async function completeSigning(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`/api/signing/${token}/complete`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ signatureName, date }),
		});
		setMessage(response.ok ? "Signing complete" : "Unable to complete signing");
	}

	async function declineSigning(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const response = await fetch(`/api/signing/${token}/decline`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason, comment: comment || undefined }),
		});
		setMessage(response.ok ? "Signing declined" : "Unable to decline");
	}

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold">Review and sign</h1>
				<p className="text-sm text-muted-foreground">
					No account is required for this signing link.
				</p>
			</div>
			{error && (
				<div className="rounded-md border border-destructive/40 p-4 text-sm">
					<p className="font-medium">{error.message}</p>
					{error.verificationUrl && (
						<a className="text-primary underline" href={error.verificationUrl}>
							Verify email
						</a>
					)}
				</div>
			)}
			<div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
				{session?.fields.map((field) => (
					<div key={field.id} className="rounded-md border bg-muted/30 p-3">
						<p className="font-medium capitalize">{field.type}</p>
						<p className="text-sm text-muted-foreground">
							Page {field.page}, x {field.x}, y {field.y}, {field.width}x{field.height}
						</p>
					</div>
				))}
			</div>
			<form onSubmit={completeSigning} className="grid gap-4 md:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="signatureName">Typed signature</Label>
					<Input
						id="signatureName"
						value={signatureName}
						onChange={(event) => setSignatureName(event.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="signingDate">Signing date</Label>
					<Input
						id="signingDate"
						type="date"
						value={date}
						onChange={(event) => setDate(event.target.value)}
						required
					/>
				</div>
				<div className="flex items-end">
					<Button type="submit" className="w-full">
						<Check className="h-4 w-4" />
						Complete signing
					</Button>
				</div>
			</form>
			<form onSubmit={declineSigning} className="grid gap-4 md:grid-cols-3">
				<div className="space-y-2">
					<Label htmlFor="declineReason">Decline reason</Label>
					<Input
						id="declineReason"
						value={reason}
						onChange={(event) => setReason(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="declineComment">Comment</Label>
					<Input
						id="declineComment"
						value={comment}
						onChange={(event) => setComment(event.target.value)}
					/>
				</div>
				<div className="flex items-end">
					<Button type="submit" variant="outline" className="w-full">
						<X className="h-4 w-4" />
						Decline
					</Button>
				</div>
			</form>
			{message && <p className="text-sm text-muted-foreground">{message}</p>}
		</div>
	);
}
