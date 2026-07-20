import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Info,
  Lightbulb,
  Mic,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { PersistedAnswerMetrics } from "@/features/interview/scoring/scoringTypes";
import { toTenPointDisplayScore } from "@/lib/metrics";
import type { Feedback } from "@/lib/types";

function getDisplayScore(
  feedback: Feedback,
  value: number,
): number {
  return toTenPointDisplayScore(
    value,
    feedback.scoreScale || "ten",
  );
}

function ScoreRow({
  label,
  value,
  feedback,
}: {
  label: string;
  value: number;
  feedback: Feedback;
}) {
  const displayValue = getDisplayScore(
    feedback,
    value,
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {label}
        </span>

        <span className="font-semibold text-foreground">
          {displayValue}/10
        </span>
      </div>

      <Progress
        value={displayValue * 10}
        className="mt-1.5 h-2"
      />
    </div>
  );
}

function NormalizedScoreRow({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  const normalizedValue =
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.min(
          100,
          Math.max(0, Math.round(value)),
        )
      : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {label}
        </span>

        <span className="font-semibold text-foreground">
          {normalizedValue === null
            ? "Not measurable"
            : `${normalizedValue}/100`}
        </span>
      </div>

      <Progress
        value={normalizedValue ?? 0}
        className="mt-1.5 h-2"
      />
    </div>
  );
}

type ValidityNotice = {
  title: string;
  description: string;
  destructive: boolean;
};

function getValidityNotice(
  feedback: Feedback,
): ValidityNotice | null {
  switch (feedback.answerValidity) {
    case "blank":
      return {
        title: "No answer was submitted",
        description:
          "The system could not evaluate your interview skills because no answer was provided.",
        destructive: true,
      };

    case "nonsense":
      return {
        title: "No meaningful answer was detected",
        description:
          "The response did not contain enough understandable information to answer the interview question.",
        destructive: true,
      };

    case "non_answer":
      return {
        title: "The question was not answered",
        description:
          "Responses such as “I don’t know”, “skip”, or “no idea” do not provide the example, reasoning, or explanation expected by the interviewer.",
        destructive: true,
      };

    case "unrelated":
      return {
        title: "The answer was not connected to the question",
        description:
          "The response was understandable, but it did not address what the interviewer asked.",
        destructive: true,
      };

    case "partially_meaningful":
      return {
        title: "Your answer has a useful starting point",
        description:
          "The response contains a relevant idea, but it needs more explanation, evidence, or structure.",
        destructive: false,
      };

    default:
      return null;
  }
}

function AnswerValidityNotice({
  notice,
}: {
  notice: ValidityNotice;
}) {
  const Icon = notice.destructive
    ? AlertTriangle
    : Info;

  return (
    <div
      role="status"
      className={[
        "mt-5 rounded-xl border p-4",
        notice.destructive
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/25 bg-primary/5",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={[
            "mt-0.5 h-5 w-5 shrink-0",
            notice.destructive
              ? "text-destructive"
              : "text-primary",
          ].join(" ")}
        />

        <div>
          <p className="text-sm font-semibold text-foreground">
            {notice.title}
          </p>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {notice.description}
          </p>
        </div>
      </div>
    </div>
  );
}

function EvaluationSourceNotice({
  feedback,
}: {
  feedback: Feedback;
}) {
  const fallbackUsed =
    feedback.fallbackUsed ||
    feedback.source === "fallback" ||
    feedback.source === "local-fallback";

  if (!fallbackUsed && !feedback.warning) {
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-muted/60 p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

        <div>
          <p className="text-sm font-semibold text-foreground">
            Evaluation information
          </p>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {feedback.warning ||
              "Detailed AI evaluation was unavailable, so a conservative local evaluation was used."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FeedbackCard({
  feedback,
}: {
  feedback: Feedback;
}) {
  const overallDisplayScore =
    getDisplayScore(
      feedback,
      feedback.overall,
    );

  const contentLabel =
    feedback.questionType === "technical"
      ? "Role-Specific Content"
      : "Answer Content";

  const answerMetrics =
    feedback.answerMetrics;

  const validityNotice =
    getValidityNotice(feedback);

  const strengths =
    feedback.strengths
      .map((item) => item.trim())
      .filter(Boolean);

  const weaknesses =
    feedback.weaknesses
      .map((item) => item.trim())
      .filter(Boolean);

  const improvedAnswer =
    feedback.improvedAnswer?.trim() || "";

  const interviewTip =
    feedback.interviewTip?.trim() || "";

  const hasProfessionalismScore =
    typeof feedback.professionalismScore ===
      "number" &&
    Number.isFinite(
      feedback.professionalismScore,
    );

  return (
    <article className="app-panel p-6 sm:p-8">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-foreground text-background">
          <span className="font-display text-lg font-bold">
            {overallDisplayScore}
          </span>
        </div>

        <div>
          <h3 className="font-display text-xl font-semibold">
            AI Feedback
          </h3>

          <p className="text-sm text-muted-foreground">
            {feedback.scoreLabel ||
              "Answer quality score"}
            : {overallDisplayScore}/10
          </p>
        </div>
      </header>

      {validityNotice && (
        <AnswerValidityNotice
          notice={validityNotice}
        />
      )}

      <p className="mt-5 rounded-xl bg-surface-muted p-4 text-sm leading-relaxed">
        {feedback.summary}
      </p>

      <EvaluationSourceNotice
        feedback={feedback}
      />

      <section className="mt-6">
        <div className="mb-4">
          <h4 className="font-display text-lg font-semibold">
            Answer quality
          </h4>

          <p className="mt-1 text-sm text-muted-foreground">
            These scores evaluate what you said,
            not your microphone or camera quality.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreRow
            label="Clarity"
            value={feedback.clarity}
            feedback={feedback}
          />

          <ScoreRow
            label="Relevance"
            value={feedback.relevance}
            feedback={feedback}
          />

          <ScoreRow
            label="Structure"
            value={feedback.structure}
            feedback={feedback}
          />

          <ScoreRow
            label={contentLabel}
            value={feedback.technicalAccuracy}
            feedback={feedback}
          />

          {hasProfessionalismScore && (
            <ScoreRow
              label="Professionalism"
              value={
                feedback.professionalismScore ??
                0
              }
              feedback={feedback}
            />
          )}
        </div>
      </section>

      {answerMetrics && (
        <AnswerDeliveryFeedback
          metrics={answerMetrics}
        />
      )}

      {(strengths.length > 0 ||
        weaknesses.length > 0) && (
        <div
          className={[
            "mt-6 grid gap-4",
            strengths.length > 0 &&
            weaknesses.length > 0
              ? "sm:grid-cols-2"
              : "grid-cols-1",
          ].join(" ")}
        >
          {strengths.length > 0 && (
            <FeedbackList
              title="What you did well"
              items={strengths}
              variant="success"
            />
          )}

          {weaknesses.length > 0 && (
            <FeedbackList
              title="Areas to improve"
              items={weaknesses}
              variant="destructive"
            />
          )}
        </div>
      )}

      {improvedAnswer && (
        <div className="mt-4 rounded-xl border border-border bg-accent/40 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
            <Lightbulb className="h-4 w-4" />
            Improved answer example
          </div>

          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
            {improvedAnswer}
          </p>

          {feedback.answerValidity ===
            "non_answer" && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Use this as a structure only.
              Replace it with a truthful example
              from your own training, studies,
              projects, work, or volunteering.
            </p>
          )}
        </div>
      )}

      {interviewTip && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Lightbulb className="h-4 w-4" />
            Interview tip
          </div>

          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {interviewTip}
          </p>
        </div>
      )}
    </article>
  );
}

function AnswerDeliveryFeedback({
  metrics,
}: {
  metrics: PersistedAnswerMetrics;
}) {
  const speechApplicable =
    metrics.measurementStatus
      .speechDelivery !==
    "not_applicable";

  const visualApplicable =
    metrics.measurementStatus
      .visualPresentation !==
    "not_applicable";

  const integrityEventCount =
    metrics.integrityEvents?.length ?? 0;

  const noFaceEventCount =
    metrics.raw.noFaceEventCount ?? 0;

  const multipleFaceEventCount =
    metrics.raw
      .multipleFaceEventCount ?? 0;

  const automaticPauseCount =
    metrics.raw.automaticPauseCount ?? 0;

  const hasIntegrityInformation =
    integrityEventCount > 0 ||
    noFaceEventCount > 0 ||
    multipleFaceEventCount > 0 ||
    automaticPauseCount > 0 ||
    (metrics.raw.pausedDurationMs ??
      0) > 0;

  if (
    !speechApplicable &&
    !visualApplicable &&
    !hasIntegrityInformation
  ) {
    return null;
  }

  return (
    <div className="mt-7 space-y-4">
      {speechApplicable && (
        <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mic className="h-4 w-4" />
            </div>

            <div>
              <h4 className="font-display text-lg font-semibold">
                Speech delivery
              </h4>

              <p className="mt-1 text-sm text-muted-foreground">
                Delivery is shown separately
                from answer quality.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NormalizedScoreRow
              label="Speech delivery"
              value={
                metrics.normalized
                  .speechDelivery
              }
            />

            <NormalizedScoreRow
              label="Audio clarity"
              value={
                metrics.normalized
                  .audioQuality
              }
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox
              label="Speaking pace"
              value={
                typeof metrics.raw
                  .wordsPerMinute ===
                "number"
                  ? `${Math.round(
                      metrics.raw
                        .wordsPerMinute,
                    )} wpm`
                  : "Not measurable"
              }
            />

            <MetricBox
              label="Filler words"
              value={
                typeof metrics.raw
                  .fillerCount === "number"
                  ? Math.round(
                      metrics.raw
                        .fillerCount,
                    )
                  : "Not measurable"
              }
            />

            <MetricBox
              label="Long pauses"
              value={
                typeof metrics.raw
                  .longPauseCount ===
                "number"
                  ? Math.round(
                      metrics.raw
                        .longPauseCount,
                    )
                  : "Not measurable"
              }
            />

            <MetricBox
              label="Answer duration"
              value={formatDuration(
                metrics.raw
                  .answerDurationMs,
              )}
            />
          </div>
        </section>
      )}

      {visualApplicable && (
        <VisualDeliverySection
          metrics={metrics}
        />
      )}

      {hasIntegrityInformation && (
        <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>

            <div>
              <h4 className="font-display text-lg font-semibold">
                Interview integrity
              </h4>

              <p className="mt-1 text-sm text-muted-foreground">
                These events are reported
                separately and do not change
                role-specific knowledge or relevance.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricBox
              label="Automatic pauses"
              value={automaticPauseCount}
            />

            <MetricBox
              label="No-face events"
              value={noFaceEventCount}
            />

            <MetricBox
              label="Multiple-face events"
              value={
                multipleFaceEventCount
              }
            />

            <MetricBox
              label="Paused time"
              value={formatDuration(
                metrics.raw
                  .pausedDurationMs,
              )}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function VisualDeliverySection({
  metrics,
}: {
  metrics: PersistedAnswerMetrics;
}) {
  const measurableDuration =
    metrics.raw
      .measurableVideoDurationMs;

  const engagementPercentage =
    percentageOf(
      metrics.raw.engagedDurationMs,
      measurableDuration,
    );

  const centeredPercentage =
    percentageOf(
      metrics.raw.centeredDurationMs,
      measurableDuration,
    );

  const framingPercentage =
    percentageOf(
      metrics.raw
        .professionallyFramedDurationMs,
      measurableDuration,
    );

  const posturePercentage =
    percentageOf(
      metrics.raw
        .postureStableDurationMs,
      measurableDuration,
    );

  return (
    <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Camera className="h-4 w-4" />
        </div>

        <div>
          <h4 className="font-display text-lg font-semibold">
            Visual delivery
          </h4>

          <p className="mt-1 text-sm text-muted-foreground">
            Camera presentation is coaching
            feedback and remains separate from
            answer content.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <NormalizedScoreRow
          label="Visual presentation"
          value={
            metrics.normalized
              .visualPresentation
          }
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricBox
          label="Camera engagement"
          value={formatPercentage(
            engagementPercentage,
          )}
        />

        <MetricBox
          label="Centered presence"
          value={formatPercentage(
            centeredPercentage,
          )}
        />

        <MetricBox
          label="Professional framing"
          value={formatPercentage(
            framingPercentage,
          )}
        />

        <MetricBox
          label="Posture stability"
          value={formatPercentage(
            posturePercentage,
          )}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Hand gestures are optional coaching
        information. Using few or no gestures
        does not automatically lower answer
        quality.
      </p>
    </section>
  );
}

function FeedbackList({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant:
    | "success"
    | "destructive";
}) {
  const success =
    variant === "success";

  const Icon = success
    ? CheckCircle2
    : XCircle;

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "rounded-xl border border-border p-4",
        success
          ? "bg-success/5"
          : "bg-destructive/5",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2 text-sm font-semibold",
          success
            ? "text-success"
            : "text-destructive",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
        {title}
      </div>

      <ul className="mt-2 space-y-1.5 text-sm text-foreground">
        {items.map(
          (item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex gap-2"
            >
              <span aria-hidden="true">
                •
              </span>

              <span>{item}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function MetricBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted/50 p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 font-display text-base font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function percentageOf(
  part?: number,
  total?: number,
): number | null {
  if (
    typeof part !== "number" ||
    typeof total !== "number" ||
    !Number.isFinite(part) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (part / total) * 100,
      ),
    ),
  );
}

function formatPercentage(
  value: number | null,
): string {
  return value === null
    ? "Not measurable"
    : `${value}%`;
}

function formatDuration(
  durationMs?: number,
): string {
  if (
    typeof durationMs !== "number" ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    return "Not measurable";
  }

  const totalSeconds = Math.round(
    durationMs / 1_000,
  );

  const minutes = Math.floor(
    totalSeconds / 60,
  );

  const seconds =
    totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(
    seconds,
  ).padStart(2, "0")}s`;
}