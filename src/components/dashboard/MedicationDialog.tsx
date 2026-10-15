import { useState, useEffect, useRef } from "react";
import type { MedicationItem } from "@/hooks/useMedications";

export function MedicationDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<MedicationItem>) => Promise<void>;
}) {
  const [item, setItem] = useState("");
  const [dose, setDose] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startedBy, setStartedBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setItem("");
      setDose("");
      setPurpose("");
      setStartedBy("");
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
        item: item.trim(),
        dose: dose.trim(),
        purpose: purpose.trim(),
        started_by: startedBy.trim(),
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
      aria-labelledby="medication-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 id="medication-dialog-title" className="text-base font-semibold text-stone-900 mb-4">
          Add medication
        </h3>

        <label className="block text-xs uppercase tracking-wider text-stone-500">
          Medication / supplement
        </label>
        <input
          ref={firstRef}
          required
          maxLength={300}
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Vitamin D3"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Dose</label>
        <input
          maxLength={300}
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. 2,000 IU/day"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          Purpose
        </label>
        <input
          maxLength={500}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Immune support"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          Started by / ordered by
        </label>
        <input
          maxLength={200}
          value={startedBy}
          onChange={(e) => setStartedBy(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. your primary care doctor"
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
            disabled={saving || !item.trim()}
            className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
