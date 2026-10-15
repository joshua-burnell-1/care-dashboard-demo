// ABOUTME: The Add plan item dialog. Existing items are edited in place on the Plan pages.
import { useState, useEffect, useId } from "react";
import type { PlanItem } from "@/hooks/usePlanItems";
import { PLAN_STATUSES } from "@/lib/plan";

export function PlanItemDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<PlanItem>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [eventDate, setEventDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const id = useId();

  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setStatus("Scheduled");
      setEventDate("");
      setErr("");
    }
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSave({
        title: title.trim(),
        body: body.trim(),
        status,
        event_date: eventDate || null,
      });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 id={`${id}-title`} className="text-base font-semibold text-stone-900 mb-4">
          Add plan item
        </h3>

        <label
          htmlFor={`${id}-date`}
          className="block text-xs uppercase tracking-wider text-stone-500 mt-3"
        >
          Date (optional)
        </label>
        <input
          id={`${id}-date`}
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-stone-500 mt-1">Leave blank for ongoing or on-hold items.</p>

        <label
          htmlFor={`${id}-title-field`}
          className="block text-xs uppercase tracking-wider text-stone-500 mt-4"
        >
          Title
        </label>
        <input
          id={`${id}-title-field`}
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. PSMA PET/CT scan"
        />

        <label
          htmlFor={`${id}-notes`}
          className="block text-xs uppercase tracking-wider text-stone-500 mt-4"
        >
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="What this is, what to bring, who to contact…"
        />

        <label
          htmlFor={`${id}-status`}
          className="block text-xs uppercase tracking-wider text-stone-500 mt-4"
        >
          Status
        </label>
        <select
          id={`${id}-status`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
        >
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {err && <p className="mt-3 text-xs text-rose-700">{err}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 text-sm text-stone-700 rounded-lg hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
