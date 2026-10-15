// ABOUTME: Simple stand-in for sections whose real page arrives in a later task (care circle,
// ABOUTME: reminders, shared links): the title and a line on what the page will hold.
import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { Page } from "@/components/shell/Page";
import type { BreadcrumbItem } from "@/components/shell/Breadcrumbs";

export function PlaceholderPage({
  title,
  body,
  breadcrumbs,
  children,
}: {
  title: string;
  body: string;
  breadcrumbs?: BreadcrumbItem[];
  children?: ReactNode;
}) {
  return (
    <Page title={title} breadcrumbs={breadcrumbs}>
      <div className="flex items-start gap-3 rounded-[20px] border border-dashed border-line bg-surface p-5">
        <Construction size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
        <p className="text-sm text-muted">{body}</p>
      </div>
      {children}
    </Page>
  );
}
