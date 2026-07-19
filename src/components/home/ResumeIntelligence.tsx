import { ArrowRight, Check, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";

const careerProfileRows = [
  {
    label: "Career level",
    value: "Entry level",
  },
  {
    label: "Core skills",
    value: "React · TypeScript · SQL",
  },
  {
    label: "Recommended role",
    value: "Junior Software Developer",
  },
  {
    label: "Interview focus",
    value: "Testing · System design",
  },
];

const resumeSkills = ["React", "TypeScript", "Node.js", "SQL", "Supabase", "REST APIs"];

const benefits = [
  "Understands your actual experience",
  "Identifies suitable roles and skill gaps",
  "Creates résumé-grounded interview questions",
];

export function ResumeIntelligence() {
  return (
    <section
      id="resume-intelligence"
      className="home-section home-resume-intelligence"
      aria-labelledby="resume-intelligence-title"
    >
      <div className="home-shell home-resume-intelligence__grid">
        <div className="home-resume-intelligence__copy">
          <p className="home-eyebrow home-eyebrow--dark">
            <FileText size={14} aria-hidden="true" />
            Résumé insights
          </p>

          <h2 id="resume-intelligence-title">Turn your résumé into a focused interview plan.</h2>

          <p>
            InterviewReady reads your experience, skills and projects to build a structured career
            profile that guides your preparation.
          </p>

          <ul className="home-resume-intelligence__signals">
            {benefits.map((benefit) => (
              <li key={benefit}>
                <Check size={15} aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <Link to="/resume" className="home-button home-button--white">
            Analyse my résumé
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <div
          className="home-resume-map"
          aria-label="English résumé transformed into a structured career profile"
        >
          <article className="home-resume-map__document">
            <header className="home-resume-map__card-head">
              <span>
                <FileText size={14} aria-hidden="true" />
                Résumé
              </span>
              <small>English</small>
            </header>

            <div className="home-resume-map__identity">
              <span aria-hidden="true">SMK</span>

              <div>
                <strong>Soe Min Khant</strong>
                <small>Junior Software Developer</small>
              </div>
            </div>

            <div className="home-resume-map__section">
              <small>SELECTED PROJECT</small>
              <strong>InterviewReady</strong>
              <p>
                AI-powered interview preparation platform built with React, TypeScript, Node.js and
                Supabase.
              </p>
            </div>

            <div className="home-resume-map__section is-highlighted">
              <small>EXTRACTED EXPERIENCE</small>
              <p>Authentication, résumé analysis and personalised question generation.</p>
            </div>

            <div className="home-resume-map__skills" aria-label="Skills">
              {resumeSkills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </article>

          <div className="home-resume-map__connector" aria-hidden="true">
            <span>Analysed</span>
            <i />
            <ArrowRight size={14} />
          </div>

          <article className="home-resume-map__profile">
            <header className="home-resume-map__card-head">
              <span>Career profile</span>
              <small>Ready</small>
            </header>

            <div className="home-resume-map__profile-summary">
              <small>RECOMMENDED DIRECTION</small>
              <strong>Junior Software Developer</strong>
              <p>
                Strong full-stack foundation with opportunities to improve testing and system-design
                knowledge.
              </p>
            </div>

            <ul className="home-resume-map__profile-rows">
              {careerProfileRows.map(({ label, value }) => (
                <li key={label}>
                  <Check size={14} aria-hidden="true" />

                  <span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
