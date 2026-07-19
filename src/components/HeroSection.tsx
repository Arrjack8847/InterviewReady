import { Link } from "@tanstack/react-router";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-hero-gradient">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            AI-powered interview coaching for every career stage
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Practice Smarter. <span className="text-primary-gradient">Interview Better.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            InterviewReady AI helps candidates across professions and experience levels prepare for real job interviews
            with role-based questions, instant AI feedback, and progress tracking — all in one calm,
            focused workspace.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-primary-gradient text-primary-foreground shadow-elegant hover:opacity-90"
            >
              <Link to="/start">
                Start Practicing <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">
                <Play className="mr-2 h-4 w-4" /> View Demo
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="rounded-3xl border border-border bg-card/80 p-2 shadow-elegant backdrop-blur">
            <div className="rounded-2xl bg-surface p-6 sm:p-10">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { k: "12k+", v: "Practice sessions completed" },
                  { k: "94%", v: "Candidates feel more confident" },
                  { k: "5 min", v: "To get your first feedback" },
                ].map((s) => (
                  <div key={s.v} className="rounded-xl bg-card p-5 text-center">
                    <div className="text-2xl font-bold text-primary-gradient">{s.k}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
