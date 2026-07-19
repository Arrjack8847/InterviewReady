import type { InterviewReportViewModel } from "../reportTypes";

export function ScoreComposition({ report }: { report: InterviewReportViewModel }) {
  return (
    <section id="composition" className="report-section" aria-labelledby="composition-title">
      <div className="report-section__heading">
        <div>
          <p className="app-eyebrow">Score composition</p>
          <h2 id="composition-title">What shaped the result</h2>
        </div>
        <p>Answer quality remains the primary signal. Unavailable categories are excluded.</p>
      </div>

      <div className="report-category-grid">
        {report.categoryScores.map((category) => {
          const strongest = category.metrics
            .filter((metric) => metric.measurable && metric.score !== null)
            .sort((left, right) => right.score! - left.score!)[0];
          const improvement = category.metrics
            .filter((metric) => metric.measurable && metric.score !== null)
            .sort((left, right) => left.score! - right.score!)[0];
          return (
            <article key={category.key} className="report-category">
              <div className="report-category__header">
                <h3>{category.label}</h3>
                <strong aria-label={`${category.label} score`}>
                  {category.score === null ? "Not measured" : category.score}
                </strong>
              </div>
              <div className="report-score-line" aria-hidden="true">
                <span style={{ width: `${category.score || 0}%` }} />
              </div>
              <p>{category.interpretation}</p>
              {category.available && (
                <dl className="report-category__summary">
                  {strongest && (
                    <div>
                      <dt>Strongest signal</dt>
                      <dd>{strongest.label}</dd>
                    </div>
                  )}
                  {improvement && improvement.key !== strongest?.key && (
                    <div>
                      <dt>Next opportunity</dt>
                      <dd>{improvement.label}</dd>
                    </div>
                  )}
                </dl>
              )}
            </article>
          );
        })}
      </div>

      <details className="report-disclosure">
        <summary>How scoring works</summary>
        <div className="report-disclosure__content">
          <p>{report.methodology.scoringSummary}</p>
          <dl>
            {report.categoryScores.map((category) => (
              <div key={category.key}>
                <dt>{category.label}</dt>
                <dd>
                  {Math.round(category.configuredWeight * 100)}% configured
                  {category.available
                    ? ` · ${Math.round(category.effectiveWeight * 100)}% effective`
                    : " · excluded as unavailable"}
                </dd>
              </div>
            ))}
          </dl>
          <small>Scoring version: {report.methodology.scoringVersion}</small>
        </div>
      </details>
    </section>
  );
}
