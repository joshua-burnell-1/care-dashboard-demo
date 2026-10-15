// ABOUTME: Asks the demo viewer for their own Anthropic API key before an AI feature runs.
// ABOUTME: Shared by chat and the other bring-your-own-key surfaces; the key never leaves the tab except to Anthropic.

import { useId, useState } from "react";

export function ApiKeyForm({ onSave, error }: { onSave: (key: string) => void; error?: string }) {
  const [value, setValue] = useState("");
  const inputId = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const key = value.trim();
    if (!key) return;
    setValue("");
    onSave(key);
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-line bg-secondary p-3">
      <label htmlFor={inputId} className="block text-xs font-medium text-ink">
        Anthropic API key
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          className="flex-1 min-w-0 rounded-lg border border-input bg-surface px-3 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="shrink-0 rounded-lg bg-accent text-accent-foreground text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          Use key
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-act">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        Your key stays in this browser tab and is sent only to Anthropic.
      </p>
    </form>
  );
}
