import { Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InterviewReportViewModel } from "../reportTypes";
import { AnswerReviewList } from "./AnswerReviewList";
import { DeliverySections } from "./DeliverySections";
import { PriorityImprovements } from "./PriorityImprovements";
import { ReportHero } from "./ReportHero";
import { ReportMethodology } from "./ReportMethodology";
import { ScoreComposition } from "./ScoreComposition";
import "../report.css";

export function InterviewReport({ report }: { report: InterviewReportViewModel }) {
  const debugEnabled =
    import.meta.env.DEV && import.meta.env.VITE_INTERVIEW_MONITOR_DEBUG === "true";

  if (report.status === "empty") {
    return (
      <main className="app-container report-page">
        <div className="report-empty app-panel">
          <p className="app-eyebrow">Report unavailable</p>
          <h1>Not enough completed answers</h1>
          <p>This session does not contain enough completed answers to generate a full report.</p>
          <div>
            <Button asChild>
              <Link to="/start">Start a new interview</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Return to dashboard</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const navigation = [
    ["overview", "Overview"],
    ["priorities", "Priorities"],
    ["answers", "Answers"],
    ...(report.speechDelivery ? [["delivery", "Delivery"]] : []),
    ...(report.visualPresence ? [["visual", "Visual presence"]] : []),
    ["practice", "Practice plan"],
  ];

  return (
    <main className="app-container report-page">
      <div className="report-toolbar report-print-hidden">
        <Button asChild variant="ghost">
          <Link to="/history">
            <ArrowLeft className="h-4 w-4" />
            Preparation journal
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print report
        </Button>
      </div>

      {report.dataWarning && (
        <div className="report-notice" role="status">
          {report.dataWarning}
        </div>
      )}
      {report.status !== "complete" && (
        <div className="report-notice" role="status">
          {report.status === "processing"
            ? "Answer feedback is still processing. Available content is shown below."
            : "This report is partially complete. Unavailable feedback is clearly marked and does not become a zero score."}
        </div>
      )}

      <div id="overview">
        <ReportHero report={report} />
      </div>

      <nav className="report-nav report-print-hidden" aria-label="Report sections">
        {navigation.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section className="report-section report-executive" aria-labelledby="executive-title">
        <div className="report-section__heading">
          <div>
            <p className="app-eyebrow">Executive coaching summary</p>
            <h2 id="executive-title">The clearest pattern</h2>
          </div>
        </div>
        <dl>
          <div>
            <dt>Strongest area</dt>
            <dd>{report.strongestArea}</dd>
          </div>
          <div>
            <dt>Improve first</dt>
            <dd>{report.primaryImprovement}</dd>
          </div>
          <div>
            <dt>Next action</dt>
            <dd>{report.recommendedAction}</dd>
          </div>
        </dl>
      </section>

      <ScoreComposition report={report} />
      <PriorityImprovements priorities={report.priorities} />
      <AnswerReviewList answers={report.answers} />
      <DeliverySections speech={report.speechDelivery} visual={report.visualPresence} />

      {(report.integrityNotes.length > 0 || report.unavailableMetrics.length > 0) && (
        <section className="report-section report-notes" aria-labelledby="session-notes-title">
          <div className="report-section__heading">
            <div>
              <p className="app-eyebrow">Role-specific context</p>
              <h2 id="session-notes-title">Session notes</h2>
            </div>
          </div>
          <ul>
            {report.integrityNotes.map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
            {report.unavailableMetrics.length > 0 && (
              <li>
                Not measured: {report.unavailableMetrics.join(", ")}. These measurements were
                excluded rather than treated as zero.
              </li>
            )}
          </ul>
        </section>
      )}

      <section id="practice" className="report-section" aria-labelledby="practice-title">
        <div className="report-section__heading">
          <div>
            <p className="app-eyebrow">Personalized practice plan</p>
            <h2 id="practice-title">Your next practice session</h2>
          </div>
        </div>
        <ol className="report-practice-plan">
          {report.practicePlan.map((step, index) => (
            <li key={step.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ReportMethodology report={report} />

      {debugEnabled && (
        <details className="report-debug report-print-hidden">
          <summary>Development scoring data</summary>
          <pre>{JSON.stringify(report.debugData, null, 2)}</pre>
        </details>
      )}

      <footer className="report-actions report-print-hidden">
        <div>
          <p className="app-eyebrow">Continue practising</p>
          <h2>Turn the report into another repetition.</h2>
        </div>
        <div>
          <Button asChild size="lg">
            <Link to="/start">Start a new interview</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/resume">Review resume</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/dashboard">Return to dashboard</Link>
          </Button>
        </div>
      </footer>
    </main>
  );
}
