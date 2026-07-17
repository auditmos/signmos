import { createFileRoute, useLocation } from "@tanstack/react-router";
import { createServerFn, getGlobalStartContext } from "@tanstack/react-start";
import { StartEnvelopePage } from "@/components/sender/start-envelope-page";

const getStartEnvelopePageConfig = createServerFn({ method: "GET" }).handler(async () => {
	const context = getGlobalStartContext();
	return {
		turnstileSiteKey: normalizeOptionalValue(
			context?.turnstileSiteKey ?? import.meta.env.VITE_TURNSTILE_SITE_KEY,
		),
	};
});

export const Route = createFileRoute("/")({
	loader: () => getStartEnvelopePageConfig(),
	component: IndexPage,
});

function IndexPage() {
	const config = Route.useLoaderData();
	const searchString = useLocation({ select: (location) => location.searchStr });
	const requestedTask = new URLSearchParams(searchString).get("task");
	return (
		<StartEnvelopePage
			initialTask={requestedTask === "my-documents" ? "my_documents" : undefined}
			turnstileSiteKey={config.turnstileSiteKey}
		/>
	);
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}
