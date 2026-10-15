// ABOUTME: The Cmd or Ctrl K command palette (cmdk in a dialog): jump to any page, lab result,
// ABOUTME: plan item or document, or run a global action. The data hooks only run while it is open.
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "@tanstack/react-router";
import {
  Calendar,
  Compass,
  FileText,
  FlaskConical,
  MessageSquare,
  Plus,
  RotateCcw,
  SunMoon,
  Upload,
} from "lucide-react";
import {
  focusAssistantInput,
  getAssistantState,
  openAssistant,
} from "@/components/assistant/assistantStore";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLabs } from "@/features/labs/useLabs";
import { useDocuments } from "@/hooks/useDocuments";
import { usePlanItems } from "@/hooks/usePlanItems";
import {
  buildCommands,
  scoreCommand,
  type ActionId,
  type Command as PaletteCommand,
  type CommandGroup as PaletteGroup,
} from "@/lib/commands";
import { canResetDemo, resetDemoData } from "@/lib/demoReset";
import { groupLabs } from "@/lib/labs";
import { NAV_ITEMS } from "@/lib/nav";
import { toggleTheme } from "@/lib/theme";

const GROUP_ORDER: PaletteGroup[] = ["Pages", "Lab results", "Plan", "Documents", "Actions"];

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const GROUP_ICON: Record<Exclude<PaletteGroup, "Pages" | "Actions">, Icon> = {
  "Lab results": FlaskConical,
  Plan: Calendar,
  Documents: FileText,
};

const ACTION_ICON: Record<ActionId, Icon> = {
  "ask-assistant": MessageSquare,
  "upload-document": Upload,
  "add-psa-reading": Plus,
  "toggle-theme": SunMoon,
  "reset-demo": RotateCcw,
  "take-tour": Compass,
};

function iconFor(command: PaletteCommand): Icon {
  if (command.group === "Pages")
    return NAV_ITEMS.find((i) => i.to === command.to)?.icon ?? FileText;
  if (command.group === "Actions")
    return ACTION_ICON[command.id.slice("action:".length) as ActionId];
  return GROUP_ICON[command.group];
}

/** Focus an element that appears after a route change, trying for a few seconds. */
function focusWhenPresent(selector: string, tries = 80) {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.focus();
  else if (tries > 0) setTimeout(() => focusWhenPresent(selector, tries - 1), 50);
}

export function CommandPalette({
  open,
  onOpenChange,
  onTour,
  onAddPsaReading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTour: () => void;
  onAddPsaReading: () => void;
}) {
  // Radix returns focus to what had it before the palette. Skip that when the chosen command
  // moves focus somewhere itself (a page, the assistant, a dialog).
  const skipRestoreFocus = useRef(false);

  // Each open starts with an empty query, even when it lands during the previous close animation.
  const [search, setSearch] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSearch("");
  }

  // Radix focuses the input when the dialog mounts, but not when it reopens mid-way through the
  // close animation (the content is still mounted), so ask for it on every open.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("[cmdk-root] [cmdk-input]")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        {/* One above its overlay: reopened during the close animation, Radix can mount a new
            overlay after the still-mounted content, and at equal z-index it would cover it. */}
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => {
            if (skipRestoreFocus.current) {
              e.preventDefault();
            } else if (getAssistantState().open) {
              // Opened over the assistant: hand focus back to its input.
              e.preventDefault();
              focusAssistantInput();
            }
            skipRestoreFocus.current = false;
          }}
          className="fixed top-[12vh] left-1/2 z-[51] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[20px] border border-line bg-surface text-ink shadow-xl duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search pages, lab results, plan items and documents, or run an action.
          </DialogDescription>
          <PaletteBody
            search={search}
            onSearchChange={setSearch}
            onTour={onTour}
            onAddPsaReading={onAddPsaReading}
            onPick={(movesFocus) => {
              skipRestoreFocus.current = movesFocus;
              onOpenChange(false);
            }}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function PaletteBody({
  search,
  onSearchChange,
  onTour,
  onAddPsaReading,
  onPick,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  onTour: () => void;
  onAddPsaReading: () => void;
  onPick: (movesFocus: boolean) => void;
}) {
  const router = useRouter();
  const { labs } = useLabs();
  const { items: planItems } = usePlanItems();
  const { documents } = useDocuments();

  const grouped = useMemo(() => {
    const commands = buildCommands(
      {
        metrics: groupLabs(labs).flatMap((g) => g.metrics.map((m) => m.name)),
        planItems,
        documents,
      },
      {
        "ask-assistant": () => openAssistant(),
        "upload-document": () => {
          router.history.push("/documents");
          focusWhenPresent("[data-upload-dropzone]");
        },
        "add-psa-reading": onAddPsaReading,
        "toggle-theme": toggleTheme,
        "reset-demo": canResetDemo ? resetDemoData : undefined,
        "take-tour": onTour,
      },
    ).filter((c) => c.to || c.run);

    // cmdk identifies an item by its value, so a repeated label gets its id appended.
    const counts = new Map<string, number>();
    for (const c of commands) counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
    return GROUP_ORDER.map((group) => ({
      group,
      items: commands
        .filter((c) => c.group === group)
        .map((c) => ({
          command: c,
          value: (counts.get(c.label) ?? 0) > 1 ? `${c.label} ${c.id}` : c.label,
        })),
    })).filter((g) => g.items.length > 0);
  }, [labs, planItems, documents, router, onTour, onAddPsaReading]);

  function pick(command: PaletteCommand) {
    // Toggling the theme leaves focus where it was; everything else moves it.
    onPick(command.id !== "action:toggle-theme");
    if (command.to) {
      router.history.push(command.to);
      document.getElementById("main")?.focus();
    } else {
      command.run?.();
    }
  }

  return (
    <Command loop label="Command palette" filter={scoreCommand} className="h-auto bg-surface">
      <CommandInput
        value={search}
        onValueChange={onSearchChange}
        placeholder="Search pages, results, documents, actions"
      />
      <CommandList className="max-h-[min(360px,60vh)] p-1">
        <CommandEmpty>No results found.</CommandEmpty>
        {grouped.map(({ group, items }) => (
          <CommandGroup key={group} heading={group}>
            {items.map(({ command, value }) => {
              const Icon = iconFor(command);
              return (
                <CommandItem
                  key={command.id}
                  value={value}
                  keywords={[group, ...(command.keywords ?? [])]}
                  onSelect={() => pick(command)}
                  className="gap-3 rounded-xl px-3 py-2.5 text-sm"
                >
                  <Icon aria-hidden className="text-muted" />
                  <span className="min-w-0 truncate">{command.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <div
        aria-hidden
        className="hidden items-center gap-4 border-t border-line px-4 py-2 text-xs text-muted sm:flex"
      >
        <span>↑↓ move</span>
        <span>Enter open</span>
        <span>Esc close</span>
      </div>
    </Command>
  );
}
