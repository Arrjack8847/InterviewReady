import {
  normalizeExperienceLevel,
  normalizeInterviewType,
} from "@/lib/types";
import type {
  DashboardStats,
  FinalReport,
  SessionSummary,
} from "@/lib/types";

type SupabaseTimestampLike =
  | string
  | {
      seconds?: number;
      toDate?: () => Date;
    };

interface SupabaseSession {
  id?: string;
  role?: string;
  targetRole?: string;
  targetCompany?: string;
  type?: string;
  interviewType?: string;
  difficulty?: string;
  mode?: string;
  status?: string;
  overallScore?: number | null;
  finalReport?: FinalReport | null;
  createdAt?: SupabaseTimestampLike;
  completedAt?: SupabaseTimestampLike | null;
}

function formatDate(value: SupabaseSession["createdAt"]) {
  if (!value) {
    return "Unknown date";
  }

  if (typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Unknown date"
      : date.toLocaleDateString();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString();
  }

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleDateString();
  }

  return "Unknown date";
}

function getDateMs(value: SupabaseSession["createdAt"]) {
  if (!value) {
    return 0;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? 0
      : date.getTime();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

function getSessionSortMs(session: SupabaseSession) {
  return getDateMs(
    session.completedAt ||
      session.createdAt,
  );
}

function getSessionScore(session: SupabaseSession) {
  const score =
    session.overallScore ??
    session.finalReport?.overallScore;

  const normalized = Number(score);

  return Number.isFinite(normalized)
    ? normalized
    : null;
}

function getSessionRole(session: SupabaseSession) {
  const targetRole =
    session.targetRole?.trim();

  const legacyRole =
    session.role?.trim();

  return (
    targetRole ||
    legacyRole ||
    "Unspecified role"
  );
}

function createFallbackSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function getCompletedSessionsOnly(
  sessions: SupabaseSession[],
) {
  return sessions.filter(
    (session) =>
      session.status === "completed",
  );
}

function normalizeSummaryStatus(
  status?: string,
): SessionSummary["status"] {
  if (
    status === "in_progress" ||
    status === "in-progress"
  ) {
    return "in-progress";
  }

  if (
    status === "completed" ||
    status === "cancelled"
  ) {
    return status;
  }

  return undefined;
}

export function mapSupabaseSessionToSummary(
  session: SupabaseSession,
): SessionSummary {
  const resolvedRole =
    getSessionRole(session);

  return {
    id:
      session.id ||
      createFallbackSessionId(),

    /**
     * Prefer the exact target role entered by the user.
     * Fall back to the older role field for legacy sessions.
     */
    role: resolvedRole,

    type: normalizeInterviewType(
      session.type ||
        session.interviewType,
    ),

    date: formatDate(
      session.createdAt,
    ),

    score:
      getSessionScore(session) ?? 0,

    status:
      normalizeSummaryStatus(
        session.status,
      ),

    targetCompany:
      session.targetCompany?.trim() ||
      undefined,

    targetRole:
      resolvedRole ===
      "Unspecified role"
        ? undefined
        : resolvedRole,

    difficulty: session.difficulty
      ? normalizeExperienceLevel(
          session.difficulty,
        )
      : undefined,

    mode:
      session.mode as
        | SessionSummary["mode"]
        | undefined,

    overallPresentationScore:
      session.finalReport
        ?.overallPresentationScore,
  };
}

export function buildDashboardStats(
  sessions: SupabaseSession[],
): DashboardStats {
  const visibleSessions =
    sessions.filter(
      (session) =>
        session.status !== "cancelled",
    );

  const sortedSessions = [
    ...visibleSessions,
  ].sort(
    (a, b) =>
      getSessionSortMs(b) -
      getSessionSortMs(a),
  );

  const completedSessions =
    getCompletedSessionsOnly(
      sortedSessions,
    );

  const latestCompletedSession =
    completedSessions[0];

  const totalSessions =
    completedSessions.length;

  const completedScores =
    completedSessions
      .map(getSessionScore)
      .filter(
        (
          score,
        ): score is number =>
          score !== null,
      );

  const averageScore =
    completedScores.length > 0
      ? Math.round(
          completedScores.reduce(
            (total, score) =>
              total + score,
            0,
          ) /
            completedScores.length,
        )
      : 0;

  const recent =
    completedSessions
      .slice(0, 5)
      .map((session) =>
        mapSupabaseSessionToSummary(
          session,
        ),
      );

  const breakdownScores =
    completedSessions.flatMap(
      (session) =>
        Object.entries(
          session.finalReport
            ?.breakdown || {},
        )
          .filter(
            ([, value]) =>
              typeof value ===
                "number" &&
              Number.isFinite(value),
          )
          .map(([key, value]) => ({
            key,
            value: Number(value),
          })),
    );

  const scoreByKey =
    new Map<string, number[]>();

  breakdownScores.forEach(
    (item) => {
      scoreByKey.set(item.key, [
        ...(scoreByKey.get(
          item.key,
        ) || []),
        item.value,
      ]);
    },
  );

  const averagedBreakdown = [
    ...scoreByKey.entries(),
  ].map(([key, values]) => ({
    key,
    average: Math.round(
      values.reduce(
        (total, value) =>
          total + value,
        0,
      ) / values.length,
    ),
  }));

  const bestSkill =
    averagedBreakdown.length > 0
      ? averagedBreakdown.reduce(
          (best, item) =>
            item.average >
            best.average
              ? item
              : best,
        ).key
      : "N/A";

  const weakestSkill =
    averagedBreakdown.length > 0
      ? averagedBreakdown.reduce(
          (weakest, item) =>
            item.average <
            weakest.average
              ? item
              : weakest,
        ).key
      : "Start practicing";

  const averageReportScore = (
    key: keyof FinalReport,
  ) => {
    const values =
      completedSessions
        .map((session) =>
          Number(
            session.finalReport?.[
              key
            ],
          ),
        )
        .filter((value) =>
          Number.isFinite(value),
        );

    return values.length > 0
      ? Math.round(
          values.reduce(
            (total, value) =>
              total + value,
            0,
          ) / values.length,
        )
      : 0;
  };

  return {
    totalSessions,
    averageScore,

    latestScore:
      latestCompletedSession
        ? getSessionScore(
            latestCompletedSession,
          ) ?? 0
        : 0,

    bestSkill:
      formatBreakdownLabel(
        bestSkill,
      ),

    weakestSkill:
      formatBreakdownLabel(
        weakestSkill,
      ),

    resumeMatchScore:
      averageReportScore(
        "resumeMatchScore",
      ),

    companyReadinessScore:
      averageReportScore(
        "companyReadinessScore",
      ),

    speechConfidenceScore:
      averageReportScore(
        "speechConfidenceScore",
      ),

    cameraPresenceScore:
      averageReportScore(
        "cameraPresenceScore",
      ),

    overallPresentationScore:
      averageReportScore(
        "overallPresentationScore",
      ),

    recent,
  };
}

function formatBreakdownLabel(
  value: string,
) {
  const labels: Record<
    string,
    string
  > = {
    clarity: "Clarity",
    relevance: "Relevance",
    structure: "Structure",
    confidence:
      "Answer communication",
    technicalAccuracy:
      "Role-specific knowledge",
    communication: "Communication",
    resumeMatch: "Resume match",
    companyReadiness:
      "Company readiness",
    speechConfidence:
      "Speech delivery",
    cameraPresence:
      "Camera presence",
    overallPresentation:
      "Presentation signals",
  };

  return labels[value] || value;
}
