import { useState, useEffect, useRef } from "react";
import type { PsaReading } from "@/hooks/usePsaReadings";

const PHASES = ["pre-op", "post-op", "post-rad"] as const;

export function PsaReadingDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<PsaReading>) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("ng/mL");
  const [phase, setPhase] = useState<string>("post-rad");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDate("");
      setValue("");
      setUnit("ng/mL");
      setPhase("post-rad");
      setNote("");
      setErr("");
      setTimeout(() => firstRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await onSave({
        date,
        value: value.trim() === "" ? null : Number(value),
        unit: unit.trim() || "ng/mL",
        phase,
        note: note.trim(),
        sort_index: 0,
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
      aria-labelledby="psa-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 id="psa-dialog-title" className="text-base font-semibold text-stone-900 mb-4">
          Add PSA reading
        </h3>

        <label className="block text-xs uppercase tracking-wider text-stone-500">Date</label>
        <input
          ref={firstRef}
          required
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          PSA value (ng/mL)
        </label>
        <input
          type="number"
          step="any"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. 0.15  (leave blank if not yet drawn)"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Unit</label>
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="ng/mL"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Phase</label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
        >
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Note</label>
        <textarea
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Ultrasensitive assay, same lab"
        />

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
            disabled={saving || !date}
            className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
