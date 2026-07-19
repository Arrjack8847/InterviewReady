import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
interface ExitInterviewDialogProps {
  open: boolean;
  loading: boolean;
  onContinueLater: () => void;
  onCancel: () => void;
  onClose: () => void;
}
export function ExitInterviewDialog({
  open,
  loading,
  onContinueLater,
  onCancel,
  onClose,
}: ExitInterviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-elegant outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-interview-title"
        aria-describedby="exit-interview-description"
        tabIndex={-1}
      >
        <h2 id="exit-interview-title" className="font-display text-xl font-semibold">
          Leave interview?
        </h2>
        <p
          id="exit-interview-description"
          className="mt-2 text-sm leading-relaxed text-muted-foreground"
        >
          You have an unfinished interview session. What would you like to do?
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onContinueLater} disabled={loading}>
            Continue Later
          </Button>
          <Button type="button" variant="destructive" onClick={onCancel} disabled={loading}>
            Cancel Session
          </Button>
          <Button type="button" onClick={onClose} disabled={loading}>
            Stay in Interview
          </Button>
        </div>
      </div>
    </div>
  );
}
