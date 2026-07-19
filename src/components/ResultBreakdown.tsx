import { Progress } from "@/components/ui/progress";
import type { FinalReport } from "@/lib/types";

interface Props {
  breakdown: FinalReport["breakdown"];
}

const LABELS: Record<string, string> = {
  clarity: "Clarity",
  relevance: "Relevance",
  structure: "Structure",
  confidence: "Answer communication",
  technicalAccuracy: "Role-Specific Knowledge",
  communication: "Communication",
  resumeMatch: "Resume Match",
  companyReadiness: "Company Readiness",
  speechConfidence: "Speech Delivery",
  cameraPresence: "Camera Presence",
};

export function ResultBreakdown({ breakdown }: Props) {
  const entries = Object.entries(breakdown).filter(([, value]) => typeof value === "number");

  return (
    <section className="app-panel p-6 sm:p-8" aria-labelledby="skill-breakdown-title">
      <h3 id="skill-breakdown-title" className="font-display text-xl font-semibold">
        Skill breakdown
      </h3>
      <div className="mt-6 space-y-5">
        {entries.map(([key, value = 0]) => (
          <div key={key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{LABELS[key] ?? key}</span>
              <span className="text-muted-foreground">{value}%</span>
            </div>
            <Progress value={value} className="mt-2 h-2" />
          </div>
        ))}
      </div>
    </section>
  );
}
