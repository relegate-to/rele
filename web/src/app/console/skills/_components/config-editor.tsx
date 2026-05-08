"use client";

// JSON config editor for a skill's pluginConfig. Reads the current gateway
// config to obtain its `hash` (for optimistic concurrency), then patches
// `plugins.entries[skillId]` with the user's edited JSON.

import { useState } from "react";
import { useGateway } from "../../_context/gateway-context";

export function ConfigEditor({
  skillId,
  initial,
  onSaved,
}: {
  skillId: string;
  initial: Record<string, unknown> | null;
  onSaved: () => void;
}) {
  const { rpc } = useGateway();
  const [value, setValue] = useState(initial ? JSON.stringify(initial, null, 2) : "{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const parsed = JSON.parse(value);
      const config = await rpc("config.get");
      const hash = (config as Record<string, unknown>)?.hash as string | undefined;
      await rpc("config.patch", {
        patch: { plugins: { entries: { [skillId]: parsed } } },
        ...(hash ? { hash } : {}),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none resize-none"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
      {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hi)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save config"}
      </button>
    </div>
  );
}
