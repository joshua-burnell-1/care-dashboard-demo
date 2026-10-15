// ABOUTME: The "nothing here" state for unknown routes and ids: a title, a line of help and a
// ABOUTME: link back to the section the visitor came from.
import { Link } from "@tanstack/react-router";
import { ArrowLeft, SearchX } from "lucide-react";

export function NotFoundState({
  title,
  body,
  backTo,
  backLabel,
}: {
  title: string;
  body: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-muted">
        <SearchX size={22} aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-4xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link
        to={backTo}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 ease-out hover:bg-secondary"
      >
        <ArrowLeft size={16} aria-hidden />
        {backLabel}
      </Link>
    </div>
  );
}
