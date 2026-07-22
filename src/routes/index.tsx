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
	const search = new URLSearchParams(searchString);
	const requestedTask = search.get("task");
	const requestedReturnTo = search.get("returnTo");
	const historyReturnTo =
		requestedReturnTo && /^\/human-review\/[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(requestedReturnTo)
			? requestedReturnTo
			: undefined;
	const initialTask =
		requestedTask === "only-me"
			? "only_me"
			: requestedTask === "with-someone"
				? "me_and_another_signer"
				: requestedTask === "my-documents"
					? "my_documents"
					: requestedTask === "agentic"
						? "agentic"
						: undefined;
	return (
		<StartEnvelopePage
			initialTask={initialTask}
			historyReturnTo={historyReturnTo}
			turnstileSiteKey={config.turnstileSiteKey}
		/>
	);
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}
