import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProductMode = "only_me" | "me_and_another_signer" | "my_documents" | "agentic";

const productModes = [
	{ mode: "only_me", label: "Sign by myself" },
	{ mode: "me_and_another_signer", label: "Sign with someone else" },
	{ mode: "my_documents", label: "My documents" },
	{ mode: "agentic", label: "Agentic mode" },
] as const satisfies ReadonlyArray<{ mode: ProductMode; label: string }>;

const signedOutDestinations: Record<ProductMode, string> = {
	only_me: "/?task=only-me",
	me_and_another_signer: "/?task=with-someone",
	my_documents: "/?task=my-documents",
	agentic: "/?task=agentic",
};

const defaultOnSignedOut = (url: string) => window.location.assign(url);

export function AuthenticatedProductNavigation({
	activeMode,
	onSignedOut = defaultOnSignedOut,
}: {
	activeMode: ProductMode;
	onSignedOut?: (url: string) => void;
}) {
	const signedOutStatusRef = useRef<HTMLOutputElement>(null);
	const signOut = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/navigate/sign-out", {
				method: "POST",
				credentials: "same-origin",
			});
			if (!response.ok) throw new Error("Unable to sign out");
		},
		onSuccess: () => onSignedOut(signedOutDestinations[activeMode]),
	});
	useEffect(() => {
		if (signOut.isSuccess) signedOutStatusRef.current?.focus();
	}, [signOut.isSuccess]);

	return (
		<div className="space-y-3">
			<ProductModeNavigation activeMode={activeMode} />
			<div className="flex justify-end">
				<Button
					type="button"
					variant="outline"
					disabled={signOut.isPending}
					onClick={() => signOut.mutate()}
				>
					{signOut.isPending ? "Signing out..." : "Sign out"}
				</Button>
			</div>
			{signOut.isError ? (
				<p role="alert" className="text-right text-sm text-destructive">
					Unable to sign out. Please try again.
				</p>
			) : null}
			{signOut.isSuccess ? (
				<output
					ref={signedOutStatusRef}
					tabIndex={-1}
					aria-live="polite"
					className="block text-right text-sm text-muted-foreground"
				>
					Signed out. Redirecting…
				</output>
			) : null}
		</div>
	);
}

export function ProductModeNavigation({ activeMode }: { activeMode: ProductMode }) {
	return (
		<nav aria-label="Signmos options" className="w-full">
			<ul className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-1 sm:grid-cols-4">
				{productModes.map(({ mode, label }) => {
					const active = mode === activeMode;
					return (
						<li key={mode}>
							<a
								href={`/api/navigate/${mode}`}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex min-h-10 items-center justify-center rounded-md px-3 py-2 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
									active
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground",
								)}
							>
								{label}
							</a>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
