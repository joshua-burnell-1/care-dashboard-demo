// ABOUTME: The edit history list: recent changes across the record with a diff per row and a
// ABOUTME: one-click restore. Rendered on the /activity page.
import { useState } from "react";
import { useEditHistory, tableLabel, type EditHistoryEntry } from "@/hooks/useEditHistory";
import { supabase } from "@/integrations/supabase/client";

const opColors = {
  INSERT: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-rose-100 text-rose-800",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function describeEntry(entry: EditHistoryEntry): string {
  const data = entry.new_data ?? entry.old_data;
  if (!data) return entry.record_id;
  if ("title" in data) return String(data.title).slice(0, 60);
  if ("label" in data) return String(data.label).slice(0, 60);
  if ("name" in data) return String(data.name).slice(0, 60);
  if ("item" in data) return String(data.item).slice(0, 60);
  if ("date" in data) return String(data.date);
  if ("key" in data) return String(data.key);
  return entry.record_id.slice(0, 8);
}

function DiffRow({ label, oldVal, newVal }: { label: string; oldVal: unknown; newVal: unknown }) {
  const o = oldVal == null ? "—" : String(oldVal);
  const n = newVal == null ? "—" : String(newVal);
  if (o === n) return null;
  return (
    <div className="text-xs py-1 border-b border-stone-100 last:border-0">
      <span className="text-stone-400 uppercase tracking-wider text-[10px]">{label}</span>
      <div className="flex gap-2 mt-0.5 flex-wrap">
        <span className="line-through text-rose-600 break-all">{o}</span>
        <span className="text-emerald-700 break-all">{n}</span>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  password,
  onRestored,
}: {
  entry: EditHistoryEntry;
  password: string;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [err, setErr] = useState("");

  const changedKeys =
    entry.operation === "UPDATE" && entry.old_data && entry.new_data
      ? Object.keys(entry.new_data).filter(
          (k) =>
            !["updated_at", "created_at"].includes(k) &&
            JSON.stringify(entry.old_data![k]) !== JSON.stringify(entry.new_data![k]),
        )
      : [];

  async function restore() {
    setRestoring(true);
    setErr("");
    try {
      const { data, error } = await supabase.functions.invoke("dashboard-data", {
        body: { action: "rollback", password, history_id: entry.id },
      });
      if (error || !data?.ok) throw new Error(data?.error || "Restore failed");
      onRestored();
      setOpen(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        className="w-full text-left px-4 py-3 hover:bg-stone-50 transition"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${opColors[entry.operation]}`}
          >
            {entry.operation}
          </span>
          <span className="text-xs font-medium text-stone-700">{tableLabel(entry.table_name)}</span>
          <span className="text-xs text-stone-500 truncate max-w-[140px]">
            {describeEntry(entry)}
          </span>
          <span className="ml-auto text-[11px] text-stone-400 shrink-0">
            {relativeTime(entry.changed_at)}
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3">
          {entry.operation === "UPDATE" && changedKeys.length > 0 && (
            <div className="mb-2">
              {changedKeys.map((k) => (
                <DiffRow
                  key={k}
                  label={k}
                  oldVal={entry.old_data![k]}
                  newVal={entry.new_data![k]}
                />
              ))}
            </div>
          )}
          {entry.operation === "DELETE" && (
            <p className="text-xs text-stone-500 mb-2">This record was deleted.</p>
          )}
          {entry.operation === "INSERT" && (
            <p className="text-xs text-stone-500 mb-2">This record was added.</p>
          )}
          {err && <p className="text-xs text-rose-700 mb-2">{err}</p>}
          <button
            onClick={restore}
            disabled={restoring}
            className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-lg disabled:opacity-50 hover:bg-stone-700 transition"
          >
            {restoring
              ? "Restoring…"
              : entry.operation === "INSERT"
                ? "Undo (delete this)"
                : "Restore previous"}
          </button>
        </div>
      )}
    </div>
  );
}

/** The last 50 edits across the record, newest first; open a row to see the diff and restore. */
export function EditHistoryList({ password }: { password: string }) {
  const { entries, loading, refresh } = useEditHistory();

  if (loading) return <p className="px-4 py-6 text-sm text-stone-500">Loading…</p>;
  if (entries.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-stone-500">
        No edits yet. Changes will appear here after you edit something.
      </p>
    );
  }
  return (
    <div>
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} password={password} onRestored={refresh} />
      ))}
    </div>
  );
}
