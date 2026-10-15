import { createFileRoute } from "@tanstack/react-router";
import { DocumentPage } from "@/features/documents/DocumentPage";

export const Route = createFileRoute("/documents/$docId")({
  component: DocumentRoute,
});

function DocumentRoute() {
  const { docId } = Route.useParams();
  return <DocumentPage docId={docId} />;
}
