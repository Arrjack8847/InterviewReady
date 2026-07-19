import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  index: number;
  total: number;
  answer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
}

export function QuestionCard({
  question,
  index,
  total,
  answer,
  onAnswerChange,
  onSubmit,
  loading,
  disabled,
}: Props) {
  return (
    <section className="app-panel p-6 sm:p-8" aria-labelledby="interview-question">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Question <span className="font-semibold text-foreground">{index + 1}</span> of {total}
        </span>
        <span>{Math.round(((index + 1) / total) * 100)}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>
      <h2
        id="interview-question"
        className="mt-6 font-display text-2xl font-semibold leading-snug sm:text-3xl"
      >
        {question.text}
      </h2>
      <Textarea
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        placeholder="Type your answer here. Take your time — explain the situation, your action, and the result…"
        className="mt-6 min-h-48 resize-none text-base"
        disabled={disabled || loading}
      />

      {loading && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-primary">Analyzing your answer…</p>
            <p className="text-xs text-muted-foreground">
              Scoring clarity, structure, and role-specific knowledge.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {answer.trim().split(/\s+/).filter(Boolean).length} words
        </p>
        <Button
          onClick={onSubmit}
          disabled={loading || disabled || answer.trim().length < 5}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              Submit Answer <Send className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
