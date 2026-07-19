import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
interface PauseCancelConfirmationProps {
  loading: boolean;
  onClose: () => void;
  onCancel: () => void;
}
export function PauseCancelConfirmation({
  loading,
  onClose,
  onCancel,
}: PauseCancelConfirmationProps) {
  return (
    <div className="p-6 sm:p-8">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-red-400/20 bg-red-500/10">
          <Video className="h-5 w-5 text-red-300" aria-hidden="true" />
        </div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.22em] text-white/40">
          Confirmation required
        </p>
        <h2 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
          Cancel this interview session?
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          Your unfinished answer will not be evaluated. The current interview session will be marked
          as cancelled and you will return to the dashboard.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-h-12 rounded-full border-white/15 bg-transparent text-white hover:bg-white/10"
          >
            Keep Interview
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onCancel}
            disabled={loading}
            className="min-h-12 rounded-full"
          >
            {loading ? "Cancelling session…" : "Yes, Cancel Session"}
          </Button>
        </div>
      </div>
    </div>
  );
}
