import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { questionExamples } from "@/data/homepageContent";

export function QuestionShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeQuestion = questionExamples[activeIndex] ?? questionExamples[0];

  return (
    <section
      id="personalised-questions"
      className="home-section home-questions"
      aria-labelledby="personalised-questions-title"
    >
      <div className="home-shell">
        <div className="home-questions__heading">
          <div className="home-section-heading">
            <p className="home-eyebrow">Personalised questions</p>

            <h2 id="personalised-questions-title">
              Not a generic list. An interview built around you.
            </h2>

            <p>
              Every session can connect your résumé, target role, chosen company and interview
              experience level.
            </p>
          </div>

          <div className="home-questions__counter" aria-live="polite">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>

            <span>/</span>

            <small>{String(questionExamples.length).padStart(2, "0")}</small>
          </div>
        </div>

        <div className="home-questions__workspace">
          <div className="home-questions__types" aria-label="Question categories">
            {questionExamples.map((question, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={question.id}
                  type="button"
                  className={isActive ? "home-question-type is-active" : "home-question-type"}
                  aria-pressed={isActive}
                  aria-controls="active-question-preview"
                  onClick={() => setActiveIndex(index)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>

                  <div>
                    <strong>{question.type}</strong>
                    <small>{question.detail}</small>
                  </div>

                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              );
            })}
          </div>

          <article
            id="active-question-preview"
            className="home-question-preview"
            aria-live="polite"
          >
            <header className="home-question-preview__header">
              <div>
                <span>Question type</span>
                <strong>{activeQuestion.type}</strong>
              </div>

              <small>
                Question {String(activeIndex + 1).padStart(2, "0")} of{" "}
                {String(questionExamples.length).padStart(2, "0")}
              </small>
            </header>

            <div key={activeQuestion.id} className="home-question-preview__content">
              <p>Personalised interview question</p>

              <blockquote>{activeQuestion.prompt}</blockquote>

              <div className="home-question-preview__source">
                <span>Source</span>
                <strong>{activeQuestion.detail}</strong>
              </div>
            </div>

            <footer className="home-question-preview__footer">
              <div>
                <span>Built from</span>

                <p>
                  Résumé
                  <i aria-hidden="true" />
                  Target role
                  <i aria-hidden="true" />
                  Company
                  <i aria-hidden="true" />
                  Experience Level
                </p>
              </div>

              <Link to="/start" className="home-button home-button--dark">
                Build my interview
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
