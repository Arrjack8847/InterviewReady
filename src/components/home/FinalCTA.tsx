import { ArrowRight, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/context/AuthContext";

const preparationJourney = [
  "Résumé understanding",
  "Personalised practice",
  "Actionable feedback",
  "Visible improvement",
];

export function FinalCTA() {
  const { user, loading } = useAuth();

  const authenticated = !loading && Boolean(user);

  return (
    <section className="home-final-cta" aria-labelledby="final-cta-title">
      <div className="home-shell home-final-cta__inner">
        <div className="home-final-cta__topline">
          <p>Your next interview starts here.</p>

          <span>Text · Voice · Video</span>
        </div>

        <div className="home-final-cta__content">
          <p className="home-eyebrow home-eyebrow--dark">InterviewReady</p>

          <h2 id="final-cta-title">Make the real interview feel familiar.</h2>

          <p className="home-final-cta__description">
            Prepare with questions built from your résumé, target role and real performance—then
            walk into the interview knowing what to expect.
          </p>

          <div className="home-final-cta__actions">
            <Link to="/start" className="home-button home-button--white">
              {authenticated ? "Continue practising" : "Start practising"}

              <ArrowRight size={17} aria-hidden="true" />
            </Link>

            <Link to="/resume" className="home-button home-button--outline-dark">
              <FileText size={17} aria-hidden="true" />

              {authenticated ? "View career profile" : "Analyse my résumé"}
            </Link>
          </div>
        </div>

        <ol className="home-final-cta__journey" aria-label="InterviewReady preparation journey">
          {preparationJourney.map((item, index) => (
            <li key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>

              <strong>{item}</strong>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
