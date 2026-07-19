import { ArrowRight, Check, Mic, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { journeyStages } from "@/data/homepageContent";

const DESKTOP_JOURNEY_QUERY = "(min-width: 981px)";

export function ProductJourney() {
  const [activeIndex, setActiveIndex] = useState(0);

  const stageRefs = useRef<Array<HTMLElement | null>>([]);
  const frameRef = useRef<number | null>(null);

  const active = journeyStages[activeIndex];

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_JOURNEY_QUERY);

    const updateActiveStage = () => {
      frameRef.current = null;

      if (!desktopQuery.matches) {
        return;
      }

      const focusLine = window.innerHeight * 0.48;

      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      stageRefs.current.forEach((stage, index) => {
        if (!stage) {
          return;
        }

        const bounds = stage.getBoundingClientRect();
        const stageCenter = bounds.top + bounds.height / 2;

        const distance = Math.abs(stageCenter - focusLine);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveIndex((current) => (current === closestIndex ? current : closestIndex));
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateActiveStage);
    };

    requestUpdate();

    window.addEventListener("scroll", requestUpdate, { passive: true });

    window.addEventListener("resize", requestUpdate);

    desktopQuery.addEventListener("change", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);

      window.removeEventListener("resize", requestUpdate);

      desktopQuery.removeEventListener("change", requestUpdate);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const goToStage = (index: number) => {
    setActiveIndex(index);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    stageRefs.current[index]?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  };

  return (
    <section id="product-journey" className="home-section home-journey">
      <div className="home-shell">
        {/* Do not add data-home-reveal here.
            It can leave this section permanently invisible. */}
        <div className="home-section-heading home-section-heading--wide">
          <p className="home-eyebrow">The InterviewReady journey</p>

          <h2>From your experience to your next breakthrough.</h2>

          <p>
            One connected preparation system learns what you know, tests how you communicate it, and
            helps you improve.
          </p>
        </div>

        {/* Do not add data-home-reveal here either. */}
        <div className="home-journey__layout">
          <div className="home-journey__steps" aria-label="InterviewReady product journey">
            {journeyStages.map((stage, index) => (
              <article
                key={stage.id}
                ref={(node) => {
                  stageRefs.current[index] = node;
                }}
                className={`home-journey__step${index === activeIndex ? " is-active" : ""}`}
                data-journey-stage={stage.id}
              >
                <button
                  type="button"
                  onClick={() => goToStage(index)}
                  aria-current={index === activeIndex ? "step" : undefined}
                  aria-controls="journey-sticky-preview"
                >
                  <span>{stage.eyebrow}</span>

                  <strong>{stage.title}</strong>

                  <p>{stage.description}</p>
                </button>

                <div className="home-journey__mobile-preview">
                  <JourneyPreview index={index} />
                </div>
              </article>
            ))}
          </div>

          <div
            id="journey-sticky-preview"
            className="home-journey__panel"
            aria-label={`${active.title} preview`}
          >
            <div className="home-journey__sticky">
              <div className="home-journey__stage-status" aria-hidden="true">
                <span>
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(journeyStages.length).padStart(2, "0")}
                </span>

                <i>
                  <b
                    style={{
                      width: `${((activeIndex + 1) / journeyStages.length) * 100}%`,
                    }}
                  />
                </i>
              </div>

              <div key={active.id} className="home-journey__preview-swap">
                <JourneyPreview index={activeIndex} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function JourneyPreview({ index }: { index: number }) {
  if (index === 0) {
    return <ResumePreview />;
  }

  if (index === 1) {
    return <ProfilePreview />;
  }

  if (index === 2) {
    return <QuestionPreview />;
  }

  if (index === 3) {
    return <PracticePreview />;
  }

  if (index === 4) {
    return <ReportPreview />;
  }

  return <NextSessionPreview />;
}

function PreviewShell({
  children,
  title,
  step,
}: {
  children: ReactNode;
  title: string;
  step: string;
}) {
  return (
    <div className="journey-preview">
      <div className="journey-preview__bar">
        <span>{step}</span>
        <strong>{title}</strong>
        <i aria-hidden="true" />
      </div>

      <div className="journey-preview__content">{children}</div>
    </div>
  );
}

function ResumePreview() {
  const skills = ["React", "TypeScript", "Node.js", "SQL", "Supabase", "REST APIs"];

  return (
    <PreviewShell step="01 / 06" title="Your experience">
      <div className="journey-resume">
        <header>
          <span>SMK</span>

          <div>
            <h4>Soe Min Khant</h4>
            <p>Junior Software Developer</p>
          </div>
        </header>

        <div className="journey-resume__grid">
          <div>
            <small>PROFILE</small>

            <p>Full-stack developer building useful, secure and accessible web products.</p>

            <small>PROJECT</small>

            <h5>InterviewReady</h5>

            <p>
              AI-powered preparation using résumé content, target roles and practice performance.
            </p>
          </div>

          <div>
            <small>SKILLS</small>

            {skills.map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function ProfilePreview() {
  const rows = [
    ["Career level", "Entry level"],
    ["Best role match", "Junior Software Developer"],
    ["Top strength", "Full-stack development"],
    ["Suggested focus", "Testing and system design"],
  ];

  return (
    <PreviewShell step="02 / 06" title="Career profile">
      <div className="journey-profile">
        <p>
          <Sparkles size={16} aria-hidden="true" />
          Résumé analysis complete
        </p>

        {rows.map(([label, value], index) => (
          <div key={label}>
            <span>{String(index + 1).padStart(2, "0")}</span>

            <small>{label}</small>

            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function QuestionPreview() {
  return (
    <PreviewShell step="03 / 06" title="Personalised question">
      <div className="journey-question">
        <p>Based on your experience</p>

        <blockquote>
          You used Supabase for authentication.
          <br />
          <strong>How did you manage row-level security and protect user data?</strong>
        </blockquote>

        <div>
          <span>Résumé-based</span>
          <span>Role-Specific</span>
          <span>Mid Level</span>
        </div>

        <button type="button">
          Prepare answer
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>
    </PreviewShell>
  );
}

function PracticePreview() {
  const waveformHeights = [40, 76, 48, 88, 60, 32, 70, 52, 84, 44, 68, 36];

  return (
    <PreviewShell step="04 / 06" title="Voice practice">
      <div className="journey-practice">
        <div className="journey-practice__top">
          <span>Question 3 of 5</span>
          <strong>01:24</strong>
        </div>

        <h4>Explain how you protected application data.</h4>

        <div className="journey-practice__wave">
          <span>
            <Mic size={18} aria-hidden="true" />
          </span>

          {waveformHeights.map((height, index) => (
            <i
              key={`${height}-${index}`}
              style={{
                height: `${height}%`,
              }}
            />
          ))}

          <em>Listening…</em>
        </div>

        <div className="journey-practice__modes">
          <button type="button">Text</button>

          <button type="button" className="is-active">
            Voice
          </button>

          <button type="button">Video</button>
        </div>
      </div>
    </PreviewShell>
  );
}

function ReportPreview() {
  const metrics = [
    {
      label: "Role-specific relevance",
      score: 86,
    },
    {
      label: "Answer structure",
      score: 74,
    },
    {
      label: "Communication",
      score: 80,
    },
    {
      label: "Delivery consistency",
      score: 77,
    },
  ];

  const recommendations = [
    "Explain your individual contribution.",
    "Add measurable results.",
    "End with what you learned.",
  ];

  return (
    <PreviewShell step="05 / 06" title="Performance report">
      <div className="journey-report">
        <div className="journey-report__score">
          <small>Overall score</small>
          <strong>82</strong>
          <span>Strong answer</span>
        </div>

        <div className="journey-report__metrics">
          {metrics.map(({ label, score }) => (
            <div key={label}>
              <span>
                {label}
                <b>{score}</b>
              </span>

              <i>
                <em
                  style={{
                    width: `${score}%`,
                  }}
                />
              </i>
            </div>
          ))}
        </div>

        <ul>
          {recommendations.map((item) => (
            <li key={item}>
              <Check size={14} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </PreviewShell>
  );
}

function NextSessionPreview() {
  return (
    <PreviewShell step="06 / 06" title="Recommended next session">
      <div className="journey-next">
        <span>
          <Sparkles size={18} aria-hidden="true" />
          Your next best step
        </span>

        <h4>Role-specific explanation practice</h4>

        <p>Focus: REST APIs and database security</p>

        <div>
          <strong>5 questions</strong>
          <i />
          <strong>12 minutes</strong>
        </div>

        <Link to="/start">
          Start recommended practice
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </PreviewShell>
  );
}
