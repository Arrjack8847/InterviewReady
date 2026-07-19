import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { LoadingState } from "@/components/app/LoadingState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { InterviewReport } from "@/features/report/components/InterviewReport";
import { useInterviewReport } from "@/features/report/useInterviewReport";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Interview Readiness Report — InterviewReady" },
      {
        name: "description",
        content:
          "Review your interview answers, coaching priorities, and personalized practice plan.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ResultPage />
    </RequireAuth>
  ),
});

function ResultPage() {
  const { user } = useAuth();
  const report = useInterviewReport({ source: "current", userId: user?.uid });

  if (report.status === "loading") {
    return (
      <LoadingState
        fullPage
        title="Preparing your interview report"
        description="Loading the completed session, saved answers, and available coaching measurements."
      />
    );
  }

  if (report.status === "error") {
    return (
      <div className="app-container py-16">
        <ErrorState
          title="Your report could not be loaded"
          description={report.error}
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={report.retry}>Try again</Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Return to dashboard</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  if (report.status === "empty") {
    return (
      <div className="app-container py-16">
        <EmptyState
          title="No report is available yet"
          description="Complete a practice interview to generate answer feedback and a coaching plan."
          action={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link to="/start">Start an interview</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Return to dashboard</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return <InterviewReport report={report.viewModel} />;
}
