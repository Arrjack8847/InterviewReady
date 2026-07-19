import { Link } from "@tanstack/react-router";

export function HomeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="home-footer">
      <div className="home-shell">
        <div className="home-footer__top">
          <div className="home-footer__brand">
            <Link to="/" className="home-brand home-brand--footer" aria-label="InterviewReady home">
              <img
                className="home-brand__logo"
                src="/images/interviewready-logo.svg"
                alt="InterviewReady"
              />
            </Link>
            <p>
              Personalised interview preparation built from your résumé, target role and real
              performance.
            </p>
          </div>

          <div className="home-footer__navigation">
            <nav aria-labelledby="footer-product-title">
              <h2 id="footer-product-title">Product</h2>
              <a href="#how-it-works">How it works</a>
              <a href="#resume-intelligence">Résumé insights</a>
              <a href="#personalised-questions">Personalised questions</a>
              <a href="#practice-modes">Practice modes</a>
              <a href="#ai-feedback">AI feedback</a>
              <a href="#progress">Progress</a>
            </nav>

            <nav aria-labelledby="footer-prepare-title">
              <h2 id="footer-prepare-title">Prepare</h2>
              <Link to="/resume">Analyse my résumé</Link>
              <Link to="/start">Start practising</Link>
              <Link to="/login" search={{ redirect: "/" }}>
                Sign in
              </Link>
            </nav>
          </div>
        </div>

        <div className="home-footer__bottom">
          <span>© {currentYear} InterviewReady</span>
          <span>Personalised interview preparation</span>
          <span>Privacy-first preparation experience</span>
        </div>
      </div>
    </footer>
  );
}
