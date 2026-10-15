import { useState, useEffect } from "react";
import type { PlanItem } from "@/hooks/usePlanItems";

const STATUSES = ["Locked", "Scheduled", "In flight", "Conditional", "Hold", "Daily", "Completed"];

export function PlanItemDialog({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: PlanItem | null;
  onClose: () => void;
  onSave: (item: Partial<PlanItem>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Scheduled");
  const [eventDate, setEventDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setBody(initial?.body ?? "");
      setStatus(initial?.status ?? "Scheduled");
      setEventDate(initial?.event_date ?? "");
      setErr("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSave({
        id: initial?.id,
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

  async function handleDelete() {
    if (!initial?.id || !onDelete) return;
    if (!confirm("Delete this plan item?")) return;
    setSaving(true);
    try {
      await onDelete(initial.id);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 className="text-base font-semibold text-stone-900 mb-4">
          {initial?.id ? "Edit plan item" : "Add plan item"}
        </h3>

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-3">
          Date (optional)
        </label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <p className="text-[11px] text-stone-500 mt-1">Leave blank for ongoing or on-hold items.</p>

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Title</label>
        <input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. PSMA PET/CT scan"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Notes</label>
        <textarea
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="What this is, what to bring, who to contact…"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {err && <p className="mt-3 text-xs text-rose-700">{err}</p>}

        <div className="mt-5 flex items-center gap-2">
          {initial?.id && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="text-xs text-rose-700 hover:underline mr-auto"
            >
              Delete
            </button>
          )}
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
