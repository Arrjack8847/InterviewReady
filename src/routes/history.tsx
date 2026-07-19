import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { SessionHistoryCard } from "@/components/SessionHistoryCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getUserInterviewSessions } from "@/lib/supabaseService";
import { mapSupabaseSessionToSummary } from "@/lib/sessionUtils";
import type { SessionSummary } from "@/lib/types";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Preparation Journal — InterviewReady" },
      { name: "description", content: "Review your saved interview sessions and progress." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <HistoryPage />
    </RequireAuth>
  ),
});

function HistoryPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError("");
        const sessions = await getUserInterviewSessions(user.uid);
        setHistory(
          sessions
            .filter((session) => session.status !== "cancelled")
            .map(mapSupabaseSessionToSummary),
        );
      } catch (loadError) {
        console.error("Failed to load history:", loadError);
        setError("We could not load your practice history. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };
    void loadHistory();
  }, [user]);

  const modes = useMemo(
    () => Array.from(new Set(history.map((session) => String(session.mode || "Text")))),
    [history],
  );
  const filtered = history.filter((session) => {
    const status = session.score > 0 ? "completed" : "in-progress";
    return (
      (statusFilter === "all" || statusFilter === status) &&
      (modeFilter === "all" || modeFilter === String(session.mode || "Text"))
    );
  });
  const scored = history.filter((session) => session.score > 0);
  const average = scored.length
    ? Math.round(scored.reduce((sum, session) => sum + session.score, 0) / scored.length)
    : 0;

  return (
    <div className="app-container">
      <PageHeader
        eyebrow="Journal"
        title="Preparation Journal"
        description="Review completed and active sessions, compare real outcomes and return to the feedback that shapes your next practice."
        actions={
          <Button asChild size="lg">
            <Link to="/start">New session</Link>
          </Button>
        }
      />
      {error && (
        <div className="auth-form__error" role="alert">
          {error}
        </div>
      )}
      <section className="app-section">
        <div className="app-metrics">
          <div className="app-metric">
            <div className="app-metric__label">All sessions</div>
            <div className="app-metric__value">{loading ? "…" : history.length}</div>
            <div className="app-metric__hint">Saved preparation</div>
          </div>
          <div className="app-metric">
            <div className="app-metric__label">Completed</div>
            <div className="app-metric__value">{loading ? "…" : scored.length}</div>
            <div className="app-metric__hint">With a scored report</div>
          </div>
          <div className="app-metric">
            <div className="app-metric__label">Average score</div>
            <div className="app-metric__value">
              {loading ? "…" : scored.length ? `${average}%` : "—"}
            </div>
            <div className="app-metric__hint">Shown when scored sessions exist</div>
          </div>
          <div className="app-metric">
            <div className="app-metric__label">Progress trend</div>
            <div className="app-metric__value">
              {scored.length >= 2 ? `${scored.at(0)?.score || 0}%` : "—"}
            </div>
            <div className="app-metric__hint">
              {scored.length >= 2 ? "Latest scored session" : "Complete two sessions to compare"}
            </div>
          </div>
        </div>
      </section>
      <section className="app-section">
        <div className="app-section-heading">
          <div>
            <h2>Sessions</h2>
            <p>Filter by real status and practice mode.</p>
          </div>
          <div className="history-filters">
            <label>
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In progress</option>
              </select>
            </label>
            <label>
              Mode
              <select value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
                <option value="all">All modes</option>
                {modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <div className="app-state" role="status">
            Loading your saved sessions…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sessions match these filters"
            description={
              history.length
                ? "Try a different status or practice mode."
                : "Start your first practice to build a preparation history."
            }
            action={
              !history.length ? (
                <Button asChild>
                  <Link to="/start">Start your first interview</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="app-panel overflow-hidden">
            {filtered.map((session) => (
              <SessionHistoryCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
