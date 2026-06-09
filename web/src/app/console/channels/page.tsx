"use client";

// Channels console — full catalog of OpenClaw chat adapters with per-channel
// configuration via a schema-driven dialog. Sorted by status so the channels
// you've actually configured float to the top.

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircleIcon, SearchIcon, XCircleIcon } from "lucide-react";
import { EASE } from "@/lib/theme";
import { useGateway } from "../_context/gateway-context";
import {
  CHANNELS_BY_ID,
  deriveChannelStates,
  type ChannelDef,
  type ChannelState,
} from "./_lib/channels";
import { getConfig, patchChannelSlice } from "./_lib/config-io";
import { ChannelCard } from "./_components/channel-card";
import { ChannelDialog } from "./_components/channel-dialog";
import { AboutChannelsDialog } from "./_components/about-dialog";

export default function ChannelsPage() {
  const { connected, rpc } = useGateway();
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openChannelId, setOpenChannelId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { value } = await getConfig(rpc);
      setConfig(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    if (connected) refresh();
  }, [connected, refresh]);

  const states = useMemo(() => deriveChannelStates(config), [config]);

  // Sort: connected → needs-setup → disabled → available, alpha within each.
  const sorted = useMemo(() => {
    const rank = (s: ChannelState) => {
      if (!s.slice) return 3;            // available
      if (!s.configured) return 1;       // needs setup
      if (!s.enabled) return 2;          // disabled
      return 0;                          // connected
    };
    return [...states].sort((a, b) => {
      const r = rank(a) - rank(b);
      return r !== 0 ? r : a.def.label.localeCompare(b.def.label);
    });
  }, [states]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.def.label.toLowerCase().includes(q) ||
        s.def.id.toLowerCase().includes(q) ||
        s.def.tagline.toLowerCase().includes(q),
    );
  }, [sorted, search]);

  const handleToggle = useCallback(
    async (def: ChannelDef, next: boolean) => {
      // Optimistic update.
      setConfig((cfg) => {
        if (!cfg) return cfg;
        const channels = { ...((cfg.channels as Record<string, unknown>) ?? {}) };
        const slice = (channels[def.id] as Record<string, unknown>) ?? {};
        channels[def.id] = { ...slice, enabled: next };
        return { ...cfg, channels };
      });
      try {
        await patchChannelSlice(rpc, def.id, { enabled: next });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Toggle failed");
        refresh();
      }
    },
    [rpc, refresh],
  );

  const openDef = openChannelId ? CHANNELS_BY_ID[openChannelId] ?? null : null;
  const openSlice = useMemo(() => {
    if (!openChannelId || !config) return null;
    const channels = (config.channels as Record<string, unknown>) ?? {};
    const raw = channels[openChannelId];
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  }, [openChannelId, config]);

  return (
    <div className="h-[100svh] relative flex flex-col">
      <button
        onClick={() => setAboutOpen(true)}
        className="absolute right-6 bottom-6 z-20 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors shadow-sm"
      >
        <HelpCircleIcon className="size-3.5" />
        What are channels?
      </button>
      <div className="flex-1 overflow-y-auto stable-gutter">
        <div className="relative bg-[var(--bg)] text-[var(--text)]">
          <div className="relative z-10 mx-auto px-8 py-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {/* Toolbar */}
              <div className="mb-4 flex justify-center">
                <div className="relative w-85">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    placeholder="Search channels…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-4 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)]/60 focus:outline-none transition-colors"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                    >
                      <XCircleIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {loading && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-28 animate-pulse rounded-md border border-[var(--border-hi)] bg-[var(--surface)]"
                    />
                  ))}
                </div>
              )}

              {!loading && error && (
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-5 py-4">
                  <XCircleIcon className="size-4 shrink-0 text-[var(--status-error)]" />
                  <p className="text-sm text-[var(--status-error-text)]">{error}</p>
                </div>
              )}

              {!loading && !error && (
                <>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
                    <AnimatePresence mode="popLayout">
                      {filtered.map((state) => (
                        <motion.div
                          key={state.def.id}
                          layout="position"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2, layout: { duration: 0.25, ease: EASE } }}
                          className="will-change-[transform,opacity]"
                        >
                          <ChannelCard
                            state={state}
                            onOpen={() => setOpenChannelId(state.def.id)}
                            onToggle={(next) => handleToggle(state.def, next)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {filtered.length === 0 && (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center"
                      >
                        <p className="text-sm text-[var(--muted)]">
                          {search.trim() ? `No channels match "${search}"` : "No channels"}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <ChannelDialog
        def={openDef}
        initialSlice={openSlice}
        open={!!openChannelId}
        onOpenChange={(open) => !open && setOpenChannelId(null)}
        onSaved={refresh}
      />

      <AboutChannelsDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}
