import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
interface InterviewQuestionCardProps {
  index: number;
  total: number;
  progress: number;
  question: string;
  onBack: () => void;
  children: ReactNode;
}
export function InterviewQuestionCard({
  index,
  total,
  progress,
  question,
  onBack,
  children,
}: InterviewQuestionCardProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 rounded-full"
            aria-label={index > 0 ? "Back to previous question" : "Back to interview setup"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground">
            Question <span className="text-foreground">{index + 1}</span> of {total}
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{progress}%</p>
      </div>
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <h1 className="max-w-4xl font-display text-lg font-bold leading-relaxed text-foreground sm:text-xl xl:text-2xl">
        {question}
      </h1>
      {children}
    </>
  );
}
