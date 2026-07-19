import { ArrowRight, Camera, Check, Keyboard, Mic } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { practiceModes, type PracticeModeId } from "@/data/homepageContent";

export function PracticeModes() {
  const [activeMode, setActiveMode] = useState<PracticeModeId>("text");

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = practiceModes.findIndex((mode) => mode.id === activeMode);

  const active = practiceModes[activeIndex] ?? practiceModes[0];

  const selectMode = (index: number) => {
    const nextIndex = (index + practiceModes.length) % practiceModes.length;

    const nextMode = practiceModes[nextIndex];

    setActiveMode(nextMode.id);
    tabRefs.current[nextIndex]?.focus();
  };

  const getModeIcon = (mode: PracticeModeId) => {
    if (mode === "text") {
      return <Keyboard size={18} aria-hidden="true" />;
    }

    if (mode === "voice") {
      return <Mic size={18} aria-hidden="true" />;
    }

    return <Camera size={18} aria-hidden="true" />;
  };

  return (
    <section
      id="practice-modes"
      className="home-section home-practice"
      aria-labelledby="practice-modes-title"
    >
      <div className="home-shell">
        <div className="home-practice__heading">
          <div className="home-section-heading home-section-heading--dark">
            <p className="home-eyebrow home-eyebrow--dark">Practice modes</p>

            <h2 id="practice-modes-title">Practise the way you need to perform.</h2>

            <p>
              Build your answer through text, improve your delivery through voice, or rehearse the
              complete interview experience on camera.
            </p>
          </div>

          <div className="home-practice__mode-count">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>

            <span>/</span>

            <small>{String(practiceModes.length).padStart(2, "0")}</small>
          </div>
        </div>

        <div className="home-practice__layout">
          <div
            className="home-practice__tabs"
            role="tablist"
            aria-label="Practice modes"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                selectMode(activeIndex + 1);
              }

              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                selectMode(activeIndex - 1);
              }

              if (event.key === "Home") {
                event.preventDefault();
                selectMode(0);
              }

              if (event.key === "End") {
                event.preventDefault();

                selectMode(practiceModes.length - 1);
              }
            }}
          >
            {practiceModes.map((mode, index) => {
              const isActive = activeMode === mode.id;

              return (
                <button
                  key={mode.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`practice-tab-${mode.id}`}
                  aria-selected={isActive}
                  aria-controls="practice-preview"
                  tabIndex={isActive ? 0 : -1}
                  className={isActive ? "is-active" : ""}
                  onClick={() => setActiveMode(mode.id)}
                >
                  <span>{getModeIcon(mode.id)}</span>

                  <div>
                    <strong>{mode.label}</strong>

                    <p>{mode.description}</p>
                  </div>

                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              );
            })}

            <div className="home-practice__start">
              <p>Selected mode</p>

              <strong>{active.label} interview</strong>

              <Link to="/start" className="home-button home-button--white">
                Start practising
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div
            id="practice-preview"
            className="home-practice__preview"
            role="tabpanel"
            aria-labelledby={`practice-tab-${activeMode}`}
            tabIndex={0}
          >
            <div className="practice-preview__chrome">
              <div aria-hidden="true">
                <i />
                <i />
                <i />
              </div>

              <span>InterviewReady</span>

              <small>{active.label} practice</small>
            </div>

            <div key={activeMode} className="practice-preview__transition">
              {activeMode === "text" && <TextPreview />}

              {activeMode === "voice" && <VoicePreview />}

              {activeMode === "video" && <VideoPreview />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PracticeQuestion() {
  return (
    <div className="practice-preview__question">
      <div>
        <span>Question 3 of 5</span>
        <small>Résumé-based</small>
      </div>

      <h3>How did you protect user data in your authentication workflow?</h3>
    </div>
  );
}

function TextPreview() {
  return (
    <div className="practice-preview practice-preview--text">
      <PracticeQuestion />

      <div className="practice-text__workspace">
        <div className="practice-text__editor">
          <span>Your answer</span>

          <p>
            I designed the authentication flow using Supabase Auth and protected application data
            using row-level security policies. I also restricted access based on the authenticated
            user&apos;s profile and tested each policy before deployment.
          </p>

          <small>45 words</small>
        </div>

        <div className="practice-text__analysis">
          <div>
            <span>
              Relevance
              <strong>86</strong>
            </span>

            <i>
              <b style={{ width: "86%" }} />
            </i>
          </div>

          <div>
            <span>
              Structure
              <strong>74</strong>
            </span>

            <i>
              <b style={{ width: "74%" }} />
            </i>
          </div>

          <div>
            <span>
              Role-specific detail
              <strong>81</strong>
            </span>

            <i>
              <b style={{ width: "81%" }} />
            </i>
          </div>
        </div>
      </div>

      <div className="practice-preview__guidance">
        <span>Improve this answer</span>

        <p>
          Start with your responsibility, explain the security decision, and finish with the result.
        </p>
      </div>
    </div>
  );
}

function VoicePreview() {
  const waveform = [
    34, 56, 42, 76, 50, 88, 40, 68, 46, 82, 38, 62, 48, 72, 36, 58, 44, 78, 52, 66, 40, 70,
  ];

  return (
    <div className="practice-preview practice-preview--voice">
      <PracticeQuestion />

      <div className="practice-voice__recording">
        <div className="practice-voice__status">
          <span>
            <Mic size={20} aria-hidden="true" />
          </span>

          <div>
            <small>Recording</small>
            <strong>01:24</strong>
          </div>
        </div>

        <div className="practice-voice__wave" aria-label="Voice recording waveform">
          {waveform.map((height, index) => (
            <i
              key={`${height}-${index}`}
              style={{
                height: `${height}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="practice-voice__metrics">
        <Metric label="Speaking pace" value="132" detail="words per minute" />

        <Metric label="Filler words" value="3" detail="during this answer" />

        <Metric label="Delivery consistency" value="78%" detail="steady delivery" />
      </div>
    </div>
  );
}

function VideoPreview() {
  return (
    <div className="practice-preview practice-preview--video">
      <PracticeQuestion />

      <div className="practice-video__camera">
        <div className="practice-video__topbar">
          <span>
            <i aria-hidden="true" />
            Camera active
          </span>

          <small>01:24</small>
        </div>

        <div className="practice-video__guide" aria-hidden="true">
          <span />

          <div>
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <p>Keep your face inside the guide and look toward the camera.</p>
      </div>

      <div className="practice-video__signals">
        <Signal label="Camera engagement" value="Good" />

        <Signal label="Camera presence" value="82%" />

        <Signal label="Engagement" value="79%" />
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>
        <Check size={14} aria-hidden="true" />

        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}
