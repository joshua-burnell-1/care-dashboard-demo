import { useState, useEffect, useRef } from "react";
import type { KpiCard } from "@/hooks/useKpiCards";

const TONES = ["rose", "warn", "info", "ok", "neutral"] as const;

export function KpiCardDialog({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: KpiCard | null;
  onClose: () => void;
  onSave: (item: Partial<KpiCard>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [sub, setSub] = useState("");
  const [tone, setTone] = useState<string>("neutral");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setValue(initial?.value ?? "");
      setSub(initial?.sub ?? "");
      setTone(initial?.tone ?? "neutral");
      setErr("");
      setTimeout(() => firstRef.current?.focus(), 0);
    }
  }, [open, initial]);

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
        id: initial?.id,
        label: label.trim(),
        value: value.trim(),
        sub: sub.trim(),
        tone,
        sort_index: initial?.sort_index ?? 0,
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
    if (!confirm("Delete this KPI card?")) return;
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="kpi-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 id="kpi-dialog-title" className="text-base font-semibold text-stone-900 mb-4">
          {initial?.id ? "Edit KPI card" : "Add KPI card"}
        </h3>

        <label className="block text-xs uppercase tracking-wider text-stone-500">Label</label>
        <input
          ref={firstRef}
          required
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Latest PSA"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Value</label>
        <input
          required
          maxLength={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. 0.15"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          Sub-label
        </label>
        <input
          maxLength={100}
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Mar 3 · ng/mL"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          Color tone
        </label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
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
            disabled={saving || !label.trim() || !value.trim()}
            className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
