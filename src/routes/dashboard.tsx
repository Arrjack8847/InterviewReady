import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { DashboardCard } from "@/components/DashboardCard";
import { RequireAuth } from "@/components/RequireAuth";
import { SessionHistoryCard } from "@/components/SessionHistoryCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getUserInterviewSessions } from "@/lib/supabaseService";
import {
  buildDashboardStats,
  getCompletedSessionsOnly,
  mapSupabaseSessionToSummary,
} from "@/lib/sessionUtils";
import type { DashboardStats, SessionSummary } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — InterviewReady" },
      { name: "description", content: "Your personal interview preparation workspace." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

const EMPTY_STATS: DashboardStats = {
  totalSessions: 0,
  averageScore: 0,
  latestScore: 0,
  bestSkill: "N/A",
  weakestSkill: "Start practising",
  resumeMatchScore: 0,
  companyReadinessScore: 0,
  speechConfidenceScore: 0,
  cameraPresenceScore: 0,
  overallPresentationScore: 0,
  recent: [],
};

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([]);
  const [completedSessions, setCompletedSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<{ fileName?: string; uploadedAt?: string } | null>(null);
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Candidate";

  useEffect(() => {
    if (!user) return;
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");
        const sessions = await getUserInterviewSessions(user.uid);
        const visible = sessions.filter((session) => session.status !== "cancelled");
        setStats(buildDashboardStats(visible));
        setActiveSessions(
          visible
            .filter((session) => session.status === "in_progress")
            .map(mapSupabaseSessionToSummary),
        );
        setCompletedSessions(getCompletedSessionsOnly(visible).map(mapSupabaseSessionToSummary));
      } catch (loadError) {
        console.error("Failed to load dashboard sessions:", loadError);
        setError("We could not load your preparation data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void loadDashboard();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ir.resume");
    if (!saved) return;
    try {
      setProfile(JSON.parse(saved) as { fileName?: string; uploadedAt?: string });
    } catch {
      setProfile(null);
    }
  }, []);

  const handleContinueSession = (session: SessionSummary) => {
    localStorage.setItem("ir.sessionId", session.id);
    localStorage.removeItem("ir.session");
    localStorage.removeItem("ir.report");
    navigate({ to: "/interview" });
  };

  const nextTitle = activeSessions.length
    ? "Continue your active interview"
    : completedSessions.length
      ? "Build on your latest feedback"
      : "Start your first personalised interview";
  const nextDescription = activeSessions.length
    ? "Your unfinished session is ready when you are."
    : completedSessions.length
      ? `Focus next on ${stats.weakestSkill || "your priority improvement"}.`
      : "Choose a target role, experience level, and practice mode to begin.";

  return (
    <div className="app-container">
      <PageHeader
        eyebrow="Preparation workspace"
        title="Today"
        description={`Welcome back, ${displayName}. See where you are, what has improved and the most useful next step.`}
        actions={
          <Button asChild size="lg">
            <Link to="/start">Start practice</Link>
          </Button>
        }
      />
      {error && (
        <div className="auth-form__error" role="alert">
          {error}
        </div>
      )}

      <section className="dashboard-lead">
        <div className="app-panel dashboard-recommendation">
          <p className="app-eyebrow">Recommended next action</p>
          <h2>{nextTitle}</h2>
          <p>{nextDescription}</p>
          {activeSessions.length ? (
            <Button
              className="mt-6"
              variant="secondary"
              onClick={() => handleContinueSession(activeSessions[0])}
            >
              Continue interview
            </Button>
          ) : (
            <Button asChild className="mt-6" variant="secondary">
              <Link to="/start">Set up practice</Link>
            </Button>
          )}
        </div>
        <div className="app-panel app-panel--muted p-7">
          <p className="app-eyebrow">Improvement focus</p>
          <h2 className="text-xl">{loading ? "Reviewing your sessions…" : stats.weakestSkill}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {completedSessions.length
              ? "Use your next session to strengthen this area, then compare the evidence in your report."
              : "Complete a session to receive a focused recommendation based on real performance."}
          </p>
        </div>
      </section>

      <section className="app-section" aria-labelledby="readiness-heading">
        <div className="app-section-heading">
          <div>
            <h2 id="readiness-heading">Readiness overview</h2>
            <p>Real outcomes from completed sessions.</p>
          </div>
        </div>
        <div className="app-metrics">
          <DashboardCard
            label="Completed sessions"
            value={loading ? "…" : stats.totalSessions}
            hint="Saved preparation sessions"
          />
          <DashboardCard
            label="Average score"
            value={loading ? "…" : `${stats.averageScore}%`}
            hint="Across completed sessions"
          />
          <DashboardCard
            label="Latest score"
            value={loading ? "…" : `${stats.latestScore}%`}
            hint="Most recent result"
          />
          <DashboardCard
            label="Résumé match"
            value={loading ? "…" : `${stats.resumeMatchScore}%`}
            hint="Average report alignment"
          />
        </div>
      </section>

      <section className="app-section">
        <div className="app-section-heading">
          <div>
            <h2>Your preparation path</h2>
            <p>Each stage informs what comes next.</p>
          </div>
        </div>
        <ol className="dashboard-path">
          <li>
            <span>01</span>
            <strong>Résumé</strong>
          </li>
          <li>
            <span>02</span>
            <strong>Target role</strong>
          </li>
          <li>
            <span>03</span>
            <strong>Practice</strong>
          </li>
          <li>
            <span>04</span>
            <strong>Feedback</strong>
          </li>
          <li>
            <span>05</span>
            <strong>Progress</strong>
          </li>
        </ol>
      </section>

      <section className="app-section">
        <div className="app-section-heading">
          <div>
            <h2>Active practice</h2>
            <p>Continue without losing your saved progress.</p>
          </div>
          <Link to="/start" className="text-sm font-semibold underline underline-offset-4">
            Start new
          </Link>
        </div>
        {loading ? (
          <div className="app-state" role="status">
            Loading active sessions…
          </div>
        ) : activeSessions.length === 0 ? (
          <EmptyState
            title="No unfinished sessions"
            description="Your active sessions will appear here when you choose to continue later."
            action={
              <Button asChild>
                <Link to="/start">Start an interview</Link>
              </Button>
            }
          />
        ) : (
          <div className="app-panel overflow-hidden">
            {activeSessions.map((session) => (
              <div key={session.id} className="session-row">
                <div className="session-row__title">
                  <strong>{session.targetRole || session.role}</strong>
                  <span>
                    {session.type} · {session.difficulty || "Practice"} · {session.date}
                  </span>
                </div>
                <div className="session-row__meta">
                  <strong>{session.mode || "Text"}</strong>
                  <span>Mode</span>
                </div>
                <div className="status-pill">In progress</div>
                <Button onClick={() => handleContinueSession(session)}>Continue</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="app-section">
        <div className="app-section-heading">
          <div>
            <h2>Recent sessions</h2>
            <p>Your latest completed preparation.</p>
          </div>
          <Link to="/history" className="text-sm font-semibold underline underline-offset-4">
            View history
          </Link>
        </div>
        {loading ? (
          <div className="app-state" role="status">
            Loading completed sessions…
          </div>
        ) : completedSessions.length === 0 ? (
          <EmptyState
            title="No completed sessions yet"
            description="Complete your first interview to see scores, feedback and progress here."
          />
        ) : (
          <div className="app-panel overflow-hidden">
            {completedSessions.slice(0, 5).map((session) => (
              <SessionHistoryCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      <section className="app-section">
        <div className="app-section-heading">
          <div>
            <h2>Professional Profile</h2>
            <p>Your analysed résumé shapes questions and recommendations.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/resume" search={{ from: "today" }}>
              {profile ? "Review profile" : "Create profile"}
            </Link>
          </Button>
        </div>
        <div className="app-panel p-7">
          <span className={profile ? "status-pill status-pill--success" : "status-pill"}>
            {profile ? "Profile ready" : "No profile"}
          </span>
          <p className="mt-4 text-sm font-semibold">
            {profile?.fileName || "Personalised Practice requires an analysed résumé."}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {profile?.uploadedAt
              ? `Last analysed ${new Date(profile.uploadedAt).toLocaleDateString()}.`
              : "Create your Professional Profile to use real skills, projects and experience in practice."}
          </p>
        </div>
      </section>
    </div>
  );
}
