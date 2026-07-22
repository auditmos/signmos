export function HistoryCatalogLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			href={href}
		>
			{label}
		</a>
	);
}
