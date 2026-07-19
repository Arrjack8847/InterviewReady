import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useAuth } from "@/context/AuthContext";
import { progressData } from "@/data/homepageContent";

const chartWidth = 760;
const chartHeight = 330;
const chartLeft = 54;
const chartRight = 26;
const chartTop = 34;
const chartBottom = 54;
const minimumScore = 55;
const maximumScore = 90;

const chartInnerWidth = chartWidth - chartLeft - chartRight;

const chartInnerHeight = chartHeight - chartTop - chartBottom;

const points = progressData.map((item, index) => {
  const horizontalStep = progressData.length > 1 ? chartInnerWidth / (progressData.length - 1) : 0;

  const normalizedScore = (item.score - minimumScore) / (maximumScore - minimumScore);

  return {
    ...item,
    x: chartLeft + index * horizontalStep,
    y: chartTop + chartInnerHeight - normalizedScore * chartInnerHeight,
  };
});

const linePath = points
  .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
  .join(" ");

const firstPoint = points[0];
const lastPoint = points[points.length - 1];
const chartBase = chartHeight - chartBottom;

const areaPath =
  firstPoint && lastPoint
    ? `${linePath} L ${lastPoint.x} ${chartBase} L ${firstPoint.x} ${chartBase} Z`
    : "";

const skillProgress = [
  {
    label: "Answer structure",
    before: 58,
    current: 82,
    improvement: "+24",
  },
  {
    label: "Delivery consistency",
    before: 64,
    current: 81,
    improvement: "+17",
  },
  {
    label: "Role-specific clarity",
    before: 61,
    current: 80,
    improvement: "+19",
  },
];

export function ProgressShowcase() {
  const { user, loading } = useAuth();

  const authenticated = !loading && Boolean(user);

  return (
    <section
      id="progress"
      className="home-section home-progress"
      aria-labelledby="home-progress-title"
    >
      <div className="home-shell">
        <div className="home-progress__heading">
          <div className="home-section-heading">
            <p className="home-eyebrow">Personal progress</p>

            <h2 id="home-progress-title">See improvement, not just activity.</h2>

            <p>
              Every completed interview becomes evidence. Track how your structure, delivery and
              professional communication improve—and use that progress to choose what to practise next.
            </p>
          </div>

          <p className="home-progress__principle">
            Your progress belongs to you.
            <br />
            No platform-wide vanity statistics.
          </p>
        </div>

        <div className="home-progress__workspace">
          <article id="progress-chart" className="home-progress__chart">
            <header className="home-progress__chart-head">
              <div>
                <span>Interview readiness</span>
                <strong>Five-session trend</strong>
              </div>

              <div className="home-progress__current-score">
                <strong>84</strong>
                <small>/ 100</small>
              </div>
            </header>

            <div className="home-progress__chart-stage">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-labelledby="progress-chart-title progress-chart-description"
              >
                <title id="progress-chart-title">Interview readiness across five sessions</title>

                <desc id="progress-chart-description">
                  The example readiness score improves from 62 in session one to 84 in session five.
                </desc>

                <defs>
                  <linearGradient id="progress-area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#111111" stopOpacity="0.13" />

                    <stop offset="1" stopColor="#111111" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[60, 70, 80, 90].map((score) => {
                  const normalizedScore = (score - minimumScore) / (maximumScore - minimumScore);

                  const y = chartTop + chartInnerHeight - normalizedScore * chartInnerHeight;

                  return (
                    <g key={score}>
                      <line
                        x1={chartLeft}
                        x2={chartWidth - chartRight}
                        y1={y}
                        y2={y}
                        className="home-progress-chart__grid"
                      />

                      <text x="8" y={y + 4} className="home-progress-chart__axis">
                        {score}
                      </text>
                    </g>
                  );
                })}

                {areaPath && (
                  <path
                    d={areaPath}
                    fill="url(#progress-area-fill)"
                    className="home-progress-chart__area"
                  />
                )}

                <path d={linePath} className="home-progress-chart__line" />

                {points.map((point, index) => (
                  <g key={point.week}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={index === points.length - 1 ? 7 : 5}
                      className={
                        index === points.length - 1
                          ? "home-progress-chart__point is-current"
                          : "home-progress-chart__point"
                      }
                    />

                    <text
                      x={point.x}
                      y={point.y - 18}
                      textAnchor="middle"
                      className="home-progress-chart__value"
                    >
                      {point.score}
                    </text>

                    <text
                      x={point.x}
                      y={chartHeight - 18}
                      textAnchor="middle"
                      className="home-progress-chart__session"
                    >
                      Session {index + 1}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <footer className="home-progress__chart-footer">
              <div>
                <span>Starting readiness</span>
                <strong>62</strong>
              </div>

              <i aria-hidden="true" />

              <div>
                <span>Current readiness</span>
                <strong>84</strong>
              </div>

              <i aria-hidden="true" />

              <div>
                <span>Overall change</span>
                <strong>+22</strong>
              </div>
            </footer>

            <ul className="sr-only">
              {progressData.map((item) => (
                <li key={item.week}>
                  {item.week}: {item.score}
                </li>
              ))}
            </ul>
          </article>

          <aside className="home-progress__insights">
            <div className="home-progress__insights-head">
              <span>What improved</span>
              <strong>Focused practice is working.</strong>

              <p>
                The strongest change came from organising answers before adding role-specific detail.
              </p>
            </div>

            <div className="home-progress__skills">
              {skillProgress.map((skill) => (
                <div key={skill.label}>
                  <header>
                    <span>{skill.label}</span>
                    <strong>{skill.improvement}</strong>
                  </header>

                  <div className="home-progress__skill-track">
                    <i
                      style={{
                        width: `${skill.before}%`,
                      }}
                    />

                    <b
                      style={{
                        width: `${skill.current}%`,
                      }}
                    />
                  </div>

                  <footer>
                    <span>Before {skill.before}</span>
                    <span>Now {skill.current}</span>
                  </footer>
                </div>
              ))}
            </div>

            <div className="home-progress__next">
              <span>Recommended next focus</span>

              <strong>Evidence and measurable results</strong>

              <p>
                Your structure is improving. The next opportunity is proving the impact of your
                decisions with clearer outcomes.
              </p>
            </div>

            <Link
              to={authenticated ? "/dashboard" : "/start"}
              className="home-button home-button--dark"
            >
              {authenticated ? "View my progress" : "Start building my progress"}

              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
