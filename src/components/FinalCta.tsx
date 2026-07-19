import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary-gradient p-10 text-center shadow-elegant sm:p-16">
        <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
          Your dream internship starts with one practice session.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
          Join candidates using InterviewReady AI to walk into interviews calm, prepared,
          and confident.
        </p>
        <div className="mt-8">
          <Button asChild size="lg" variant="secondary">
            <Link to="/start">Start Your First Interview</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
