import { CheckCircle2, Lightbulb } from "lucide-react";

import type { Question } from "@/lib/types";
import { TIPS } from "../constants";
import type { ExtendedInterviewSetup } from "../types";

interface InterviewSidebarProps {
  questions: Question[];
  index: number;
  activeQuestionIndex: number;
  submittedQuestionIds: number[];
  setup: ExtendedInterviewSetup;
  modeLabel: string;
  speechClarity: number;
  wordsPerMinute: number;
  cameraStatus: string;
}

export function InterviewSidebar({
  questions,
  index,
  activeQuestionIndex,
  submittedQuestionIds,
  setup,
  modeLabel,
  speechClarity,
  wordsPerMinute,
  cameraStatus,
}: InterviewSidebarProps) {
  const submittedIds = new Set(
    submittedQuestionIds,
  );

  return (
    <aside className="space-y-6">
      <section className="app-panel p-4">
        <h3 className="text-sm font-semibold">
          Session Progress
        </h3>

        <div className="mt-3 space-y-1.5">
          {questions.map(
            (
              question,
              questionIndex,
            ) => {
              const submitted =
                submittedIds.has(
                  question.id,
                );

              const selected =
                questionIndex === index;

              const active =
                questionIndex ===
                  activeQuestionIndex &&
                !submitted;

              const locked =
                questionIndex >
                activeQuestionIndex;

              return (
                <div
                  key={question.id}
                  className={`flex gap-3 rounded-2xl px-3 py-2 text-sm transition ${
                    selected
                      ? "bg-accent text-accent-foreground"
                      : locked
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                      submitted
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-foreground text-background"
                          : "bg-muted"
                    }`}
                  >
                    {submitted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      questionIndex + 1
                    )}
                  </span>

                  <span className="line-clamp-2 leading-relaxed">
                    {question.text}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </section>

      <section className="app-panel p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Lightbulb className="h-4 w-4" />
          Quick Tips
        </div>

        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {TIPS.map((tip) => (
            <li key={tip}>
              • {tip}
            </li>
          ))}
        </ul>
      </section>

      <section className="app-panel p-5">
        <h3 className="text-sm font-semibold text-primary">
          Interview Context
        </h3>

        <div className="mt-4 space-y-3 text-sm">
          <ContextRow
            label="Company"
            value={
              setup.targetCompany ||
              "No company selected"
            }
          />

          <ContextRow
            label="Role"
            value={
              setup.targetRole ||
              setup.role ||
              "No role selected"
            }
          />

          <ContextRow
            label="Interview Type"
            value={setup.type}
          />

          <ContextRow
            label="Experience Level"
            value={setup.difficulty}
          />

          <ContextRow
            label="Mode"
            value={modeLabel}
          />

          <ContextRow
            label="Resume"
            value={
              setup.resume?.fileName ||
              "No resume selected"
            }
          />

          <ContextRow
            label="Company Research"
            value={
              setup.companyContext
                ? setup.companyContext
                    .source
                : "Not loaded"
            }
          />
        </div>
      </section>

      <section className="app-panel p-5">
        <h3 className="text-sm font-semibold text-primary">
          Live Signals
        </h3>

        <div className="mt-4 space-y-3 text-sm">
          <ContextRow
            label="Speech"
            value={
              modeLabel === "Text"
                ? "Not captured"
                : `${speechClarity}% clarity`
            }
          />

          <ContextRow
            label="Pace"
            value={
              modeLabel === "Text"
                ? "Not captured"
                : `${wordsPerMinute} wpm`
            }
          />

          <ContextRow
            label="Camera"
            value={cameraStatus}
          />
        </div>
      </section>
    </aside>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="font-medium text-foreground">
        {label}:
      </span>

      <span className="text-muted-foreground">
        {value}
      </span>
    </div>
  );
}