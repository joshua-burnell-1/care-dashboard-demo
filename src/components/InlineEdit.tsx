// ABOUTME: Edit a record where it sits: a quiet pencil turns the row into labelled fields; Enter or
// ABOUTME: Save commits (shown at once, rolled back if the save fails), Escape cancels.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SAVE_TOAST_ID } from "@/hooks/useUndoableSave";
import { cn } from "@/lib/utils";

export type InlineField<T> = {
  name: keyof T & string;
  label: string;
  type?: "text" | "textarea" | "date" | "number" | "select" | "tel" | "email";
  options?: readonly { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Spans the whole form width. Text areas always do. */
  wide?: boolean;
  /** The stored value as text in the field. Defaults to the value as a string. */
  format?: (value: T[keyof T]) => string;
  /** The field's text back as a stored value. Defaults to the trimmed text. */
  parse?: (text: string) => T[keyof T];
};

/**
 * The pencil, shown on hover or focus where there is a mouse and always on touch screens, the
 * same quiet pattern as the Labs row action.
 */
const PENCIL =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-[opacity,color,background-color] duration-200 ease-out hover:bg-secondary hover:text-ink focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none pointer-fine:opacity-0 pointer-fine:group-focus-within/edit:opacity-100 pointer-fine:group-hover/edit:opacity-100";

const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors duration-200 ease-out focus-visible:border-ink/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none";

const BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none disabled:opacity-50";

const asText = <T,>(field: InlineField<T>, value: T) => {
  const v = value[field.name];
  return field.format ? field.format(v) : v === null || v === undefined ? "" : String(v);
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function InlineEdit<T extends object>({
  value,
  fields,
  subject,
  onSave,
  onDelete,
  className,
  children,
}: {
  value: T;
  fields: InlineField<T>[];
  /** What the record is called, for "Edit <subject>" and the delete prompt. */
  subject: string;
  /** Saves the edited record; `prev` is what it replaces. A rejection rolls the row back. */
  onSave: (next: T, prev: T) => Promise<void>;
  /** Offers Delete (after a confirm) in the form. */
  onDelete?: () => Promise<void>;
  className?: string;
  /** The row as it reads, given the value to show and the pencil to place. */
  children: (shown: T, pencil: ReactNode) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  // The saved-but-not-yet-confirmed value, shown until the save settles.
  const [pending, setPending] = useState<T | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pendingSave = useRef(0);
  const pencilRef = useRef<HTMLButtonElement>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);
  const formId = useId();

  const shown = pending ?? value;

  useEffect(() => {
    if (editing) {
      firstFieldRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      pencilRef.current?.focus();
    }
  }, [editing]);

  function open() {
    setDraft(Object.fromEntries(fields.map((f) => [f.name, asText(f, shown)])));
    setEditing(true);
  }

  function close() {
    returnFocus.current = true;
    setEditing(false);
  }

  function commit() {
    const prev = shown;
    const next: Record<string, unknown> = { ...(prev as Record<string, unknown>) };
    for (const f of fields) {
      const text = draft[f.name] ?? "";
      next[f.name] = f.parse ? f.parse(text) : text.trim();
    }
    close();
    if (fields.every((f) => same(next[f.name], prev[f.name]))) return;

    const save = ++pendingSave.current;
    setPending(next as T);
    onSave(next as T, prev)
      // The caller reports the failure; showing the old value again is the rollback.
      .catch(() => undefined)
      .finally(() => {
        if (save === pendingSave.current) setPending(null);
      });
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const target = e.target as HTMLElement;
    // Buttons act on Enter themselves; a text area takes Enter as a new line.
    if (target instanceof HTMLButtonElement) return;
    if (target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    e.currentTarget.requestSubmit();
  }

  async function confirmDelete() {
    if (!onDelete) return;
    try {
      await onDelete();
      toast.success(`Removed ${subject}`, {
        id: SAVE_TOAST_ID,
        description: "You can undo this from Activity.",
      });
    } catch (e) {
      toast.error("Could not delete", {
        id: SAVE_TOAST_ID,
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const pencil = (
    <button
      ref={pencilRef}
      type="button"
      onClick={open}
      aria-label={`Edit ${subject}`}
      className={PENCIL}
    >
      <Pencil size={14} aria-hidden />
    </button>
  );

  return (
    <div className={cn("group/edit", className)} data-editing={editing || undefined}>
      {!editing ? (
        children(shown, pencil)
      ) : (
        <form
          aria-label={`Edit ${subject}`}
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
          onKeyDown={onKeyDown}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f, i) => {
              const id = `${formId}-${f.name}`;
              const common = {
                id,
                ref:
                  i === 0
                    ? (el: HTMLElement | null) => void (firstFieldRef.current = el)
                    : undefined,
                value: draft[f.name] ?? "",
                required: f.required,
                maxLength: f.maxLength,
                placeholder: f.placeholder,
              };
              const set = (text: string) => setDraft((d) => ({ ...d, [f.name]: text }));
              return (
                <div
                  key={f.name}
                  className={f.wide || f.type === "textarea" ? "sm:col-span-2" : undefined}
                >
                  <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
                    {f.label}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      {...common}
                      rows={3}
                      onChange={(e) => set(e.target.value)}
                      className={`${FIELD} resize-y py-2 leading-relaxed`}
                    />
                  ) : f.type === "select" ? (
                    <select
                      {...common}
                      onChange={(e) => set(e.target.value)}
                      className={`${FIELD} h-10`}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...common}
                      type={f.type ?? "text"}
                      step={f.type === "number" ? "any" : undefined}
                      min={f.type === "number" ? 0 : undefined}
                      onChange={(e) => set(e.target.value)}
                      className={`${FIELD} h-10 tabular-nums`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className={`${BUTTON} -ml-2 px-2.5 text-muted hover:bg-secondary hover:text-ink`}
              >
                <Trash2 size={14} aria-hidden />
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className={`${BUTTON} border border-line bg-surface text-ink hover:bg-secondary`}
              >
                Cancel
              </button>
              <button type="submit" className={`${BUTTON} bg-ink text-paper hover:bg-ink/90`}>
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {onDelete && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent className="rounded-[20px] border-line bg-surface sm:rounded-[20px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-2xl font-normal text-ink">
                Delete {subject}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted">
                It comes off the record for everyone. You can undo this from Activity.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Keep it</AlertDialogCancel>
              <AlertDialogAction className="rounded-xl" onClick={() => void confirmDelete()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
