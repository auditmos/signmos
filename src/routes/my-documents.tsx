import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-documents")({
	component: MyDocumentsRoute,
});

function MyDocumentsRoute() {
	return <Outlet />;
}
