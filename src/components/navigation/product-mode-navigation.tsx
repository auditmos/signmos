import { cn } from "@/lib/utils";

export type ProductMode = "only_me" | "me_and_another_signer" | "my_documents" | "agentic";

const productModes = [
	{ mode: "only_me", label: "Sign by myself" },
	{ mode: "me_and_another_signer", label: "Sign with someone else" },
	{ mode: "my_documents", label: "My documents" },
	{ mode: "agentic", label: "Agentic mode" },
] as const satisfies ReadonlyArray<{ mode: ProductMode; label: string }>;

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
