"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTranslation } from "../_context/i18n-context";

const DEFAULT_IMAGE = "ghcr.io/relegate-to/openclaw-sandbox:latest";

interface CreateMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (config: { image: string; region?: string }) => Promise<void>;
}

const REGIONS = [
  { value: "sin", labelKey: "create-machine.region.singapore" },
  { value: "sjc", labelKey: "create-machine.region.san-jose" },
  { value: "iad", labelKey: "create-machine.region.ashburn" },
  { value: "ams", labelKey: "create-machine.region.amsterdam" },
  { value: "nrt", labelKey: "create-machine.region.tokyo" },
  { value: "syd", labelKey: "create-machine.region.sydney" },
] as const;

export function CreateMachineDialog({ open, onOpenChange, onCreate }: CreateMachineDialogProps) {
  const { t } = useTranslation();
  const [region, setRegion] = useState("sin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      await onCreate({ image: DEFAULT_IMAGE, region });
      setRegion("sin");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create-machine.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-[var(--surface)] border-[var(--border)] text-[var(--text)]">
        <DialogHeader>
          <DialogTitle className="font-semibold text-lg">
            {t("create-machine.title")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="region" className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)]">
              {t("create-machine.region")}
            </Label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.labelKey)} ({r.value})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="font-[var(--font-dm-mono),monospace] text-xs text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[var(--border)] text-[var(--muted)]"
            >
              {t("create-machine.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[var(--accent)] text-white hover:bg-[var(--accent-dim)]"
            >
              {submitting ? t("create-machine.creating") : t("create-machine.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
