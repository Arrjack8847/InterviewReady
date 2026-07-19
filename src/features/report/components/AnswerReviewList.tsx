import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ReportAnswerReview } from "../reportTypes";

const STATUS_LABELS: Record<ReportAnswerReview["status"], string> = {
  completed: "Reviewed",
  skipped: "Skipped",
  empty: "Not enough response",
  evaluation_pending: "Feedback processing",
  evaluation_failed: "Feedback unavailable",
  legacy: "Legacy feedback",
};

function AnswerReview({ answer }: { answer: ReportAnswerReview }) {
  const hasFeedback = answer.status === "completed" || answer.status === "legacy";
  return (
    <AccordionItem value={answer.id} className="report-answer">
      <AccordionTrigger className="report-answer__trigger">
        <span className="report-answer__number">Q{answer.questionNumber}</span>
        <span className="report-answer__title">
          <strong>{answer.question}</strong>
          <small>
            {answer.category} · {STATUS_LABELS[answer.status]}
          </small>
        </span>
        <span className="report-answer__score">
          {answer.score === null ? "—" : answer.score}
          <small>{answer.scoreLabel || "Not scored"}</small>
        </span>
      </AccordionTrigger>
      <AccordionContent className="report-answer__content">
        <p className="report-answer__assessment">{answer.assessment}</p>

        {hasFeedback && (
          <div className="report-answer__columns">
            <section aria-labelledby={`${answer.id}-worked`}>
              <h4 id={`${answer.id}-worked`}>What worked</h4>
              {answer.strengths.length ? (
                <ul>
                  {answer.strengths.map((strength) => (
                    <li key={strength}>{strength}</li>
                  ))}
                </ul>
              ) : (
                <p>No structured strengths were saved for this answer.</p>
              )}
            </section>
            <section aria-labelledby={`${answer.id}-improve`}>
              <h4 id={`${answer.id}-improve`}>What to improve</h4>
              {answer.improvements.length ? (
                <ul>
                  {answer.improvements.map((improvement) => (
                    <li key={improvement}>{improvement}</li>
                  ))}
                </ul>
              ) : (
                <p>No specific improvement was saved for this answer.</p>
              )}
            </section>
          </div>
        )}

        {hasFeedback && (
          <div className="report-answer__structure">
            <h4>A stronger structure</h4>
            <ol aria-label="Suggested answer structure">
              {answer.recommendedStructure.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {answer.improvedAnswer && (
          <div className="report-answer__example">
            <h4>One stronger way to answer</h4>
            <p>{answer.improvedAnswer}</p>
            <small>
              Use this as a structure guide and keep the details authentic to your own experience.
            </small>
          </div>
        )}

        {answer.answerText && (
          <details className="report-transcript">
            <summary>View full answer</summary>
            <p>{answer.answerText}</p>
          </details>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export function AnswerReviewList({ answers }: { answers: ReportAnswerReview[] }) {
  return (
    <section id="answers" className="report-section" aria-labelledby="answers-title">
      <div className="report-section__heading">
        <div>
          <p className="app-eyebrow">Answer review</p>
          <h2 id="answers-title">Question by question</h2>
        </div>
        <p>Open an answer to review the evidence and a stronger structure.</p>
      </div>
      <Accordion type="multiple" className="report-answer-list">
        {answers.map((answer) => (
          <AnswerReview key={answer.id} answer={answer} />
        ))}
      </Accordion>
    </section>
  );
}
