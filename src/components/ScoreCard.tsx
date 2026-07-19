interface Props {
  score: number;
  label?: string;
}

export function ScoreCard({ score, label = "Overall Readiness" }: Props) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="app-panel flex flex-col items-center justify-center p-8">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" stroke="var(--color-muted)" strokeWidth="10" fill="none" />
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke="var(--color-foreground)"
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-4xl font-bold text-foreground">{score}%</div>
          </div>
        </div>
      </div>
      <div className="mt-4 text-sm font-medium text-muted-foreground">{label}</div>
    </div>
  );
}
