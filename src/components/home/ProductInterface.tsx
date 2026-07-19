import { Check, Mic, Sparkles } from "lucide-react";

type ProductInterfaceProps = {
  compact?: boolean;
  className?: string;
};

const waveform = [28, 46, 34, 70, 52, 82, 42, 64, 36, 74, 48, 58, 30, 68, 44, 26];

export function ProductInterface({ compact = false, className = "" }: ProductInterfaceProps) {
  return (
    <div
      className={`product-interface ${compact ? "product-interface--compact" : ""} ${className}`}
    >
      <div className="product-interface__chrome">
        <div className="product-interface__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>Junior Software Developer Interview</span>
        <span className="product-interface__secure">
          <Check size={12} aria-hidden="true" /> Personalised
        </span>
      </div>
      <div className="product-interface__body">
        <aside className="product-interface__rail" aria-label="Interview progress">
          <span className="product-interface__monogram">SMK</span>
          <ol>
            {[1, 2, 3, 4, 5].map((item) => (
              <li key={item} className={item === 3 ? "is-active" : item < 3 ? "is-done" : ""}>
                <span>{item < 3 ? <Check size={11} aria-hidden="true" /> : item}</span>
              </li>
            ))}
          </ol>
        </aside>
        <main className="product-interface__question">
          <div className="product-interface__label-row">
            <span>Question 3 of 5</span>
            <span>Role-Specific · Entry Level</span>
          </div>
          <h3>How did you secure user data in your Supabase authentication workflow?</h3>
          <div className="product-interface__recording">
            <div className="product-interface__recording-state">
              <span className="product-interface__mic">
                <Mic size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>Listening…</strong>
                <small>01:24</small>
              </div>
            </div>
            <div className="product-interface__wave" aria-hidden="true">
              {waveform.map((height, index) => (
                <i key={`${height}-${index}`} style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          {!compact && (
            <div className="product-interface__answer">
              <span>Your answer</span>
              <p>
                I used Supabase Auth for identity and applied row-level security policies so each
                user could only access records linked to their account.
              </p>
            </div>
          )}
        </main>
        <aside className="product-interface__score">
          <div className="product-interface__score-head">
            <span>
              <Sparkles size={14} aria-hidden="true" /> AI feedback
            </span>
            <strong>82</strong>
          </div>
          <div className="product-interface__metrics">
            <Metric label="Delivery" value={78} />
            <Metric label="Clarity" value={84} />
            <Metric label="Relevance" value={81} />
          </div>
          <div className="product-interface__suggestion">
            <span>Improve next</span>
            <p>
              Explain your individual contribution and include the outcome of your professional
              decision.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>
        <em>{label}</em>
        <strong>{value}%</strong>
      </span>
      <i>
        <b style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}
