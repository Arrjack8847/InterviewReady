import type { ReportDeliverySection } from "../reportTypes";

function DeliverySection({
  id,
  eyebrow,
  title,
  section,
  note,
}: {
  id: string;
  eyebrow: string;
  title: string;
  section: ReportDeliverySection;
  note: string;
}) {
  return (
    <section id={id} className="report-section" aria-labelledby={`${id}-title`}>
      <div className="report-section__heading">
        <div>
          <p className="app-eyebrow">{eyebrow}</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <strong className="report-section__score">
          {section.score === null ? "Not measured" : section.score}
        </strong>
      </div>
      <p className="report-delivery__summary">{section.summary}</p>
      <dl className="report-metric-list">
        {section.metrics
          .filter((metric) => metric.measurable)
          .map((metric) => (
            <div key={metric.key}>
              <dt>{metric.label}</dt>
              <dd>
                <strong>{metric.valueLabel || metric.score}</strong>
                <span>{metric.interpretation}</span>
              </dd>
            </div>
          ))}
      </dl>
      <p className="report-measurement-note">{note}</p>
    </section>
  );
}

export function DeliverySections({
  speech,
  visual,
}: {
  speech: ReportDeliverySection | null;
  visual: ReportDeliverySection | null;
}) {
  return (
    <>
      {speech && (
        <DeliverySection
          id="delivery"
          eyebrow="Communication delivery"
          title="How the answers sounded"
          section={speech}
          note="Speech measurements depend on browser transcription and microphone conditions. Accent and dialect are not scored."
        />
      )}
      {visual && (
        <DeliverySection
          id="visual"
          eyebrow="Visual presence"
          title="How the presentation appeared"
          section={visual}
          note="Visual signals are approximate coaching measurements, not exact gaze tracking or an assessment of confidence, attention, or personality."
        />
      )}
    </>
  );
}
