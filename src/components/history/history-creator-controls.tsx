import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

type CreatorAction = "cancel" | "delete";

export function HistoryCreatorControls({
	envelopeId,
	title,
	allowedActions,
}: {
	envelopeId: string;
	title: string;
	allowedActions: string[];
}) {
	const queryClient = useQueryClient();
	const [openAction, setOpenAction] = useState<CreatorAction | null>(null);
	const mutation = useMutation({
		mutationFn: (action: CreatorAction) => runCreatorAction(envelopeId, action),
		onSuccess: async () => {
			setOpenAction(null);
			await queryClient.invalidateQueries({ queryKey: ["history-documents"] });
		},
	});
	const actions = (["cancel", "delete"] as const).filter((action) =>
		allowedActions.includes(action),
	);

	return (
		<>
			{actions.map((action) => (
				<CreatorActionDialog
					key={action}
					action={action}
					title={title}
					open={openAction === action}
					isPending={mutation.isPending && mutation.variables === action}
					onOpenChange={(open) => setOpenAction(open ? action : null)}
					onConfirm={() => mutation.mutate(action)}
				/>
			))}
			{mutation.isError ? (
				<p className="text-destructive text-sm" role="alert">
					Unable to update this document. Refresh and try again.
				</p>
			) : null}
		</>
	);
}

function CreatorActionDialog({
	action,
	title,
	open,
	isPending,
	onOpenChange,
	onConfirm,
}: {
	action: CreatorAction;
	title: string;
	open: boolean;
	isPending: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}) {
	const cancel = action === "cancel";
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button
					type="button"
					size="sm"
					variant="outline"
					aria-label={`${cancel ? "Cancel" : "Delete"} ${title}`}
				>
					{cancel ? <Ban className="size-4" /> : <Trash2 className="size-4" />}
					{cancel ? "Cancel" : "Delete"}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{cancel ? "Cancel document?" : "Delete document?"}</DialogTitle>
					<DialogDescription>
						{cancel
							? "Canceling stops outstanding signing access. The document remains listed as expired and can still be deleted later."
							: "Deleting permanently removes stored PDFs, revokes every document access path, and cannot be undone."}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							Keep document
						</Button>
					</DialogClose>
					<Button type="button" variant="destructive" disabled={isPending} onClick={onConfirm}>
						{isPending ? "Working…" : cancel ? "Confirm cancel" : "Confirm delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

async function runCreatorAction(envelopeId: string, action: CreatorAction): Promise<void> {
	const response = await fetch(
		`/api/history/documents/${encodeURIComponent(envelopeId)}/creator-actions`,
		{
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action }),
		},
	);
	if (!response.ok) throw new Error("Unable to update this document");
}
