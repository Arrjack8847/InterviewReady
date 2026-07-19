import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

type FeedbackAreaId = "structure" | "evidence" | "delivery";

type FeedbackArea = {
  id: FeedbackAreaId;
  label: string;
  score: number;
  status: string;
  headline: string;
  explanation: string;
  actions: string[];
  example: string;
  nextSession: string;
};

const feedbackAreas: FeedbackArea[] = [
  {
    id: "structure",
    label: "Answer structure",
    score: 74,
    status: "Needs clearer sequencing",
    headline: "Make the answer easier for the interviewer to follow.",
    explanation:
      "Your role-specific explanation is relevant, but your responsibility, action and result are mixed together. A clearer sequence will make the same experience sound more confident.",
    actions: [
      "Open with your exact responsibility.",
      "Explain the decision you made and why.",
      "Finish with the result or lesson learned.",
    ],
    example:
      "I was responsible for securing access to each user’s application data. I implemented Supabase row-level security policies, tested each role separately and verified that users could only access their own records.",
    nextSession: "60-second structured-answer practice",
  },
  {
    id: "evidence",
    label: "Supporting evidence",
    score: 68,
    status: "Add a measurable result",
    headline: "Show the interviewer what changed because of your work.",
    explanation:
      "The answer explains what you built, but it does not yet prove the impact. Add a result, test outcome or clear improvement.",
    actions: [
      "Mention what problem existed before your solution.",
      "Add a measurable or observable outcome.",
      "Separate team results from your own contribution.",
    ],
    example:
      "After applying and testing the policies, unauthorised access attempts were blocked and each authenticated user could only retrieve records linked to their profile.",
    nextSession: "Evidence and impact practice",
  },
  {
    id: "delivery",
    label: "Communication",
    score: 81,
    status: "Strong, with minor hesitation",
    headline: "Keep the clear tone while reducing unnecessary pauses.",
    explanation:
      "Your pace is comfortable and your explanation sounds natural. The main opportunity is to remove hesitation before important professional terms.",
    actions: [
      "Pause briefly before beginning, not mid-sentence.",
      "Use shorter sentences for role-specific explanations.",
      "End decisively instead of trailing off.",
    ],
    example:
      "I used Supabase Auth for identity and row-level security for data access. Each policy was tested against authenticated and unauthorised requests before deployment.",
    nextSession: "Voice delivery practice",
  },
];

const overallScore = 82;
const scoreCircumference = 289;
const scoreOffset = scoreCircumference * (1 - overallScore / 100);

export function AIFeedback() {
  const [activeAreaId, setActiveAreaId] = useState<FeedbackAreaId>("structure");

  const activeArea = feedbackAreas.find((area) => area.id === activeAreaId) ?? feedbackAreas[0];

  return (
    <section
      id="ai-feedback"
      className="home-section home-feedback"
      aria-labelledby="ai-feedback-title"
    >
      <div className="home-shell">
        <div className="home-feedback-showcase__heading">
          <div className="home-section-heading">
            <p className="home-eyebrow">Actionable feedback</p>

            <h2 id="ai-feedback-title">Know exactly what to improve next.</h2>

            <p>
              InterviewReady evaluates what you said, how you structured it and how you delivered
              it—then turns that evaluation into clear coaching.
            </p>
          </div>

          <p className="home-feedback-showcase__principle">
            Not just a score.
            <br />A specific next action.
          </p>
        </div>

        <div className="home-feedback-showcase">
          <aside
            className="home-feedback-showcase__summary"
            aria-label="Interview performance summary"
          >
            <div className="home-feedback-showcase__score">
              <div className="home-feedback-showcase__ring">
                <svg viewBox="0 0 104 104" aria-hidden="true">
                  <circle cx="52" cy="52" r="46" className="home-feedback-showcase__ring-track" />

                  <circle
                    cx="52"
                    cy="52"
                    r="46"
                    className="home-feedback-showcase__ring-value"
                    strokeDasharray={scoreCircumference}
                    strokeDashoffset={scoreOffset}
                  />
                </svg>

                <div>
                  <strong>{overallScore}</strong>

                  <small>/ 100</small>
                </div>
              </div>

              <div>
                <span>Overall performance</span>
                <strong>Strong foundation</strong>

                <p>
                  Your experience is relevant. The clearest opportunity is presenting it with more
                  evidence and structure.
                </p>
              </div>
            </div>

            <div className="home-feedback-showcase__areas" aria-label="Feedback areas">
              {feedbackAreas.map((area) => {
                const isActive = area.id === activeArea.id;

                return (
                  <button
                    key={area.id}
                    type="button"
                    className={isActive ? "is-active" : ""}
                    aria-pressed={isActive}
                    aria-controls="active-feedback-coaching"
                    onClick={() => setActiveAreaId(area.id)}
                  >
                    <div>
                      <span>{area.label}</span>

                      <strong>{area.score}</strong>
                    </div>

                    <i aria-hidden="true">
                      <b
                        style={{
                          width: `${area.score}%`,
                        }}
                      />
                    </i>

                    <small>{area.status}</small>

                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </aside>

          <article
            id="active-feedback-coaching"
            className="home-feedback-showcase__coaching"
            aria-live="polite"
          >
            <header className="home-feedback-showcase__coaching-header">
              <div>
                <span>Coaching focus</span>

                <strong>{activeArea.label}</strong>
              </div>

              <div>
                <strong>{activeArea.score}</strong>

                <small>/ 100</small>
              </div>
            </header>

            <div key={activeArea.id} className="home-feedback-showcase__coaching-body">
              <p className="home-feedback-showcase__status">{activeArea.status}</p>

              <h3>{activeArea.headline}</h3>

              <p className="home-feedback-showcase__explanation">{activeArea.explanation}</p>

              <div className="home-feedback-showcase__instructions">
                <span>What to change</span>

                <ol>
                  {activeArea.actions.map((action, index) => (
                    <li key={action}>
                      <strong>{String(index + 1).padStart(2, "0")}</strong>

                      <p>{action}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="home-feedback-showcase__example">
                <div>
                  <span>Try this version</span>

                  <Check size={16} aria-hidden="true" />
                </div>

                <blockquote>“{activeArea.example}”</blockquote>
              </div>
            </div>

            <footer className="home-feedback-showcase__footer">
              <div>
                <span>Recommended next practice</span>

                <strong>{activeArea.nextSession}</strong>
              </div>

              <Link to="/start" className="home-button home-button--dark">
                Practise this skill
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}
