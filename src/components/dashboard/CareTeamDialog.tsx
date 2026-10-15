import { useState, useEffect, useRef } from "react";
import type { CareTeamMember } from "@/hooks/useCareTeam";

export function CareTeamDialog({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: CareTeamMember | null;
  onClose: () => void;
  onSave: (item: Partial<CareTeamMember>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [whereBased, setWhereBased] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setRole(initial?.role ?? "");
      setWhereBased(initial?.where_based ?? "");
      setNote(initial?.note ?? "");
      setPhone(initial?.phone ?? "");
      setEmail(initial?.email ?? "");
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
        name: name.trim(),
        role: role.trim(),
        where_based: whereBased.trim(),
        note: note.trim(),
        phone: phone.trim(),
        email: email.trim(),
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
    if (!confirm("Remove this care team member?")) return;
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
      aria-labelledby="care-team-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-5 shadow-xl"
      >
        <h3 id="care-team-dialog-title" className="text-base font-semibold text-stone-900 mb-4">
          {initial?.id ? "Edit care team member" : "Add care team member"}
        </h3>

        <label className="block text-xs uppercase tracking-wider text-stone-500">Name</label>
        <input
          ref={firstRef}
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Dr. Jane Smith"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Role</label>
        <input
          maxLength={200}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Radiation oncology"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">
          Location
        </label>
        <input
          maxLength={200}
          value={whereBased}
          onChange={(e) => setWhereBased(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. Springfield, OH"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Phone</label>
        <input
          type="tel"
          maxLength={40}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. (555) 010-0123"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Email</label>
        <input
          type="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="e.g. jane.smith@example.com"
        />

        <label className="block text-xs uppercase tracking-wider text-stone-500 mt-4">Note</label>
        <textarea
          rows={3}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          placeholder="Relevant context, e.g. scan threshold, last seen date…"
        />

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
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
