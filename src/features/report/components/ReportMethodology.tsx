import type { InterviewReportViewModel } from "../reportTypes";

export function ReportMethodology({ report }: { report: InterviewReportViewModel }) {
  return (
    <section className="report-section report-methodology" aria-labelledby="methodology-title">
      <details className="report-disclosure">
        <summary id="methodology-title">Limitations and methodology</summary>
        <div className="report-disclosure__content">
          <p>{report.methodology.scoringSummary}</p>
          <ul>
            {report.methodology.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
          <p>
            <small>
              Metrics {report.methodology.metricsVersion} · Scoring{" "}
              {report.methodology.scoringVersion}
              {report.isLegacy ? " · Legacy report" : ""}
            </small>
          </p>
        </div>
      </details>
      <p className="report-fairness-note">
        Delivery and visual measurements are approximate. Accent, dialect, disability, assistive
        communication, natural movement, camera quality, and lighting may affect measurement. They
        are not proof of confidence, honesty, personality, or employability.
      </p>
    </section>
  );
}
