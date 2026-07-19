import type { InterviewReportViewModel } from "../reportTypes";

export function ReportHero({ report }: { report: InterviewReportViewModel }) {
  return (
    <header className="report-hero" aria-labelledby="report-title">
      <div className="report-hero__copy">
        <p className="app-eyebrow">Interview complete</p>
        <h1 id="report-title">{report.title}</h1>
        <p className="report-hero__summary">{report.summary}</p>
        <dl className="report-hero__metadata" aria-label="Interview details">
          <div>
            <dt>Format</dt>
            <dd>
              {report.interviewType} · {report.interviewMode}
            </dd>
          </div>
          <div>
            <dt>Questions</dt>
            <dd>
              {report.completedQuestionCount} of {report.totalQuestionCount} completed
            </dd>
          </div>
          {report.durationLabel && (
            <div>
              <dt>Duration</dt>
              <dd>{report.durationLabel}</dd>
            </div>
          )}
          <div>
            <dt>Completed</dt>
            <dd>{report.completedAtLabel}</dd>
          </div>
        </dl>
      </div>
      <div className="report-hero__score" aria-label="Overall readiness score">
        <span>Overall readiness</span>
        <strong>{report.overallScore === null ? "—" : report.overallScore}</strong>
        <p>{report.performanceLabel || "Not enough data"}</p>
        <div className="report-score-line" aria-hidden="true">
          <span style={{ width: `${report.overallScore || 0}%` }} />
        </div>
      </div>
    </header>
  );
}
