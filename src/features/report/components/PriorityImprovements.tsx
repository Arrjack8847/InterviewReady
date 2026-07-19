import type { ReportPriority } from "../reportTypes";

export function PriorityImprovements({ priorities }: { priorities: ReportPriority[] }) {
  return (
    <section id="priorities" className="report-section" aria-labelledby="priorities-title">
      <div className="report-section__heading">
        <div>
          <p className="app-eyebrow">Priority improvements</p>
          <h2 id="priorities-title">Focus on these next</h2>
        </div>
        <p>Ranked by coaching impact, with answer content taking priority.</p>
      </div>
      <div className="report-priority-list">
        {priorities.map((priority, index) => (
          <article key={priority.id} className="report-priority">
            <span className="report-priority__number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{priority.title}</h3>
              <dl>
                <div>
                  <dt>Why it matters</dt>
                  <dd>{priority.whyItMatters}</dd>
                </div>
                <div>
                  <dt>What we observed</dt>
                  <dd>{priority.evidence}</dd>
                </div>
                <div>
                  <dt>Try this</dt>
                  <dd>{priority.nextStep}</dd>
                </div>
              </dl>
              {priority.relatedQuestionNumbers.length > 0 && (
                <p className="report-priority__questions">
                  Related questions: {priority.relatedQuestionNumbers.join(", ")}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
