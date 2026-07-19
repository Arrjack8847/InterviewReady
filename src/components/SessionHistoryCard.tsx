import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { SessionSummary } from "@/lib/types";

function formatSessionDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return date || "Unknown date";
  return parsedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SessionHistoryCard({ session }: { session: SessionSummary }) {
  const score = session.score > 0 ? `${session.score}%` : "—";
  const status = session.score > 0 ? "Completed" : "In progress";

  return (
    <article className="session-row">
      <div className="session-row__title">
        <strong>{session.targetRole || session.role}</strong>
        <span>{session.targetCompany || session.role}</span>
      </div>
      <div className="session-row__meta">
        <strong>{session.mode || "Text"}</strong>
        <span>Mode</span>
      </div>
      <div className="session-row__meta">
        <strong>{session.type}</strong>
        <span>{formatSessionDate(session.date)}</span>
      </div>
      <div>
        <span className={session.score > 0 ? "status-pill status-pill--success" : "status-pill"}>
          {status}
        </span>
      </div>
      <div className="session-row__score" aria-label={`Score ${score}`}>
        {score}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/session/$sessionId" params={{ sessionId: session.id }}>
          View session
        </Link>
      </Button>
    </article>
  );
}
