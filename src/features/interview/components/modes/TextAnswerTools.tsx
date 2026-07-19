import { FileText, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function TextAnswerTools({ onReadQuestion }: { onReadQuestion: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            Text mode
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Type your answer manually. You can also listen to the question before answering.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onReadQuestion}>
          <Volume2 className="mr-2 h-4 w-4" />
          Read Question
        </Button>
      </div>
    </div>
  );
}
