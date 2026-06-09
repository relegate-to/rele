"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PromptSpec } from "@/hooks/sandbox-chat-protocol";
import { PromptForm, type PromptSubmit } from "./prompt-form";
import { PromptListener, type SendPromptReply } from "./prompt-listener";

interface PromptDialogProps {
  spec: PromptSpec | null;
  onSubmit: PromptSubmit;
  // Optional label above the title — useful when the prompt is from a
  // background session and the user wants context (e.g. "Installing ffmpeg").
  contextLabel?: string;
}

// Presentational. Renders a modal whenever `spec` is non-null and calls
// `onSubmit` when the user answers. Doesn't decide where the prompt comes
// from — pair with PromptListener (or PromptDialogListener) for that.
export function PromptDialog({ spec, onSubmit, contextLabel }: PromptDialogProps) {
  const open = spec !== null;
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        {spec && (
          <>
            <DialogHeader>
              {contextLabel && (
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  {contextLabel}
                </div>
              )}
              <DialogTitle>{spec.title ?? "rele is asking"}</DialogTitle>
              {spec.description && (
                <DialogDescription>{spec.description}</DialogDescription>
              )}
            </DialogHeader>
            <PromptForm spec={spec} onSubmit={onSubmit} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Convenience: listens to a session and pops a dialog when an unanswered
// prompt arrives. Drop one of these per background session you care about.
export function PromptDialogListener({ sessionKey, contextLabel }: { sessionKey?: string; contextLabel?: string }) {
  return (
    <PromptListener sessionKey={sessionKey}>
      {(current, reply: SendPromptReply) => (
        <PromptDialog
          spec={current?.spec ?? null}
          contextLabel={contextLabel}
          onSubmit={(display, structured) =>
            current && reply(current.spec.id, display, structured)
          }
        />
      )}
    </PromptListener>
  );
}
