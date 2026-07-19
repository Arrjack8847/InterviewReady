import { ArrowDown } from "lucide-react";

import { howItWorksSteps } from "@/data/homepageContent";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="home-section home-how" aria-labelledby="home-how-title">
      <div className="home-shell">
        <div className="home-how__intro">
          <div className="home-section-heading">
            <p className="home-eyebrow">How it works</p>

            <h2 id="home-how-title">A preparation system built around you.</h2>

            <p>From your résumé to focused improvement, every stage informs what comes next.</p>
          </div>

          <a
            href="#resume-intelligence"
            className="home-how__continue"
            aria-label="Continue to résumé insights"
          >
            <span>Explore the system</span>
            <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>

        <ol className="home-how__steps">
          {howItWorksSteps.map((step, index) => (
            <li key={step.number}>
              <div className="home-how__step-head">
                <span>{step.number}</span>

                <i aria-hidden="true">
                  <b
                    style={{
                      width: index === howItWorksSteps.length - 1 ? "100%" : "50%",
                    }}
                  />
                </i>
              </div>

              <div className="home-how__step-copy">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
