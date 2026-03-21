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

const DEFAULT_IMAGE = "ghcr.io/relegate-to/openclaw-sandbox:latest";

interface CreateMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (config: { image: string; region?: string }) => Promise<void>;
}

const REGIONS = [
  { value: "sin", label: "Singapore" },
  { value: "sjc", label: "San Jose" },
  { value: "iad", label: "Ashburn" },
  { value: "ams", label: "Amsterdam" },
  { value: "nrt", label: "Tokyo" },
  { value: "syd", label: "Sydney" },
] as const;

export function CreateMachineDialog({ open, onOpenChange, onCreate }: CreateMachineDialogProps) {
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
      setError(err instanceof Error ? err.message : "Failed to create machine");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-[var(--surface)] border-[var(--border)] text-[var(--text)]">
        <DialogHeader>
          <DialogTitle className="font-['Lora',Georgia,serif] italic text-lg">
            New Instance
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="region" className="font-[var(--font-dm-mono),monospace] text-xs text-[var(--muted)]">
              Region
            </Label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1 font-[var(--font-dm-mono),monospace] text-sm text-[var(--text)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} ({r.value})
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#c8845a] text-white hover:bg-[#b5744d]"
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
